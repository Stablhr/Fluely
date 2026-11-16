import { Router } from 'express';
import { cronController } from '../controllers/cron.controller';
import { publishDueHandler } from './social.routes';

const router = Router();

// Vercel cron sends GET requests, so this must be a GET route.
router.get('/cleanup-done-cards', cronController.cleanupDoneCards);

// Safety net behind QStash for scheduled social posts.
router.get('/publish-due', publishDueHandler);

export default router;
