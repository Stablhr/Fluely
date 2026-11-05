import {Router} from 'express';
import {linkPreviewController} from '../controllers/linkPreview.controller';
import {validateRequest} from '../middleware/validation';
import {requireAuth, requireUser} from '../middleware/auth';
import {linkPreviewLimiter} from '../middleware/rateLimit';
import {linkPreviewQuerySchema} from '../dtos/product.dto';

const router = Router();

// Every unfurl is a third-party request, so it is always tied to an account.
router.use(requireAuth, requireUser);

router.get(
  '/resolve',
  linkPreviewLimiter,
  validateRequest({query: linkPreviewQuerySchema}),
  linkPreviewController.resolve
);

export default router;
