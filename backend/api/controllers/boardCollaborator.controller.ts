import {NextFunction, Request, Response} from 'express';
import {boardCollaboratorService} from '../services/boardCollaborator.service';
import {actorFromRequest} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {CollaboratorStatus} from '../constants/product';

function requireBoard(req: Request) {
  if (!req.board) {
    throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
  }
  return req.board;
}

export const boardCollaboratorController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        collaborators: await boardCollaboratorService.list(requireBoard(req))
      });
    } catch (error) {
      next(error);
    }
  },

  async invite(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(201).json({
        collaborator: await boardCollaboratorService.invite(
          actor,
          requireBoard(req),
          req.body.email,
          req.body.role
        )
      });
    } catch (error) {
      next(error);
    }
  },

  async setRole(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(
        await boardCollaboratorService.setRole(
          actor,
          requireBoard(req),
          req.params.collaboratorId,
          req.body.role
        )
      );
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(
        await boardCollaboratorService.remove(
          actor,
          requireBoard(req),
          req.params.collaboratorId
        )
      );
    } catch (error) {
      next(error);
    }
  },

  /** Not board-scoped: the invitation id is looked up against the caller. */
  async respond(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(
        await boardCollaboratorService.respond(
          actor,
          req.params.invitationId,
          req.body.decision as CollaboratorStatus
        )
      );
    } catch (error) {
      next(error);
    }
  },

  async listPending(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json({
        invitations: await boardCollaboratorService.listPendingForUser(actor)
      });
    } catch (error) {
      next(error);
    }
  }
};
