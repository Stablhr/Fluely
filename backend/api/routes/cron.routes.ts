import { Router } from 'express';
import { cronController } from '../controllers/cron.controller';

const router = Router();

// Vercel cron sends GET requests, so this must be a GET route.
router.get('/cleanup-done-cards', cronController.cleanupDoneCards);

export default router;
