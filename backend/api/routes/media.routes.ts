import {Router} from 'express';
import {mediaController} from '../controllers/media.controller';
import {validateRequest} from '../middleware/validation';
import {requireAuth, requireUser} from '../middleware/auth';
import {authActionLimiter, authReadLimiter, uploadLimiter} from '../middleware/rateLimit';
import {handleUploadErrors, uploadMedia} from '../middleware/upload';
import {mediaIdParamsSchema, mediaListQuerySchema, mediaSignatureSchema, mediaRegisterSchema} from '../dtos/product.dto';

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

// The signature/register pair backs a direct-to-Cloudinary upload. They are
// cheap JSON calls, so they use the general write budget rather than the
// tighter upload budget the proxied upload spends.
router.post(
  '/signature',
  authActionLimiter,
  validateRequest({body: mediaSignatureSchema}),
  mediaController.signature
);

router.post(
  '/register',
  authActionLimiter,
  validateRequest({body: mediaRegisterSchema}),
  mediaController.register
);

export default router;
