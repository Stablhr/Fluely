import {Types} from 'mongoose';
import {boardCollaboratorRepository} from '../repositories/boardCollaborator.repository';
import {notificationRepository} from '../repositories/notification.repository';
import {userRepository} from '../repositories/user.repository';
import {boardRepository} from '../repositories/board.repository';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {Actor} from '../utils/actor';
import {BoardDocument} from '../models/Board.model';
import {CollaboratorRole, CollaboratorStatus} from '../constants/product';
import {notificationService} from './notification.service';
import {activityService} from './activity.service';
import {bumpBoardRevision} from './boardRevision';
import {withProductTransaction, ProductSession} from '../utils/transaction';
import {logger} from '../logging/logger';

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
};

function serializeCollaborator(
  row: {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    role: string;
    status: string;
    invitedBy: Types.ObjectId;
    invitedAt: Date;
    respondedAt: Date | null;
  },
  person: Person | null | undefined
) {
  return {
    id: row._id.toString(),
    userId: row.userId.toString(),
    role: row.role,
    status: row.status,
    invitedBy: row.invitedBy.toString(),
    invitedAt: row.invitedAt,
    respondedAt: row.respondedAt,
    firstName: person?.firstName ?? '',
    lastName: person?.lastName ?? '',
    email: person?.email ?? '',
    username: person?.username
  };
}

async function findRowOrThrow(
  board: BoardDocument,
  collaboratorId: string,
  session?: ProductSession
) {
  if (!Types.ObjectId.isValid(collaboratorId)) {
    throw new ApiError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      'collaboratorId must be a valid ObjectId'
    );
  }
  const row = await boardCollaboratorRepository.findByIdForBoard(
    collaboratorId,
    board._id,
    session
  );
  if (!row) {
    throw new ApiError(404, ErrorCodes.COLLABORATOR_NOT_FOUND, 'Collaborator not found');
  }
  return row;
}

