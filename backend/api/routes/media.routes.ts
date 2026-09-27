import {Router} from 'express';
import {mediaController} from '../controllers/media.controller';
import {validateRequest} from '../middleware/validation';
import {requireAuth, requireUser} from '../middleware/auth';
import {authActionLimiter, authReadLimiter, uploadLimiter} from '../middleware/rateLimit';
import {handleUploadErrors, uploadMedia} from '../middleware/upload';
import {mediaIdParamsSchema, mediaListQuerySchema} from '../dtos/product.dto';

const router = Router();

// every media route belongs to a user account
router.use(requireAuth, requireUser);

router.post(
  '/',
  uploadLimiter,
  handleUploadErrors,
  uploadMedia.array('files', 10),
  mediaController.upload
);

router.get(
  '/',
  authReadLimiter,
  validateRequest({query: mediaListQuerySchema}),
  mediaController.list
);

router.delete(
  '/:mediaId',
  authActionLimiter,
  validateRequest({params: mediaIdParamsSchema}),
  mediaController.remove
);

export default router;
