import {Router} from 'express';
import {boardCollaboratorController} from '../controllers/boardCollaborator.controller';
import {validateRequest} from '../middleware/validation';
import {requireAuth, requireUser} from '../middleware/auth';
import {authActionLimiter, authReadLimiter} from '../middleware/rateLimit';
import {z} from 'zod';

const router = Router();

router.use(requireAuth, requireUser);

const tokenParamsSchema = z.object({token: z.string().min(10).max(200)});

const respondSchema = z.object({
  decision: z.enum(['accepted', 'declined'])
});

router.get(
  '/:token',
  authReadLimiter,
  validateRequest({params: tokenParamsSchema}),
  boardCollaboratorController.getByToken
);

router.post(
  '/:token/respond',
  authActionLimiter,
  validateRequest({params: tokenParamsSchema, body: respondSchema}),
  boardCollaboratorController.respondByToken
);

export default router;
