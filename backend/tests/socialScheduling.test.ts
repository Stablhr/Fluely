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
import {publishDueJobs, runPublishingJob} from '../api/services/social/publisher.service';
import * as qstash from '../api/services/social/qstash';
import {http} from '../api/services/social/providers/http';
import {composeText} from '../api/services/social/publisher.service';
import {webhookUrl} from '../api/services/social/qstash';
import {zonedToUtc} from '../api/services/social/time';
import {linkedinApiVersion, toLittleText} from '../api/services/social/providers/linkedin';
import {accountsFromPages} from '../api/services/social/providers/meta';
import {explainTikTokError, pickTikTokPrivacy, tiktokProvider} from '../api/services/social/providers/tiktok';
import {ProviderError} from '../api/services/social/providers/types';
import {decryptToken, encryptToken} from '../api/utils/tokenCrypto';
import {hashToken} from '../api/utils/crypto';

jest.setTimeout(30_000);

// These tests describe a fresh setup: no platform app keys, every platform in
// dry-run. A developer's own backend/.env (real keys, LINKEDIN_MODE=live) must
// not leak in -- it changes behaviour and could reach real platform APIs.
const PLATFORM_SETTINGS = [
  'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_MODE', 'LINKEDIN_ORGANIZATIONS', 'LINKEDIN_API_VERSION',
  'META_APP_ID', 'META_APP_SECRET', 'META_LOGIN_CONFIG_ID', 'FACEBOOK_MODE',
  'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_MODE', 'TIKTOK_REDIRECT_BASE',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'YOUTUBE_MODE',
  'QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY'
] as const;
for (const key of PLATFORM_SETTINGS) (env as Record<string, unknown>)[key] = undefined;
(env as Record<string, unknown>).LINKEDIN_ORGANIZATIONS = false;

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
  platformCompat: ['facebook', 'linkedin']
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
      {...draft('local-1', ['facebook']), status: 'scheduled'},
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
  it('refuses a real connection when the platform has no app keys', async () => {
    const owner = await member();
    const res = await as(owner.userId).post('/api/social-accounts/connect/linkedin');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLATFORM_NOT_CONFIGURED');
    expect(await SocialAccountModel.countDocuments()).toBe(0);
  });

  it('creates a demo account only when asked', async () => {
    const owner = await member();
    const res = await as(owner.userId).post('/api/social-accounts/connect/linkedin', {demo: true});
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

  it('returns to the allowed app address the sign-in started from', async () => {
    const owner = await member();
    const saved = {id: env.LINKEDIN_CLIENT_ID, secret: env.LINKEDIN_CLIENT_SECRET, cors: env.CORS_ORIGINS};
    env.LINKEDIN_CLIENT_ID = 'client-id';
    env.LINKEDIN_CLIENT_SECRET = 'client-secret';
    env.CORS_ORIGINS = 'http://localhost:3001,http://localhost:3000';
    try {
      const start = (origin: string) =>
        as(owner.userId).post('/api/social-accounts/connect/linkedin', {returnTo: 'settings'}).set('Origin', origin);
      const finish = async (res: request.Response) => {
        const state = new URL(res.body.url).searchParams.get('state')!;
        const cb = await request(app).get(
          `/api/social-accounts/oauth/linkedin/callback?error=user_cancelled&state=${encodeURIComponent(state)}`
        );
        return cb.headers.location as string;
      };
      expect(await finish(await start('http://localhost:3000'))).toMatch(/^http:\/\/localhost:3000\/settings\?/);
      // An address outside the allow-list never becomes a redirect target.
      expect(await finish(await start('https://evil.example'))).toMatch(
        new RegExp(`^${env.FRONTEND_URL.replace(/\/+$/, '')}/settings\\?`)
      );
    } finally {
      env.LINKEDIN_CLIENT_ID = saved.id;
      env.LINKEDIN_CLIENT_SECRET = saved.secret;
      env.CORS_ORIGINS = saved.cors;
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

  it('asks Facebook only for Page permissions, or uses a login configuration', async () => {
    const owner = await member();
    const saved = {id: env.META_APP_ID, secret: env.META_APP_SECRET, config: env.META_LOGIN_CONFIG_ID};
    env.META_APP_ID = 'app-id';
    env.META_APP_SECRET = 'app-secret';
    try {
      const res = await as(owner.userId).post('/api/social-accounts/connect/facebook');
      const url = new URL(res.body.url);
      expect(url.hostname).toBe('www.facebook.com');
      const scope = url.searchParams.get('scope') ?? '';
      expect(scope).toContain('pages_manage_posts');
      expect(scope).not.toContain('instagram');

      env.META_LOGIN_CONFIG_ID = 'cfg-123';
      const withConfig = new URL((await as(owner.userId).post('/api/social-accounts/connect/facebook')).body.url);
      expect(withConfig.searchParams.get('config_id')).toBe('cfg-123');
      expect(withConfig.searchParams.get('scope')).toBeNull();
    } finally {
      env.META_APP_ID = saved.id;
      env.META_APP_SECRET = saved.secret;
      env.META_LOGIN_CONFIG_ID = saved.config;
    }
  });

  it('lets only the connector or the workspace owner disconnect', async () => {
    const owner = await member();
    const teammate = await member(owner.workspaceId);
    const connected = await as(owner.userId).post('/api/social-accounts/connect/facebook', {demo: true});
    const id = connected.body.account.id;
    expect((await as(teammate.userId).del(`/api/social-accounts/${id}`)).status).toBe(403);
    expect((await as(owner.userId).del(`/api/social-accounts/${id}`)).status).toBe(204);
  });
});

describe('scheduling and publishing (dry run)', () => {
  it('reports platforms that cannot be scheduled and queues the rest', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin', {demo: true});
    await api.post('/api/social-posts', draft('p1', ['linkedin', 'facebook', 'tiktok']));

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
    expect(byPlatform.facebook.join(' ')).toMatch(/Connect a Facebook account/);
    expect(byPlatform.tiktok.join(' ')).toMatch(/video/);
    expect(res.body.post.status).toBe('scheduled');
  });

  it('posts to the account picked for a platform when several are connected', async () => {
    const owner = await member();
    const api = as(owner.userId);
    const [first, second] = await SocialAccountModel.create(
      ['Page One', 'Page Two'].map((name, i) => ({
        workspaceId: owner.workspaceId,
        platform: 'facebook',
        platformAccountId: `page-${i}`,
        accountType: 'page',
        accountName: name,
        accessTokenEnc: 'unused',
        demo: true,
        connectedBy: owner.userId
      }))
    );
    const post = draft('pick', ['facebook']);
    post.platforms[0] = {...post.platforms[0], accountId: second._id.toString()} as typeof post.platforms[0];
    await api.post('/api/social-posts', post);
    await api.post('/api/social-posts/pick/schedule', {scheduledDate: '2030-01-01', scheduledTime: '10:00'});

    const job = await PublishingJobModel.findOne({socialPostId: 'pick'});
    expect(job?.accountId?.toString()).toBe(second._id.toString());
    expect(job?.accountId?.toString()).not.toBe(first._id.toString());
  });

  it('publishes a due post through the sweep and records the simulated result', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin', {demo: true});
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
    await api.post('/api/social-accounts/connect/linkedin', {demo: true});
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
    await api.post('/api/social-accounts/connect/linkedin', {demo: true});
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

  it('keeps one live job per platform when two schedules race, and refuses to reschedule mid-publish', async () => {
    await PublishingJobModel.createIndexes();
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin', {demo: true});
    await api.post('/api/social-posts', draft('race', ['linkedin']));

    const body = {scheduledDate: '2030-03-01', scheduledTime: '10:00'};
    const results = await Promise.all([
      api.post('/api/social-posts/race/schedule', body),
      api.post('/api/social-posts/race/schedule', body)
    ]);
    for (const res of results) expect([200, 409]).toContain(res.status);
    expect(await PublishingJobModel.countDocuments({socialPostId: 'race', status: 'queued'})).toBe(1);

    await PublishingJobModel.updateOne({socialPostId: 'race', status: 'queued'}, {$set: {status: 'publishing'}});
    const again = await api.post('/api/social-posts/race/schedule', body);
    expect(again.status).toBe(409);
    expect(await PublishingJobModel.countDocuments({socialPostId: 'race', status: {$in: ['queued', 'publishing']}})).toBe(1);
  });

  it('marks a job cut off mid-publish as failed instead of publishing it again', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin', {demo: true});
    await api.post('/api/social-posts', draft('cut', ['linkedin']));
    await api.post('/api/social-posts/cut/schedule', {scheduledDate: '2020-01-01'});
    // The function died after the platform call: the job is still "publishing" 20 minutes later.
    await PublishingJobModel.updateOne(
      {socialPostId: 'cut'},
      {$set: {status: 'publishing', lockedAt: new Date(Date.now() - 20 * 60_000)}}
    );

    await publishDueJobs();

    const job = await PublishingJobModel.findOne({socialPostId: 'cut'});
    expect(job?.status).toBe('failed');
    expect(job?.errorCode).toBe('INTERRUPTED');
    const post = (await api.get('/api/social-posts/cut')).body.post;
    expect(post.status).toBe('failed');
    expect(post.platforms[0].error).toMatch(/may already be live/);
    expect(post.platforms[0].externalPostId).toBeUndefined();
  });

  it('keeps the published result when a "post now" job finishes before scheduling returns', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin', {demo: true});
    await api.post('/api/social-posts', draft('now', ['linkedin']));
    // QStash delivering instantly: the job runs inside the enqueue call.
    const spy = jest.spyOn(qstash, 'enqueuePublish').mockImplementation(async jobId => {
      await runPublishingJob(jobId);
      return null;
    });
    try {
      await api.post('/api/social-posts/now/schedule', {scheduledDate: '2020-01-01'});
    } finally {
      spy.mockRestore();
    }
    const post = (await api.get('/api/social-posts/now')).body.post;
    expect(post.status).toBe('posted');
    expect(post.platforms[0].status).toBe('posted');
  });

  it('keeps sweeping until nothing is due', async () => {
    const owner = await member();
    const api = as(owner.userId);
    await api.post('/api/social-accounts/connect/linkedin', {demo: true});
    for (let i = 0; i < 3; i += 1) {
      await api.post('/api/social-posts', draft(`many-${i}`, ['linkedin']));
      await api.post(`/api/social-posts/many-${i}/schedule`, {scheduledDate: '2020-01-01'});
    }
    // A batch of 2 used to leave the third job for the next day's run.
    const result = await publishDueJobs(2);
    expect(result.processed).toBe(3);
    expect(await PublishingJobModel.countDocuments({status: 'completed'})).toBe(3);
  });
});

describe('platform requests', () => {
  it('does not retry a post-creating request that timed out', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('This operation was aborted')));
      });
      return new Response();
    });
    try {
      const create = http('https://api.example.test/posts', {method: 'POST', createsPost: true, timeoutMs: 10});
      await expect(create).rejects.toMatchObject({code: 'OUTCOME_UNKNOWN', retryable: false});
      const refresh = http('https://api.example.test/token', {method: 'POST', timeoutMs: 10});
      await expect(refresh).rejects.toMatchObject({code: 'NETWORK_ERROR', retryable: true});
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('reminder accounts (post it yourself)', () => {
  it('hands the post back at its time, then records it as posted by hand', async () => {
    const owner = await member();
    const api = as(owner.userId);
    const added = await api.post('/api/social-accounts/reminder/facebook', {name: 'My personal profile'});
    expect(added.status).toBe(201);
    expect(added.body.account).toMatchObject({accountType: 'reminder', accountName: 'My personal profile', demo: false});

    const post = draft('mine', ['facebook']);
    post.platforms[0] = {...post.platforms[0], accountId: added.body.account.id} as typeof post.platforms[0];
    await api.post('/api/social-posts', post);
    const scheduled = await api.post('/api/social-posts/mine/schedule', {scheduledDate: '2020-01-01', scheduledTime: '09:00'});
    expect(scheduled.body.jobsCreated).toHaveLength(1);

    await publishDueJobs();
    let saved = (await api.get('/api/social-posts/mine')).body.post;
    expect(saved.platforms[0].status).toBe('reminder');
    expect(saved.platforms[0].externalPostId).toBeUndefined();
    expect(saved.status).toBe('scheduled');

    const marked = await api.post('/api/social-posts/mine/mark-posted', {
      platform: 'facebook',
      url: 'https://www.facebook.com/me/posts/1'
    });
    expect(marked.status).toBe(200);
    saved = marked.body.post;
    expect(saved.status).toBe('posted');
    expect(saved.platforms[0]).toMatchObject({status: 'posted', manual: true, publishedUrl: 'https://www.facebook.com/me/posts/1'});

    // Marking twice is refused.
    expect((await api.post('/api/social-posts/mine/mark-posted', {platform: 'facebook'})).status).toBe(409);
  });

  it('skips the platform API content rules for a hand-posted target', async () => {
    const owner = await member();
    const api = as(owner.userId);
    const added = await api.post('/api/social-accounts/reminder/youtube', {name: 'My channel'});
    const post = draft('text-only', ['youtube']);
    post.platforms[0] = {...post.platforms[0], accountId: added.body.account.id} as typeof post.platforms[0];
    await api.post('/api/social-posts', post);
    // YouTube's API needs a video; posting by hand does not.
    const res = await api.post('/api/social-posts/text-only/schedule', {scheduledDate: '2030-01-01'});
    expect(res.body.validation[0]).toMatchObject({platform: 'youtube', valid: true});
  });
});

describe('TikTok https redirect', () => {
  afterEach(() => {
    (env as Record<string, unknown>).TIKTOK_REDIRECT_BASE = undefined;
  });

  it('uses the tunnel address for TikTok only', async () => {
    const {redirectUriFor} = await import('../api/services/social/accounts.service');
    (env as Record<string, unknown>).TIKTOK_REDIRECT_BASE = 'https://fluely.example.app';
    expect(redirectUriFor('tiktok')).toBe('https://fluely.example.app/api/social-accounts/oauth/tiktok/callback');
    expect(redirectUriFor('linkedin')).toBe(`${env.API_PUBLIC_URL}/api/social-accounts/oauth/linkedin/callback`);
  });

  it('sends a callback without the sign-in cookie on to the backend address', async () => {
    const {callbackBounceUrl} = await import('../api/services/social/accounts.service');
    const path = '/api/social-accounts/oauth/tiktok/callback?code=abc&state=xyz';
    const home = new URL(env.API_PUBLIC_URL).host;
    expect(callbackBounceUrl('fluely.example.app', path, false)).toBeNull();
    (env as Record<string, unknown>).TIKTOK_REDIRECT_BASE = 'https://fluely.example.app';
    expect(callbackBounceUrl('fluely.example.app', path, false)).toBe(`${env.API_PUBLIC_URL}${path}`);
    expect(callbackBounceUrl('fluely.example.app', path, true)).toBeNull();
    expect(callbackBounceUrl(home, path, false)).toBeNull();
    expect(callbackBounceUrl('other.example.com', path, false)).toBeNull();
  });
});

describe('TikTok posting rules', () => {
  it('posts privately when the wanted privacy is not allowed for this creator', () => {
    expect(pickTikTokPrivacy('PUBLIC_TO_EVERYONE', ['SELF_ONLY'])).toBe('SELF_ONLY');
    expect(pickTikTokPrivacy('PUBLIC_TO_EVERYONE', ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'])).toBe('PUBLIC_TO_EVERYONE');
    expect(pickTikTokPrivacy('SELF_ONLY', ['PUBLIC_TO_EVERYONE'])).toBeNull();
  });

  it('explains the unaudited-app refusal in plain language', () => {
    const raw = new ProviderError('TikTok: Please review our integration guidelines [unaudited_client_can_only_post_to_private_accounts] (HTTP 403)', 'FORBIDDEN', false);
    const explained = explainTikTokError(raw) as ProviderError;
    expect(explained.message).toMatch(/Set the TikTok account to private/);
    expect(explained.retryable).toBe(false);
  });

  it('asks for creator info, uploads the video and checks the result', async () => {
    const calls: {url: string; body?: string}[] = [];
    const reply = (body: object) => new Response(JSON.stringify(body), {status: 200});
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({url, body: typeof init?.body === 'string' ? init.body : undefined});
      if (url.includes('creator_info')) {
        return reply({data: {privacy_level_options: ['SELF_ONLY'], comment_disabled: true, max_video_post_duration_sec: 600}, error: {code: 'ok'}});
      }
      if (url.includes('cloudinary')) return new Response(new Uint8Array(1024), {status: 200, headers: {'content-type': 'video/mp4'}});
      if (url.includes('/video/init/')) return reply({data: {publish_id: 'v_pub_1', upload_url: 'https://upload.tiktok.test/x'}, error: {code: 'ok'}});
      if (url.includes('upload.tiktok.test')) return new Response(null, {status: 201});
      if (url.includes('status/fetch')) return reply({data: {status: 'PUBLISH_COMPLETE'}, error: {code: 'ok'}});
      throw new Error(`unexpected ${url}`);
    });
    try {
      const result = await tiktokProvider.publish({
        account: {platformAccountId: 'open-1', accountType: 'creator', accessToken: 'tok'},
        content: {
          title: 'Clip',
          text: 'Caption',
          hashtags: [],
          visibility: 'public',
          media: [{id: 'v', type: 'video', name: 'v.mp4', storageUrl: 'https://res.cloudinary.com/demo/video/upload/v.mp4', size: 1024, duration: 30, platformCompat: []}]
        }
      });
      expect(result.externalPostId).toBe('v_pub_1');
      expect(calls[0].url).toContain('/post/publish/creator_info/query/');
      const init = JSON.parse(calls.find(c => c.url.includes('/video/init/'))!.body!);
      // Only what this creator allows is used, and their own settings are respected.
      expect(init.post_info.privacy_level).toBe('SELF_ONLY');
      expect(init.post_info.disable_comment).toBe(true);
      expect(init.source_info).toMatchObject({source: 'FILE_UPLOAD', video_size: 1024, chunk_size: 1024, total_chunk_count: 1});
    } finally {
      fetchSpy.mockRestore();
    }
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

  it('turns a Facebook sign-in into one account per shared Page, posting with its Page token', () => {
    const pages = [
      {id: 'p1', name: 'Page One', access_token: 'tok1'},
      {id: 'p2', name: 'Page Two', access_token: 'tok2'}
    ];
    const accounts = accountsFromPages(pages, ['pages_manage_posts']);
    expect(accounts.map(a => [a.platformAccountId, a.accountName, a.accountType, a.token.accessToken])).toEqual([
      ['p1', 'Page One', 'page', 'tok1'],
      ['p2', 'Page Two', 'page', 'tok2']
    ]);
  });

  it('picks a LinkedIn API version two months back, across the new year', () => {
    expect(linkedinApiVersion(new Date('2026-11-19T12:00:00Z'))).toBe('202609');
    expect(linkedinApiVersion(new Date('2027-01-05T12:00:00Z'))).toBe('202611');
    expect(linkedinApiVersion(new Date('2027-02-28T12:00:00Z'))).toBe('202612');
  });

  it('escapes LinkedIn reserved characters and keeps hashtags clickable', () => {
    expect(toLittleText('Big (news) #launch_day')).toBe('Big \\(news\\) {hashtag|\\#|launch\\_day}');
  });
});
