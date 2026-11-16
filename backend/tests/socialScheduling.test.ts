import {createHash} from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose, {Types} from 'mongoose';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server-core';

jest.mock('../api/services/email.service', () => ({
  emailService: {sendEmail: jest.fn(async () => undefined)}
}));

import app from '../app';
import {env} from '../api/config/env';
import {ACCESS_TOKEN_COOKIE, CSRF_COOKIE, REFRESH_TOKEN_COOKIE} from '../api/constants/cookies';
import {UserModel} from '../api/models/User.model';
import {WorkspaceModel} from '../api/models/Workspace.model';
import {WorkspaceMemberModel} from '../api/models/WorkspaceMember.model';
import {SocialAccountModel} from '../api/models/SocialAccount.model';
import {PublishingJobModel} from '../api/models/PublishingJob.model';
import {SocialPostModel} from '../api/models/SocialPost.model';
import {publishDueJobs} from '../api/services/social/publisher.service';
import {composeText} from '../api/services/social/publisher.service';
import {webhookUrl} from '../api/services/social/qstash';
import {zonedToUtc} from '../api/services/social/time';
import {toLittleText} from '../api/services/social/providers/linkedin';
import {decryptToken, encryptToken} from '../api/utils/tokenCrypto';
import {hashToken} from '../api/utils/crypto';

jest.setTimeout(30_000);

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

let counter = 0;
/** A verified user who owns a workspace of their own. */
async function member(workspaceId?: Types.ObjectId) {
  counter += 1;
  const user = await UserModel.create({
    firstName: `Social${counter}`,
    lastName: 'Tester',
    email: `social${counter}@example.test`,
    passwordHash: await bcrypt.hash('Correct-horse-1', 4),
    isVerified: true
  });
  let wsId = workspaceId;
  if (!wsId) {
    const ws = await WorkspaceModel.create({name: `WS ${counter}`, slug: `ws-${counter}`, ownerId: user._id});
    wsId = ws._id as Types.ObjectId;
  }
  await WorkspaceMemberModel.create({workspaceId: wsId, userId: user._id, role: workspaceId ? 'member' : 'owner'});
  await UserModel.updateOne({_id: user._id}, {$set: {workspaceId: wsId}});
  return {userId: user._id as Types.ObjectId, workspaceId: wsId};
}

function session(userId: Types.ObjectId) {
  const access = jwt.sign({userId: userId.toString(), type: 'user'}, env.JWT_SECRET, {expiresIn: 900});
  const refresh = jwt.sign({userId: userId.toString(), type: 'user'}, env.JWT_REFRESH_SECRET, {
    expiresIn: 3600,
    jwtid: hashToken(String(Math.random()))
  });
  const csrf = 'csrf-test-token';
  return {cookie: `${ACCESS_TOKEN_COOKIE}=${access}; ${REFRESH_TOKEN_COOKIE}=${refresh}; ${CSRF_COOKIE}=${csrf}`, csrf};
}

function as(userId: Types.ObjectId) {
  const s = session(userId);
  const wrap = (r: request.Test) => r.set('Cookie', s.cookie).set('X-CSRF-Token', s.csrf);
  return {
    get: (path: string) => wrap(request(app).get(path)),
    post: (path: string, body: object = {}) => wrap(request(app).post(path)).send(body),
    put: (path: string, body: object) => wrap(request(app).put(path)).send(body),
    del: (path: string) => wrap(request(app).delete(path))
  };
}

const image = {
  id: 'm1',
  type: 'image',
  name: 'photo.jpg',
  storageUrl: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
  dataUrl: 'data:image/jpeg;base64,AAAA',
  size: 1000,
  platformCompat: ['instagram', 'linkedin']
};

function draft(id: string, platforms: string[], media: object[] = []) {
  return {
    id,
    title: 'Launch',
    caption: 'We launched',
    platforms: platforms.map(platform => ({platform, enabled: true, status: 'pending', caption: '', hashtags: []})),
    media,
    status: 'draft',
    repeat: 'none',
    tags: []
  };
}

describe('social posts', () => {
  it('stores posts per workspace and shares them with workspace members', async () => {
    const owner = await member();
    const teammate = await member(owner.workspaceId);
    const outsider = await member();

    const created = await as(owner.userId).post('/api/social-posts', draft('post-1', ['linkedin'], [image]));
    expect(created.status).toBe(201);
    expect(created.body.post.id).toBe('post-1');
    // The browser-only preview never reaches the server.
    expect(created.body.post.media[0].dataUrl).toBeUndefined();

    const shared = await as(teammate.userId).get('/api/social-posts');
    expect(shared.body.posts.map((p: {id: string}) => p.id)).toEqual(['post-1']);

    const other = await as(outsider.userId).get('/api/social-posts');
    expect(other.body.posts).toEqual([]);
    expect((await as(outsider.userId).get('/api/social-posts/post-1')).status).toBe(404);
  });

  it('imports browser posts once and turns never-queued "scheduled" posts into drafts', async () => {
    const owner = await member();
    const posts = [
      {...draft('local-1', ['instagram']), status: 'scheduled'},
      {...draft('local-2', ['x', 'linkedin']), status: 'idea'}
    ];
    const first = await as(owner.userId).post('/api/social-posts/import', {posts});
    expect(first.body).toEqual({imported: 2, skipped: 0});
    const again = await as(owner.userId).post('/api/social-posts/import', {posts});
    expect(again.body).toEqual({imported: 0, skipped: 2});

    const stored = await SocialPostModel.find({workspaceId: owner.workspaceId}).sort({id: 1});
    expect(stored.map(p => p.status)).toEqual(['draft', 'idea']);
    // X is not schedulable and is dropped rather than failing the import.
    expect(stored[1].platforms.map(t => t.platform)).toEqual(['linkedin']);
  });
});