export const boardCollaboratorService = {
  /** Owner-only, enforced by the route. */
  async list(board: BoardDocument) {
    const rows = await boardCollaboratorRepository.listForBoard(board._id);
    const people = await Promise.all(
      rows.map(row => userRepository.findById(row.userId.toString()))
    );
    return rows.map((row, index) => serializeCollaborator(row, people[index]));
  },

  /**
   * Owner-only. A re-invite replaces the existing row and resets it to pending,
   * so somebody who previously declined can be invited again.
   */
  async invite(
    actor: Actor,
    board: BoardDocument,
    email: string,
    role: CollaboratorRole
  ) {
    const invitee = await userRepository.findByEmail(email);
    if (!invitee) {
      // Deliberately vague: do not confirm whether an address is registered.
      throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'No account matches that email');
    }

    if (invitee._id.equals(board.ownerId)) {
      throw new ApiError(400, ErrorCodes.CANNOT_INVITE_SELF, 'You already own this board');
    }

    const existing = await boardCollaboratorRepository.find(board._id, invitee._id);
    if (existing && existing.status === 'accepted') {
      throw new ApiError(
        409,
        ErrorCodes.COLLABORATOR_EXISTS,
        'That person already has access to this board'
      );
    }

    const result = await withProductTransaction(async session => {
      let row;
      if (existing) {
        await boardCollaboratorRepository.update(
          existing._id.toString(),
          {
            role,
            status: 'pending',
            invitedBy: actor.actorId,
            invitedAt: new Date(),
            respondedAt: null
          },
          session
        );
        row = await boardCollaboratorRepository.find(board._id, invitee._id, session);
      } else {
        row = await boardCollaboratorRepository.create(
          {
            boardId: board._id,
            userId: invitee._id,
            role,
            status: 'pending',
            invitedBy: actor.actorId
          },
          session
        );
      }

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'collaborator.invited',
        targetType: 'collaborator',
        targetId: row!._id.toString(),
        metadata: {email, role, userId: invitee._id.toString()},
        revision: board.revision
      });

      return {row: row!, activity};
    });

    logger.info(
      {boardId: board._id.toString(), userId: invitee._id.toString(), role},
      'Board invitation sent'
    );

    await notificationService.notifyInvitationSent({
      inviteeId: invitee._id,
      invitee: {
        firstName: invitee.firstName,
        lastName: invitee.lastName,
        email: invitee.email
      },
      inviterId: actor.actorId,
      boardId: board._id,
      collaboratorId: result.row._id,
      boardName: board.name,
      role
    });

    return serializeCollaborator(result.row, invitee);
  },

  /** Owner-only. */
  async setRole(
    actor: Actor,
    board: BoardDocument,
    collaboratorId: string,
    role: CollaboratorRole
  ) {
    const result = await withProductTransaction(async session => {
      const row = await findRowOrThrow(board, collaboratorId, session);

      if (row.userId.equals(board.ownerId)) {
        throw new ApiError(
          400,
          ErrorCodes.CANNOT_MODIFY_OWNER,
          "The owner's role cannot be changed"
        );
      }

      await boardCollaboratorRepository.setRole(row._id.toString(), role, session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'collaborator.role_changed',
        targetType: 'collaborator',
        targetId: row._id.toString(),
        metadata: {
          userId: row.userId.toString(),
          from: row.role,
          to: role
        },
        revision: board.revision
      });

      return {row, activity};
    });

    return {id: result.row._id.toString(), userId: result.row.userId.toString(), role};
  },

  /** Owner-only. */
  async remove(actor: Actor, board: BoardDocument, collaboratorId: string) {
    const result = await withProductTransaction(async session => {
      const row = await findRowOrThrow(board, collaboratorId, session);

      if (row.userId.equals(board.ownerId)) {
        throw new ApiError(
          400,
          ErrorCodes.CANNOT_MODIFY_OWNER,
          'The owner cannot be removed from their own board'
        );
      }

      await boardCollaboratorRepository.delete(row._id.toString(), session);

      const person = await userRepository.findById(row.userId.toString());
      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'collaborator.removed',
        targetType: 'collaborator',
        targetId: row._id.toString(),
        metadata: {
          userId: row.userId.toString(),
          email: person?.email ?? '',
          role: row.role
        },
        revision: board.revision
      });

      return {row, activity};
    });

    return {message: 'Collaborator removed'};
  },

  /**
   * The invitee answers their own invitation. The lookup is scoped to the
   * authenticated user, so one person can never accept an invitation addressed
   * to somebody else.
   */
  async respond(actor: Actor, collaboratorId: string, decision: CollaboratorStatus) {
    if (!Types.ObjectId.isValid(collaboratorId)) {
      throw new ApiError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'collaboratorId must be a valid ObjectId'
      );
    }

    const result = await withProductTransaction(async session => {
      const row = await boardCollaboratorRepository.findByIdForUser(
        collaboratorId,
        actor.actorId,
        session
      );
      if (!row) {
        throw new ApiError(404, ErrorCodes.COLLABORATOR_NOT_FOUND, 'Invitation not found');
      }

      if (row.status !== 'pending') {
        throw new ApiError(
          409,
          ErrorCodes.VALIDATION_ERROR,
          `This invitation was already ${row.status}`
        );
      }

      await boardCollaboratorRepository.setStatus(
        row._id.toString(),
        decision,
        new Date(),
        session
      );

      // A decline grants no access and changes no board state worth an audit
      // line; an acceptance does both, and bumps the board revision so the
      // activity entry gets a cursor the poll can find.
      let activity = null;
      if (decision === 'accepted') {
        const revision = await bumpBoardRevision(row.boardId, undefined, session);
        activity = await activityService.log(session, {
          boardId: row.boardId,
          actor,
          actionType: 'collaborator.accepted',
          targetType: 'collaborator',
          targetId: row._id.toString(),
          metadata: {
            userId: actor.actorId.toString(),
            role: row.role
          },
          revision
        });
      }

      return {row, activity};
    });

    const board = await boardRepository.findById(result.row.boardId.toString());
    logger.info(
      {boardId: result.row.boardId.toString(), userId: actor.actorId.toString(), decision},
      'Board invitation answered'
    );

    // The invitee's "you were invited" card has served its purpose — it is
    // deleted so no stale Accept/Decline row can survive the answer — and the
    // inviter now learns what happened. Emails are best-effort inside.
    await notificationRepository.deleteByCollaboratorId(result.row._id);
    await notificationService.notifyInvitationAnswered({
      inviterId: result.row.invitedBy,
      inviteeId: actor.actorId,
      boardId: result.row.boardId,
      collaboratorId: result.row._id,
      boardName: board?.name ?? '',
      decision: decision === 'declined' ? 'declined' : 'accepted'
    });

    

    return {
      id: result.row._id.toString(),
      boardId: result.row.boardId.toString(),
      boardName: board?.name ?? '',
      role: result.row.role,
      status: decision
    };
  },

  /** Invitations waiting on the signed-in person. */
  async listPendingForUser(actor: Actor) {
    const rows = await boardCollaboratorRepository.listPendingForUser(actor.actorId);
    const boards = await boardRepository.listByIds(rows.map(row => row.boardId));

    // Keyed lookups rather than index arithmetic: `listByIds` is a $in query, so
    // its result order is Mongo's to choose and need not match the order of
    // `rows`. Indexing the owners positionally could therefore attribute one
    // board's owner to a different invitation.
    const boardById = new Map(boards.map(board => [board._id.toString(), board]));
    const ownerNameByBoardId = new Map(
      await Promise.all(
        boards.map(async board => {
          const owner = await userRepository.findById(board.ownerId.toString());
          return [
            board._id.toString(),
            owner ? `${owner.firstName} ${owner.lastName}`.trim() : ''
          ] as const;
        })
      )
    );

    return rows.map(row => {
      const boardId = row.boardId.toString();
      return {
        id: row._id.toString(),
        boardId,
        boardName: boardById.get(boardId)?.name ?? '',
        role: row.role,
        invitedAt: row.invitedAt,
        invitedByName: ownerNameByBoardId.get(boardId) ?? ''
      };
    });
  }
};
