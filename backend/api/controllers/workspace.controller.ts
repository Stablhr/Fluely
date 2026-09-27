import {NextFunction, Request, Response} from 'express';
import {workspaceService} from '../services/workspace.service';
import {actorFromRequest} from '../utils/actor';

export const workspaceController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(201).json(await workspaceService.create(actor.actorId, req.body.name));
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json({workspaces: await workspaceService.listForUser(actor.actorId)});
    } catch (error) {
      next(error);
    }
  },

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(await workspaceService.detail(actor.actorId, req.params.workspaceId));
    } catch (error) {
      next(error);
    }
  },

  async rename(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(
        await workspaceService.rename(actor.actorId, req.params.workspaceId, req.body.name)
      );
    } catch (error) {
      next(error);
    }
  },

  async listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json({
        members: await workspaceService.listMembers(actor.actorId, req.params.workspaceId)
      });
    } catch (error) {
      next(error);
    }
  },

  async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(201).json(
        await workspaceService.addMember(
          actor.actorId,
          req.params.workspaceId,
          req.body.email
        )
      );
    } catch (error) {
      next(error);
    }
  },

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(
        await workspaceService.removeMember(
          actor.actorId,
          req.params.workspaceId,
          req.params.userId
        )
      );
    } catch (error) {
      next(error);
    }
  },

  async join(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(await workspaceService.join(actor.actorId, req.body.code));
    } catch (error) {
      next(error);
    }
  }
};
