import Router from 'express';
import authRoutes from './auth.routes';
import mediaRoutes from './media.routes';
import workspaceRoutes from './workspace.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/media', mediaRoutes);
router.use('/workspaces', workspaceRoutes);

export default router;
