import {Types} from 'mongoose';
import {notificationRepository} from '../repositories/notification.repository';
import {userRepository} from '../repositories/user.repository';
import {boardRepository} from '../repositories/board.repository';
import {emailService} from './email.service';
import {boardInvitationEmailTemplate} from '../templates/boardInvitationEmail';
import {boardInvitationResponseEmailTemplate} from '../templates/boardInvitationResponseEmail';
import {Actor} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {NotificationType} from '../constants/product';
import {logger} from '../logging/logger';

function displayName(user: {firstName: string; lastName: string} | null | undefined) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : '';
}

/**
 * Emails ride along with in-app notifications but never gate them: SMTP is an
 * env-dependent extra (often unset in dev), so a transport failure is logged
 * and swallowed — the invitation itself already succeeded by this point.
 */
async function sendBestEffortEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  what: string;
}) {
  try {
    await emailService.sendEmail({
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html
    });
  } catch (err) {
    logger.warn({err, to: params.to}, `Could not send ${params.what} email`);
  }
}

export const notificationService = {
  /** The signed-in person's inbox: recent items plus the badge count. */
  async list(actor: Actor) {
    const [rows, unreadCount] = await Promise.all([
      notificationRepository.listForUser(actor.actorId),
      notificationRepository.countUnread(actor.actorId)
    ]);

    // Keyed lookups rather than index arithmetic: $in queries come back in
    // Mongo's order, so positional zipping could credit one board's name to
    // another notification.
    const boardIds = [...new Set(rows.map(row => row.boardId.toString()))];
    const actorIds = [...new Set(rows.map(row => row.actorId.toString()))];
    const [boards, actors] = await Promise.all([
      boardRepository.listByIds(boardIds.map(id => new Types.ObjectId(id))),
      Promise.all(actorIds.map(id => userRepository.findById(id)))
    ]);
    const boardById = new Map(boards.map(board => [board._id.toString(), board.name]));
    const actorById = new Map(
      actorIds.map((id, index) => [id, displayName(actors[index])])
    );

    return {
      unreadCount,
      notifications: rows.map(row => ({
        id: row._id.toString(),
        type: row.type,
        boardId: row.boardId.toString(),
        collaboratorId: row.collaboratorId?.toString() ?? null,
        boardName: boardById.get(row.boardId.toString()) ?? '',
        actorName: actorById.get(row.actorId.toString()) ?? '',
        read: row.read,
        readAt: row.readAt,
        createdAt: row.createdAt
      }))
    };
  },

  async markRead(actor: Actor, notificationId: string) {
    const result = await notificationRepository.markRead(notificationId, actor.actorId);
    if (result.matchedCount === 0) {
      // Either the id is bad or it belongs to somebody else; the caller learns
      // nothing about which.
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Notification not found');
    }
    return {message: 'Notification marked as read'};
  },

  async markAllRead(actor: Actor) {
    await notificationRepository.markAllRead(actor.actorId);
    return {message: 'All notifications marked as read'};
  },

  /**
   * Invitee-side: the "you were invited" card. A re-invite retires the stale
   * card first so repeats never stack.
   */
  async notifyInvitationSent(params: {
    inviteeId: Types.ObjectId;
    invitee: {firstName: string; lastName: string; email: string};
    inviterId: Types.ObjectId;
    boardId: Types.ObjectId;
    collaboratorId: Types.ObjectId;
    boardName: string;
    role: 'editor' | 'viewer';
  }) {
    const inviter = await userRepository.findById(params.inviterId.toString());
    const inviterName = displayName(inviter) || 'Someone';

    await notificationRepository.deleteInvitationsForBoard(
      params.inviteeId,
      params.boardId
    );
    await notificationRepository.create({
      userId: params.inviteeId,
      type: 'board_invitation',
      actorId: params.inviterId,
      boardId: params.boardId,
      collaboratorId: params.collaboratorId
    });

    const template = boardInvitationEmailTemplate({
      recipientName: params.invitee.firstName,
      inviterName,
      boardName: params.boardName,
      role: params.role
    });
    await sendBestEffortEmail({
      to: params.invitee.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      what: 'board invitation'
    });
  },

  /** Inviter-side: what happened to the invitation they sent. */
  async notifyInvitationAnswered(params: {
    inviterId: Types.ObjectId;
    inviteeId: Types.ObjectId;
    boardId: Types.ObjectId;
    collaboratorId: Types.ObjectId;
    boardName: string;
    decision: 'accepted' | 'declined';
  }) {
    const invitee = await userRepository.findById(params.inviteeId.toString());
    const inviteeName = displayName(invitee) || 'Someone';

    const type: NotificationType =
      params.decision === 'accepted' ? 'board_invitation_accepted' : 'board_invitation_declined';

    await notificationRepository.create({
      userId: params.inviterId,
      type,
      actorId: params.inviteeId,
      boardId: params.boardId,
      collaboratorId: params.collaboratorId
    });

    // The response email goes to the inviter, not the invitee.
    const inviter = await userRepository.findById(params.inviterId.toString());
    if (!inviter?.email) return;
    const template = boardInvitationResponseEmailTemplate({
      recipientName: displayName(inviter),
      inviteeName,
      boardName: params.boardName,
      decision: params.decision
    });
    await sendBestEffortEmail({
      to: inviter.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      what: 'invitation response'
    });
  }
};