describe('connecting accounts', () => {
  it('creates a demo account when the platform has no credentials', async () => {
    const owner = await member();
    const res = await as(owner.userId).post('/api/social-accounts/connect/linkedin');
    expect(res.status).toBe(201);
    expect(res.body.demo).toBe(true);
    expect(res.body.account.platform).toBe('linkedin');
    expect(res.body.account.accessTokenEnc).toBeUndefined();

    const list = await as(owner.userId).get('/api/social-accounts');
    expect(list.body.accounts).toHaveLength(1);
  });

  it('returns a sign-in URL and refuses a callback from another browser', async () => {
    const owner = await member();
    const saved = {id: env.LINKEDIN_CLIENT_ID, secret: env.LINKEDIN_CLIENT_SECRET};
    env.LINKEDIN_CLIENT_ID = 'client-id';
    env.LINKEDIN_CLIENT_SECRET = 'client-secret';
    try {
      const res = await as(owner.userId).post('/api/social-accounts/connect/linkedin');
      expect(res.status).toBe(200);
      const url = new URL(res.body.url);
      expect(url.hostname).toBe('www.linkedin.com');
      expect(url.searchParams.get('scope')).toContain('w_member_social');
      expect(String(res.headers['set-cookie'])).toContain('_social_oauth=');

      // Same state, but without the nonce cookie the browser was given.
      const callback = await request(app).get(
        `/api/social-accounts/oauth/linkedin/callback?code=abc&state=${encodeURIComponent(url.searchParams.get('state')!)}`
      );
      expect(callback.status).toBe(302);
      expect(callback.headers.location).toContain('social=error');
      expect(await SocialAccountModel.countDocuments()).toBe(0);
    } finally {
      env.LINKEDIN_CLIENT_ID = saved.id;
      env.LINKEDIN_CLIENT_SECRET = saved.secret;
    }
  });

  it('sends a sign-in started from Settings back to Settings', async () => {
    const owner = await member();
    const saved = {id: env.LINKEDIN_CLIENT_ID, secret: env.LINKEDIN_CLIENT_SECRET};
    env.LINKEDIN_CLIENT_ID = 'client-id';
    env.LINKEDIN_CLIENT_SECRET = 'client-secret';
    try {
      const res = await as(owner.userId).post('/api/social-accounts/connect/linkedin', {returnTo: 'settings'});
      const state = new URL(res.body.url).searchParams.get('state')!;
      // The person cancels on LinkedIn's page.
      const callback = await request(app).get(
        `/api/social-accounts/oauth/linkedin/callback?error=user_cancelled&state=${encodeURIComponent(state)}`
      );
      expect(callback.headers.location).toContain('/settings?tab=accounts&');
      expect(callback.headers.location).toContain('social=error');
    } finally {
      env.LINKEDIN_CLIENT_ID = saved.id;
      env.LINKEDIN_CLIENT_SECRET = saved.secret;
    }
  });

  it('lets only the connector or the workspace owner disconnect', async () => {
    const owner = await member();
    const teammate = await member(owner.workspaceId);
    const connected = await as(owner.userId).post('/api/social-accounts/connect/facebook');
    const id = connected.body.account.id;
    expect((await as(teammate.userId).del(`/api/social-accounts/${id}`)).status).toBe(403);
    expect((await as(owner.userId).del(`/api/social-accounts/${id}`)).status).toBe(204);
  });
});

