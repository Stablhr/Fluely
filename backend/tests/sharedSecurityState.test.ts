import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import {MongoMemoryServer} from 'mongodb-memory-server-core';

jest.mock('../api/repositories/user.repository', () => ({
  userRepository: {
    findById: jest.fn(async (id: string) => ({id, isVerified: true}))
  }
}));

import {blocklistService} from '../api/services/blocklist.service';
import {authService} from '../api/services/auth.service';
import {env} from '../api/config/env';
import {RevokedTokenModel} from '../api/models/RevokedToken.model';
import {RateLimitCounterModel} from '../api/models/RateLimitCounter.model';
import {MongoRateLimitStore} from '../api/middleware/rateLimitStore';
import {hashToken} from '../api/utils/crypto';

/**
 * Refresh-token revocation and the security rate limits used to live in process
 * memory, which on Vercel meant each instance had its own copy. These tests run
 * against a real (in-memory) MongoDB to prove the state is shared: anything one
 * "instance" writes, a fresh store or service call sees.
 */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([RevokedTokenModel.init(), RateLimitCounterModel.init()]);
}, 120_000);

afterEach(async () => {
  await Promise.all([RevokedTokenModel.deleteMany({}), RateLimitCounterModel.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

function refreshTokenFor(userId: string): string {
  return jwt.sign({userId, type: 'user'}, env.JWT_REFRESH_SECRET, {
    expiresIn: 60 * 60,
    jwtid: hashToken(String(Math.random()))
  });
}

describe('refresh-token blocklist', () => {
  it('stores only a hash of the token, expiring with the token', async () => {
    const token = refreshTokenFor('u1');
    await blocklistService.revoke(token);

    const rows = await RevokedTokenModel.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(hashToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);

    const {exp} = jwt.decode(token) as {exp: number};
    expect(rows[0].expiresAt.getTime()).toBe(exp * 1000);
  });

  it('reports revoked tokens and ignores others', async () => {
    const revoked = refreshTokenFor('u1');
    const other = refreshTokenFor('u2');
    await blocklistService.revoke(revoked);

    await expect(blocklistService.isRevoked(revoked)).resolves.toBe(true);
    await expect(blocklistService.isRevoked(other)).resolves.toBe(false);
  });

  it('treats revoking twice as a no-op', async () => {
    const token = refreshTokenFor('u1');
    await blocklistService.revoke(token);
    await blocklistService.revoke(token);
    expect(await RevokedTokenModel.countDocuments()).toBe(1);
  });

  it('falls back to a full session lifetime for a token without exp', async () => {
    await blocklistService.revoke('not-a-jwt');
    const row = await RevokedTokenModel.findById(hashToken('not-a-jwt')).lean();
    expect(row?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a refresh token after it has been rotated', async () => {
    const token = refreshTokenFor('u1');
    const rotated = await authService.refreshAccessToken(token);
    expect(rotated.refreshToken).not.toBe(token);

    await expect(authService.refreshAccessToken(token)).rejects.toMatchObject({statusCode: 401});
  });

  it('issues distinct refresh tokens even within the same second', async () => {
    const first = await authService.refreshAccessToken(refreshTokenFor('u1'));
    const second = await authService.refreshAccessToken(refreshTokenFor('u1'));
    expect(first.refreshToken).not.toBe(second.refreshToken);

    // Rotating one must leave the other usable.
    await authService.refreshAccessToken(first.refreshToken);
    await expect(authService.refreshAccessToken(second.refreshToken)).resolves.toBeDefined();
  });

  it('rejects a refresh token after logout', async () => {
    const token = refreshTokenFor('u1');
    await authService.logout(token);

    await expect(authService.refreshAccessToken(token)).rejects.toMatchObject({statusCode: 401});
  });
});

describe('MongoRateLimitStore', () => {
  /** Two apps with separate stores stand in for two serverless instances. */
  function instance(max: number, windowMs = 60_000) {
    const app = express();
    app.use(
      rateLimit({
        windowMs,
        max,
        store: new MongoRateLimitStore('test'),
        keyGenerator: () => 'client-1',
        handler: (_req, res) => {
          res.status(429).json({code: 'RATE_LIMIT_EXCEEDED'});
        }
      })
    );
    app.get('/', (_req, res) => {
      res.json({ok: true});
    });
    return app;
  }

  it('shares one budget across instances', async () => {
    const a = instance(3);
    const b = instance(3);

    expect((await request(a).get('/')).status).toBe(200);
    expect((await request(b).get('/')).status).toBe(200);
    expect((await request(a).get('/')).status).toBe(200);
    expect((await request(b).get('/')).status).toBe(429);
    expect((await request(a).get('/')).status).toBe(429);
  });

  it('counts concurrent hits exactly', async () => {
    const a = instance(1000);
    const b = instance(1000);
    await Promise.all(
      Array.from({length: 20}, (_v, i) => request(i % 2 ? a : b).get('/'))
    );

    const row = await RateLimitCounterModel.findById('test:client-1').lean();
    expect(row?.hits).toBe(20);
  });

  it('keeps limiters with different prefixes apart', async () => {
    const store = new MongoRateLimitStore('one');
    const other = new MongoRateLimitStore('two');
    store.init({windowMs: 60_000} as Parameters<MongoRateLimitStore['init']>[0]);
    other.init({windowMs: 60_000} as Parameters<MongoRateLimitStore['init']>[0]);

    await store.increment('k');
    await store.increment('k');
    const result = await other.increment('k');
    expect(result.totalHits).toBe(1);
  });

  it('starts a fresh window once the old one has expired', async () => {
    const store = new MongoRateLimitStore('win');
    store.init({windowMs: 60_000} as Parameters<MongoRateLimitStore['init']>[0]);
    await store.increment('k');
    await store.increment('k');

    // Expire the window without waiting for the TTL sweep.
    await RateLimitCounterModel.updateOne({_id: 'win:k'}, {resetAt: new Date(Date.now() - 1000)});

    const result = await store.increment('k');
    expect(result.totalHits).toBe(1);
    expect(result.resetTime!.getTime()).toBeGreaterThan(Date.now());
  });

  it('supports decrement and reset', async () => {
    const store = new MongoRateLimitStore('dr');
    store.init({windowMs: 60_000} as Parameters<MongoRateLimitStore['init']>[0]);
    await store.increment('k');
    await store.increment('k');
    await store.decrement('k');
    expect((await RateLimitCounterModel.findById('dr:k').lean())?.hits).toBe(1);

    await store.resetKey('k');
    expect(await RateLimitCounterModel.findById('dr:k')).toBeNull();
  });
});
