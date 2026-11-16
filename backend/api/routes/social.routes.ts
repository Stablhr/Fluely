import express, {Router} from 'express';
import {
  socialAccountController,
  socialPostController,
  socialPublishController
} from '../controllers/social.controller';
import {
  accountIdParamsSchema,
  connectBodySchema,
  jobListQuerySchema,
  oauthCallbackQuerySchema,
  platformBodySchema,
  platformParamsSchema,
  postCreateSchema,
  postIdParamsSchema,
  postImportSchema,
  postListQuerySchema,
  postPatchSchema,
  scheduleSchema
} from '../dtos/social.dto';
import {requireAuth, requireUser} from '../middleware/auth';
import {authActionLimiter, authReadLimiter} from '../middleware/rateLimit';
import {validateRequest} from '../middleware/validation';

/* ── /api/social-accounts ─────────────────────────────────────── */

export const socialAccountRoutes = Router();

// The platform redirects the browser here, so it carries no session header;
// the signed `state` and the nonce cookie identify the connect attempt.
socialAccountRoutes.get(
  '/oauth/:platform/callback',
  authReadLimiter,
  validateRequest({params: platformParamsSchema, query: oauthCallbackQuerySchema}),
  socialAccountController.callback
);

socialAccountRoutes.use(requireAuth, requireUser);
socialAccountRoutes.get('/platforms', authReadLimiter, socialAccountController.platforms);
socialAccountRoutes.get('/', authReadLimiter, socialAccountController.list);
socialAccountRoutes.post(
  '/connect/:platform',
  authActionLimiter,
  validateRequest({params: platformParamsSchema, body: connectBodySchema}),
  socialAccountController.connect
);
socialAccountRoutes.delete(
  '/:id',
  authActionLimiter,
  validateRequest({params: accountIdParamsSchema}),
  socialAccountController.disconnect
);

/* ── /api/social-posts ────────────────────────────────────────── */

export const socialPostRoutes = Router();
socialPostRoutes.use(requireAuth, requireUser);

socialPostRoutes.get(
  '/',
  authReadLimiter,
  validateRequest({query: postListQuerySchema}),
  socialPostController.list
);
socialPostRoutes.post(
  '/',
  authActionLimiter,
  validateRequest({body: postCreateSchema}),
  socialPostController.create
);
socialPostRoutes.post(
  '/import',
  authActionLimiter,
  validateRequest({body: postImportSchema}),
  socialPostController.importPosts
);
socialPostRoutes.get(
  '/:id',
  authReadLimiter,
  validateRequest({params: postIdParamsSchema}),
  socialPostController.get
);
socialPostRoutes.put(
  '/:id',
  authActionLimiter,
  validateRequest({params: postIdParamsSchema, body: postPatchSchema}),
  socialPostController.update
);
socialPostRoutes.delete(
  '/:id',
  authActionLimiter,
  validateRequest({params: postIdParamsSchema}),
  socialPostController.remove
);
socialPostRoutes.post(
  '/:id/schedule',
  authActionLimiter,
  validateRequest({params: postIdParamsSchema, body: scheduleSchema}),
  socialPostController.schedule
);
socialPostRoutes.post(
  '/:id/cancel',
  authActionLimiter,
  validateRequest({params: postIdParamsSchema, body: platformBodySchema}),
  socialPostController.cancel
);
socialPostRoutes.post(
  '/:id/retry',
  authActionLimiter,
  validateRequest({params: postIdParamsSchema, body: platformBodySchema}),
  socialPostController.retry
);

/* ── /api/publishing-jobs ─────────────────────────────────────── */

export const publishingJobRoutes = Router();
publishingJobRoutes.use(requireAuth, requireUser);
publishingJobRoutes.get(
  '/',
  authReadLimiter,
  validateRequest({query: jobListQuerySchema}),
  socialPostController.jobs
);

/* ── /api/social-publish (QStash; mounted ahead of JSON parsing and CSRF) ── */

export const socialPublishRoutes = Router();
// The signature covers the exact bytes, so the body stays raw.
socialPublishRoutes.post(
  '/webhook',
  express.raw({type: '*/*', limit: '16kb'}),
  socialPublishController.webhook
);

export const publishDueHandler = socialPublishController.publishDue;
