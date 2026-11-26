import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server-core';

jest.mock('../api/services/email.service', () => ({
  emailService: {sendEmail: jest.fn(async () => undefined)}
}));

import app from '../app';
import {CSRF_COOKIE, REFRESH_TOKEN_COOKIE} from '../api/constants/cookies';
import {UserModel} from '../api/models/User.model';
import {authService} from '../api/services/auth.service';
import {emailService} from '../api/services/email.service';

/*
 * The pre-auth endpoints used to share one budget of 5 requests per 15
 * minutes. A couple of mistyped passwords then locked a person out of the
 * password reset that would fix it, and successful sign-ins used it up too.
 * Each flow now has its own budget, and only failed sign-ins count.
 */

const PASSWORD = 'Correct-horse-1';
const CSRF = 'csrf-test-token';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {autoIndex: false});
}, 120_000);

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

function post(path: string, body: object) {
  return request(app)
    .post(path)
    .set('Cookie', `${CSRF_COOKIE}=${CSRF}`)
    .set('X-CSRF-Token', CSRF)
    .send(body);
}

async function createUser() {
  return UserModel.create({
    firstName: 'Rate',
    lastName: 'Limit',
    email: 'limits@example.test',
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    isVerified: true
  });
}

describe('pre-auth rate limits', () => {
  it('does not count successful sign-ins', async () => {
    await createUser();
    for (let i = 0; i < 12; i += 1) {
      const res = await post('/api/auth/login', {email: 'limits@example.test', password: PASSWORD});
      expect(res.status).toBe(200);
    }
  });

  it('blocks sign-in after 10 failed attempts', async () => {
    await createUser();
    for (let i = 0; i < 10; i += 1) {
      const res = await post('/api/auth/login', {email: 'limits@example.test', password: 'wrong'});
      expect(res.status).toBe(401);
    }
    const blocked = await post('/api/auth/login', {email: 'limits@example.test', password: 'wrong'});
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('keeps password reset available after sign-in is rate-limited', async () => {
    await createUser();
    for (let i = 0; i < 11; i += 1) {
      await post('/api/auth/login', {email: 'limits@example.test', password: 'wrong'});
    }
    const reset = await post('/api/auth/forgot-password', {email: 'limits@example.test'});
    expect(reset.status).not.toBe(429);
  });

  it('limits password-reset requests on their own budget', async () => {
    await createUser();
    for (let i = 0; i < 10; i += 1) {
      const res = await post('/api/auth/forgot-password', {email: 'limits@example.test'});
      expect(res.status).not.toBe(429);
    }
    const blocked = await post('/api/auth/forgot-password', {email: 'limits@example.test'});
    expect(blocked.status).toBe(429);
  });
});

describe('emailed codes', () => {
  const email = 'limits@example.test';
  const resetCode = async () => (await UserModel.findOne({email}))!.resetCode!;
  const wrong = (code: string) => String((Number(code) % 900000) + 100001).slice(0, 6);

  it('stops a reset code working after 5 wrong guesses, even in parallel', async () => {
    await createUser();
    await authService.forgotPassword(email);
    const code = await resetCode();
    expect(code).toMatch(/^\d{6}$/);

    // Ten guesses at once: only five may be counted against the code.
    const guesses = await Promise.allSettled(
      Array.from({length: 10}, () => authService.verifyResetCode(email, wrong(code)))
    );
    expect(guesses.every(g => g.status === 'rejected')).toBe(true);
    expect((await UserModel.findOne({email}))!.resetAttempts).toBe(5);

    // The right code no longer works; the person has to request a new one.
    await expect(authService.resetPassword(email, code, 'New-horse-2')).rejects.toMatchObject({statusCode: 400});
    await authService.forgotPassword(email);
    await expect(authService.verifyResetCode(email, await resetCode())).resolves.toBeUndefined();
  });

  it('lets the right code through both reset steps after a few mistakes', async () => {
    await createUser();
    await authService.forgotPassword(email);
    const code = await resetCode();
    for (let i = 0; i < 4; i += 1) {
      await expect(authService.verifyResetCode(email, wrong(code))).rejects.toMatchObject({statusCode: 400});
    }
    await authService.verifyResetCode(email, code);
    await authService.resetPassword(email, code, 'New-horse-2');
    expect((await UserModel.findOne({email}))!.resetCode).toBeNull();
  });

  it('limits guesses at the email verification code too', async () => {
    await UserModel.create({
      firstName: 'New',
      lastName: 'Person',
      email,
      passwordHash: 'x',
      isVerified: false,
      verificationCode: '123456',
      verificationExpiry: new Date(Date.now() + 600_000)
    });
    for (let i = 0; i < 5; i += 1) {
      await expect(authService.verify(email, '654321')).rejects.toMatchObject({statusCode: 400});
    }
    await expect(authService.verify(email, '123456')).rejects.toMatchObject({statusCode: 400});
    expect((await UserModel.findOne({email}))!.isVerified).toBe(false);
  });
});

describe('sessions', () => {
  const email = 'limits@example.test';

  async function signIn() {
    const res = await post('/api/auth/login', {email, password: PASSWORD});
    expect(res.status).toBe(200);
    return refreshCookie(res);
  }

  function refreshCookie(res: request.Response): string {
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const found = cookies.find(c => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
    return found!.split(';')[0].slice(REFRESH_TOKEN_COOKIE.length + 1);
  }

  const refresh = (token: string) => post('/api/auth/refresh', {refreshToken: token});

  it('lets a refresh token be used only once, even by two requests at the same moment', async () => {
    await createUser();
    const token = await signIn();
    const results = await Promise.all([refresh(token), refresh(token)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 401]);
  });

  it('ends other sessions when the password changes, and keeps the one that changed it', async () => {
    await createUser();
    const other = await signIn();
    const login = await post('/api/auth/login', {email, password: PASSWORD});
    const cookies = ([] as string[]).concat(login.headers['set-cookie'] ?? []).map(c => c.split(';')[0]);

    const changed = await request(app)
      .put('/api/auth/password')
      .set('Cookie', [...cookies, `${CSRF_COOKIE}=${CSRF}`].join('; '))
      .set('X-CSRF-Token', CSRF)
      .send({currentPassword: PASSWORD, newPassword: 'New-horse-2'});
    expect(changed.status).toBe(200);

    expect((await refresh(other)).status).toBe(401);
    expect((await refresh(refreshCookie(changed))).status).toBe(200);
  });
});

describe('signing up when the email cannot be sent', () => {
  it('leaves no account behind, so trying again works', async () => {
    const data = {firstName: 'New', lastName: 'Person', username: 'newperson', email: 'new@example.test', password: PASSWORD};
    (emailService.sendEmail as jest.Mock).mockRejectedValueOnce(new Error('SMTP down'));

    await expect(authService.register(data)).rejects.toThrow('SMTP down');
    expect(await UserModel.countDocuments({email: data.email})).toBe(0);

    await expect(authService.register(data)).resolves.toMatchObject({email: data.email});
    expect(await UserModel.countDocuments({email: data.email})).toBe(1);
  });
});
