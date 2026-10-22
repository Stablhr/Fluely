import Router from 'express';
import authRoutes from './auth.routes';
import accountRoutes from './account.routes';
import boardRoutes from './board.routes';
import invitationRoutes from './invitation.routes';
import mediaRoutes from './media.routes';
import notificationRoutes from './notification.routes';
import workspaceRoutes from './workspace.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/account', accountRoutes);
router.use('/boards', boardRoutes);
router.use('/invitations', invitationRoutes);
router.use('/media', mediaRoutes);
router.use('/notifications', notificationRoutes);
router.use('/workspaces', workspaceRoutes);

export default router;
