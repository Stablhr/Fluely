import {Router} from 'express';
import {accountController} from '../controllers/account.controller';
import {requireAuth, requireUser} from '../middleware/auth';
import {authActionLimiter, authReadLimiter, uploadLimiter} from '../middleware/rateLimit';
import {handleAvatarUploadErrors, uploadAvatar} from '../middleware/upload';
import {validateRequest} from '../middleware/validation';
import {profilePatchSchema} from '../dtos/product.dto';

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

router.get('/me/profile', authReadLimiter, accountController.getProfile);
router.patch('/me/profile', authActionLimiter, validateRequest({body: profilePatchSchema}), accountController.updateProfile);
router.get('/users/username-available', authReadLimiter, accountController.checkUsernameAvailable);
router.get('/users/:userId/profile', authReadLimiter, accountController.getPublicProfile);

export default router;