import {Router} from 'express';
import {realtimeController} from '../controllers/realtime.controller';
import {validateRequest} from '../middleware/validation';
import {requireAuth, requireUser} from '../middleware/auth';
import {defaultLimiter} from '../middleware/rateLimit';
import {realtimeAuthSchema} from '../dtos/product.dto';

const router = Router();

router.use(requireAuth, requireUser);

/**
 * The endpoint pusher-js calls when a socket first joins a private/presence
 * channel. Two calls per board (data channel + presence channel) on subscribe,
 * nothing thereafter — so the read limiter rather than the stricter auth one.
 */
router.post(
  '/auth',
  defaultLimiter,
  validateRequest({body: realtimeAuthSchema}),
  realtimeController.authorize
);

export default router;
