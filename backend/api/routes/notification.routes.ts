import {Router} from 'express';
import {notificationController} from '../controllers/notification.controller';
import {validateRequest} from '../middleware/validation';
import {requireAuth, requireUser} from '../middleware/auth';
import {authActionLimiter, authReadLimiter} from '../middleware/rateLimit';
import {notificationIdParamsSchema} from '../dtos/product.dto';

const router = Router();

router.use(requireAuth, requireUser);

// ── The signed-in person's notifications ─────────────────────────
router.get('/', authReadLimiter, notificationController.list);

router.post('/read-all', authActionLimiter, notificationController.markAllRead);

router.post(
  '/:notificationId/read',
  authActionLimiter,
  validateRequest({params: notificationIdParamsSchema}),
  notificationController.markRead
);

export default router;