describe('scheduling and publishing (dry run)', () => {
  it('reports platforms that cannot be scheduled and queues the rest', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin');
    await api.post('/api/social-posts', draft('p1', ['linkedin', 'instagram', 'tiktok']));

    const res = await api.post('/api/social-posts/p1/schedule', {
      scheduledDate: '2030-01-15',
      scheduledTime: '09:30',
      timezone: 'Asia/Manila'
    });
    expect(res.status).toBe(200);
    expect(res.body.scheduledAt).toBe('2030-01-15T01:30:00.000Z');
    expect(res.body.jobsCreated).toHaveLength(1);
    const byPlatform = Object.fromEntries(
      res.body.validation.map((v: {platform: string; errors: string[]}) => [v.platform, v.errors])
    );
    expect(byPlatform.linkedin).toEqual([]);
    expect(byPlatform.instagram.join(' ')).toMatch(/Connect a Instagram account|image or a video/);
    expect(byPlatform.tiktok.join(' ')).toMatch(/video/);
    expect(res.body.post.status).toBe('scheduled');
  });

  it('publishes a due post through the sweep and records the simulated result', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin');
    await api.post('/api/social-posts', draft('p2', ['linkedin']));
    // A time in the past publishes right away.
    await api.post('/api/social-posts/p2/schedule', {scheduledDate: '2020-01-01', scheduledTime: '08:00'});

    await publishDueJobs();

    const post = (await api.get('/api/social-posts/p2')).body.post;
    expect(post.status).toBe('posted');
    expect(post.platforms[0]).toMatchObject({status: 'posted', dryRun: true});
    expect(post.platforms[0].externalPostId).toMatch(/^dryrun_linkedin_/);

    const jobs = (await api.get('/api/publishing-jobs?socialPostId=p2')).body.jobs;
    expect(jobs[0].status).toBe('completed');

    // Running again does not publish twice.
    await publishDueJobs();
    expect(await PublishingJobModel.countDocuments({status: 'completed'})).toBe(1);
  });

  it('cancels queued jobs, and moving a post back to drafts unschedules it', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin');
    await api.post('/api/social-posts', draft('p3', ['linkedin']));
    await api.post('/api/social-posts', draft('p4', ['linkedin']));
    await api.post('/api/social-posts/p3/schedule', {scheduledDate: '2030-05-01'});
    await api.post('/api/social-posts/p4/schedule', {scheduledDate: '2030-05-01'});

    const cancelled = await api.post('/api/social-posts/p3/cancel', {});
    expect(cancelled.body.post.status).toBe('cancelled');

    const back = await api.put('/api/social-posts/p4', {status: 'draft'});
    expect(back.body.post.status).toBe('draft');
    expect(back.body.post.platforms[0].status).toBe('pending');
    expect(await PublishingJobModel.countDocuments({status: 'queued'})).toBe(0);
  });

  it('retries a failed platform', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin');
    await api.post('/api/social-posts', draft('p5', ['linkedin']));
    await api.post('/api/social-posts/p5/schedule', {scheduledDate: '2020-01-01'});
    // Make the content invalid after scheduling, so publishing fails for good.
    await SocialPostModel.updateOne({id: 'p5'}, {$set: {caption: 'x'.repeat(3001)}});
    await publishDueJobs();
    expect((await api.get('/api/social-posts/p5')).body.post.status).toBe('failed');

    await SocialPostModel.updateOne({id: 'p5'}, {$set: {caption: 'fixed'}});
    const retried = await api.post('/api/social-posts/p5/retry', {});
    expect(retried.body.retried).toEqual(['linkedin']);
    await publishDueJobs();
    expect((await api.get('/api/social-posts/p5')).body.post.status).toBe('posted');
  });
});

describe('QStash webhook', () => {
  const body = JSON.stringify({jobId: new Types.ObjectId().toString()});
  const sign = (key: string, payload: string) =>
    jwt.sign(
      {
        iss: 'Upstash',
        sub: webhookUrl(),
        body: createHash('sha256').update(payload).digest('base64url')
      },
      key,
      {algorithm: 'HS256', expiresIn: 300}
    );

  afterEach(() => {
    env.QSTASH_CURRENT_SIGNING_KEY = undefined;
  });

  it('refuses unsigned or wrongly signed deliveries', async () => {
    env.QSTASH_CURRENT_SIGNING_KEY = 'signing-key';
    const unsigned = await request(app)
      .post('/api/social-publish/webhook')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(unsigned.status).toBe(401);

    const wrong = await request(app)
      .post('/api/social-publish/webhook')
      .set('Content-Type', 'application/json')
      .set('Upstash-Signature', sign('other-key', body))
      .send(body);
    expect(wrong.status).toBe(401);
  });

  it('accepts a signed delivery without a CSRF token', async () => {
    env.QSTASH_CURRENT_SIGNING_KEY = 'signing-key';
    const res = await request(app)
      .post('/api/social-publish/webhook')
      .set('Content-Type', 'application/json')
      .set('Upstash-Signature', sign('signing-key', body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unknown');
  });
});

describe('helpers', () => {
  it('encrypts tokens at rest', () => {
    const stored = encryptToken('secret-token');
    expect(stored).not.toContain('secret-token');
    expect(decryptToken(stored)).toBe('secret-token');
  });

  it('converts wall-clock time in a zone to UTC, across daylight saving', () => {
    expect(zonedToUtc('2030-07-01', '09:00', 'America/New_York').toISOString()).toBe('2030-07-01T13:00:00.000Z');
    expect(zonedToUtc('2030-01-01', '09:00', 'America/New_York').toISOString()).toBe('2030-01-01T14:00:00.000Z');
  });

  it('appends hashtags that are not already in the caption', () => {
    expect(composeText('Hello #launch', ['launch', '#news'])).toBe('Hello #launch\n\n#news');
  });

  it('escapes LinkedIn reserved characters and keeps hashtags clickable', () => {
    expect(toLittleText('Big (news) #launch_day')).toBe('Big \\(news\\) {hashtag|\\#|launch\\_day}');
  });
});
