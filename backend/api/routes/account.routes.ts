import {Router} from 'express';
import {accountController} from '../controllers/account.controller';
import {requireAuth, requireUser} from '../middleware/auth';
import {authActionLimiter, uploadLimiter} from '../middleware/rateLimit';
import {handleAvatarUploadErrors, uploadAvatar} from '../middleware/upload';

const router = Router();

// profile pictures belong to a user account, never to an admin
router.use(requireAuth, requireUser);

router.post(
  '/me/avatar',
  uploadLimiter,
  handleAvatarUploadErrors,
  uploadAvatar.single('file'),
  accountController.uploadAvatar
);

router.delete('/me/avatar', authActionLimiter, accountController.removeAvatar);

export default router;