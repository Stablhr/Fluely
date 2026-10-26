import {Types} from 'mongoose';
import {env} from '../config/env';
import {notificationRepository} from '../repositories/notification.repository';
import {userRepository} from '../repositories/user.repository';
import {boardRepository} from '../repositories/board.repository';
import {cardRepository} from '../repositories/card.repository';
import {listRepository} from '../repositories/list.repository';
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
    const cardIds = [...new Set(rows.map(row => row.cardId?.toString()).filter(Boolean))] as string[];
    const [boards, actors] = await Promise.all([
      boardRepository.listByIds(boardIds.map(id => new Types.ObjectId(id))),
      Promise.all(actorIds.map(id => userRepository.findById(id)))
    ]);
    const boardById = new Map(boards.map(board => [board._id.toString(), board]));
    const actorById = new Map(
      actorIds.map((id, index) => [id, displayName(actors[index])])
    );

    // Fetch the cards (and their lists) referenced by mention notifications.
    const cardById = new Map<string, {title: string; listId: string; listName: string}>();
    await Promise.all(
      cardIds.map(async (cardId) => {
        const row = rows.find(r => r.cardId?.toString() === cardId);
        if (!row) return;
        try {
          const card = await cardRepository.findByIdForBoard(cardId, row.boardId);
          if (!card) return;
          let listName = '';
          try {
            const list = await listRepository.findByIdForBoard(card.listId.toString(), row.boardId);
            listName = list?.name ?? '';
          } catch {
            listName = '';
          }
          cardById.set(cardId, {title: card.title, listId: card.listId.toString(), listName});
        } catch {
          // ignore
        }
      })
    );

    return {
      unreadCount,
      notifications: rows.map(row => {
        const card = row.cardId ? cardById.get(row.cardId.toString()) : null;
        return {
          id: row._id.toString(),
          type: row.type,
          boardId: row.boardId.toString(),
          collaboratorId: row.collaboratorId?.toString() ?? null,
          cardId: row.cardId?.toString() ?? null,
          commentId: row.commentId ?? null,
          snippet: row.snippet ?? null,
          listName: card?.listName ?? '',
          cardTitle: card?.title ?? '',
          boardName: boardById.get(row.boardId.toString())?.name ?? '',
          actorName: actorById.get(row.actorId.toString()) ?? '',
          read: row.read,
          readAt: row.readAt,
          createdAt: row.createdAt
        };
      })
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

  async delete(actor: Actor, notificationId: string) {
    const result = await notificationRepository.deleteOne(notificationId, actor.actorId);
    if (result.deletedCount === 0) {
      // Either the id is bad or it belongs to somebody else; the caller learns
      // nothing about which.
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Notification not found');
    }
    return {message: 'Notification deleted'};
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
    token?: string;
    expiresAt?: Date;
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

    const acceptUrl = params.token
      ? `${env.FRONTEND_URL}/invite?token=${encodeURIComponent(params.token)}`
      : `${env.FRONTEND_URL}/boards`;
    const template = boardInvitationEmailTemplate({
      recipientName: params.invitee.firstName,
      inviterName,
      boardName: params.boardName,
      role: params.role,
      acceptUrl,
      expiresAt: params.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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
  },

  /**
   * Mention-side: one notification per mentioned user per comment. Dedup and
   * self-exclusion happen in the caller; this just persists + (best-effort)
   * emails. `mentionedUserIds` must already be validated as board members.
   */
  async notifyMention(params: {
    mentionedUserIds: string[];
    actorId: Types.ObjectId;
    boardId: Types.ObjectId;
    cardId: Types.ObjectId;
    commentId: string;
    snippet: string;
    boardName: string;
  }) {
    const actor = await userRepository.findById(params.actorId.toString());
    const actorName = displayName(actor) || 'Someone';

    await Promise.all(
      params.mentionedUserIds.map(async (mentionedUserId) => {
        // Skip self-mentions.
        if (mentionedUserId === params.actorId.toString()) return;
        await notificationRepository.create({
          userId: new Types.ObjectId(mentionedUserId),
          type: 'mention',
          actorId: params.actorId,
          boardId: params.boardId,
          cardId: params.cardId,
          commentId: params.commentId,
          snippet: params.snippet.slice(0, 100)
        });
      })
    );

    return {actorName};
  }
};
