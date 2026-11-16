import {NextFunction, Request, Response} from 'express';
import {env} from '../config/env';
import {ErrorCodes} from '../constants/errorCodes';
import {SchedulablePlatform} from '../constants/social';
import {OAUTH_COOKIE, oauthCookieOptions, socialAccountService} from '../services/social/accounts.service';
import {socialPostService} from '../services/social/posts.service';
import {publishDueJobs, runPublishingJob} from '../services/social/publisher.service';
import {verifyQstashSignature} from '../services/social/qstash';
import {actorFromRequest} from '../utils/actor';
import {ApiError} from '../utils/error';

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap =
  (handler: Handler) =>
  (req: Request, res: Response, next: NextFunction) =>
    handler(req, res).catch(next);

const platformOf = (req: Request) => req.params.platform as SchedulablePlatform;

export const socialAccountController = {
  platforms: wrap(async (_req, res) => {
    res.status(200).json({platforms: socialAccountService.platforms()});
  }),

  list: wrap(async (req, res) => {
    res.status(200).json({accounts: await socialAccountService.list(actorFromRequest(req))});
  }),

  connect: wrap(async (req, res) => {
    const result = await socialAccountService.startConnect(
      actorFromRequest(req),
      platformOf(req),
      req.body?.returnTo
    );
    if (result.demo) {
      res.status(201).json({demo: true, account: result.account});
      return;
    }
    res.cookie(OAUTH_COOKIE, result.nonce, oauthCookieOptions());
    res.status(200).json({demo: false, url: result.url});
  }),

  callback: wrap(async (req, res) => {
    const nonce = req.cookies?.[OAUTH_COOKIE] as string | undefined;
    const target = await socialAccountService.finishConnect(platformOf(req), req.query, nonce);
    res.clearCookie(OAUTH_COOKIE, {...oauthCookieOptions(), maxAge: undefined});
    res.redirect(302, target);
  }),

  disconnect: wrap(async (req, res) => {
    await socialAccountService.disconnect(actorFromRequest(req), req.params.id);
    res.status(204).end();
  })
};

export const socialPostController = {
  list: wrap(async (req, res) => {
    res.status(200).json({posts: await socialPostService.list(actorFromRequest(req), req.query)});
  }),

  get: wrap(async (req, res) => {
    res.status(200).json({post: await socialPostService.get(actorFromRequest(req), req.params.id)});
  }),

  create: wrap(async (req, res) => {
    res.status(201).json({post: await socialPostService.create(actorFromRequest(req), req.body)});
  }),

  importPosts: wrap(async (req, res) => {
    res.status(200).json(await socialPostService.importPosts(actorFromRequest(req), req.body.posts));
  }),

  update: wrap(async (req, res) => {
    res.status(200).json({post: await socialPostService.update(actorFromRequest(req), req.params.id, req.body)});
  }),

  remove: wrap(async (req, res) => {
    await socialPostService.remove(actorFromRequest(req), req.params.id);
    res.status(204).end();
  }),

  schedule: wrap(async (req, res) => {
    res.status(200).json(await socialPostService.schedule(actorFromRequest(req), req.params.id, req.body));
  }),

  cancel: wrap(async (req, res) => {
    res.status(200).json(await socialPostService.cancel(actorFromRequest(req), req.params.id, req.body.platform));
  }),

  retry: wrap(async (req, res) => {
    res.status(200).json(await socialPostService.retry(actorFromRequest(req), req.params.id, req.body.platform));
  }),

  jobs: wrap(async (req, res) => {
    res.status(200).json({jobs: await socialPostService.listJobs(actorFromRequest(req), req.query)});
  })
};

export const socialPublishController = {
  /** QStash delivery. Only signed requests are accepted. */
  webhook: wrap(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    if (!verifyQstashSignature(req.header('upstash-signature'), raw)) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid signature');
    }
    let jobId = '';
    try {
      jobId = String((JSON.parse(raw.toString('utf8')) as {jobId?: unknown}).jobId ?? '');
    } catch {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid body');
    }
    res.status(200).json(await runPublishingJob(jobId));
  }),

  /** Safety-net sweep, called by a cron with `Authorization: Bearer <CRON_SECRET>`. */
  publishDue: wrap(async (req, res) => {
    // Open only in local development, where no secret is set.
    const allowed = env.CRON_SECRET
      ? req.headers.authorization === `Bearer ${env.CRON_SECRET}`
      : env.NODE_ENV !== 'production';
    if (!allowed) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid cron secret');
    }
    res.status(200).json({success: true, ...(await publishDueJobs())});
  })
};
