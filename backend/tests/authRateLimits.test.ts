import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server-core';

jest.mock('../api/services/email.service', () => ({
  emailService: {sendEmail: jest.fn(async () => undefined)}
}));

import app from '../app';
import {CSRF_COOKIE} from '../api/constants/cookies';
import {UserModel} from '../api/models/User.model';

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
