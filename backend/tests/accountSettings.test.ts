import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose, {Types} from 'mongoose';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server-core';

// Nothing in these suites may reach Cloudinary or an SMTP server.
jest.mock('../api/services/cloudinary.service', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(async () => undefined),
  folderForMedia: () => 'fluely/tasks',
  toResourceType: (value: string) => (value === 'video' || value === 'raw' ? value : 'image')
}));

jest.mock('../api/services/email.service', () => ({
  emailService: {sendEmail: jest.fn(async () => undefined)}
}));

import app from '../app';
import {env} from '../api/config/env';
import {ACCESS_TOKEN_COOKIE, CSRF_COOKIE, REFRESH_TOKEN_COOKIE} from '../api/constants/cookies';
import {ErrorCodes} from '../api/constants/errorCodes';
import {profilePatchSchema} from '../api/dtos/product.dto';
import {accountService} from '../api/services/account.service';
import {notificationService} from '../api/services/notification.service';
import {deleteFromCloudinary} from '../api/services/cloudinary.service';
import {emailService} from '../api/services/email.service';
import {blocklistService} from '../api/services/blocklist.service';
import {hashToken} from '../api/utils/crypto';
import {UserModel} from '../api/models/User.model';
import {BoardModel} from '../api/models/Board.model';
import {ListModel} from '../api/models/List.model';
import {CardModel} from '../api/models/Card.model';
import {BoardCollaboratorModel} from '../api/models/BoardCollaborator.model';
import {BoardPresenceModel} from '../api/models/BoardPresence.model';
import {ActivityLogModel} from '../api/models/ActivityLog.model';
import {MediaAttachmentModel} from '../api/models/MediaAttachment.model';
import {MentionModel} from '../api/models/Mention.model';
import {NotificationModel} from '../api/models/Notification.model';
import {WorkspaceModel} from '../api/models/Workspace.model';
import {WorkspaceMemberModel} from '../api/models/WorkspaceMember.model';

// Seeding a full account graph against the in-memory server can pass the
// 5s default when other suites start their own servers in parallel.
jest.setTimeout(30_000);

const PASSWORD = 'Correct-horse-1';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  // Indexes are irrelevant to what these suites assert, and building all of
  // them would trip over BoardPresence's duplicate `lastSeenAt` definitions.
  await mongoose.connect(mongo.getUri(), {autoIndex: false});
}, 120_000);

afterEach(async () => {
  jest.clearAllMocks();
  await Promise.all(
    Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

let userCounter = 0;
async function createUser(overrides: Record<string, unknown> = {}) {
  userCounter += 1;
  return UserModel.create({
    firstName: `First${userCounter}`,
    lastName: 'Person',
    email: `person${userCounter}@example.test`,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    isVerified: true,
    ...overrides
  });
}

/** Signed-in, CSRF-armed request headers for the real app. */
function sessionFor(userId: Types.ObjectId) {
  const access = jwt.sign({userId: userId.toString(), type: 'user'}, env.JWT_SECRET, {
    expiresIn: 60 * 15
  });
  const refresh = jwt.sign({userId: userId.toString(), type: 'user'}, env.JWT_REFRESH_SECRET, {
    expiresIn: 60 * 60,
    jwtid: hashToken(String(Math.random()))
  });
  const csrf = 'csrf-test-token';
  return {
    refresh,
    cookie: `${ACCESS_TOKEN_COOKIE}=${access}; ${REFRESH_TOKEN_COOKIE}=${refresh}; ${CSRF_COOKIE}=${csrf}`,
    csrf
  };
}

describe('account preferences', () => {
  it('fills in defaults for accounts that predate the field', async () => {
    const {insertedId} = await UserModel.collection.insertOne({
      firstName: 'Legacy',
      lastName: 'User',
      email: 'legacy@example.test',
      passwordHash: 'x',
      isVerified: true
    });

    const profile = await accountService.getProfile(insertedId);

    expect(profile.preferences).toEqual({
      notifications: {
        inApp: {mentions: true, invitationResponses: true},
        email: {mentions: true, invitationResponses: true}
      },
      defaultBoardVisibility: 'private'
    });
  });

  it('deep-merges a partial PATCH without touching sibling keys', async () => {
    const user = await createUser();
    const session = sessionFor(user._id);

    const first = await request(app)
      .patch('/api/account/me/profile')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrf)
      .send({preferences: {notifications: {email: {mentions: false}}}});
    expect(first.status).toBe(200);
    expect(first.body.preferences.notifications).toEqual({
      inApp: {mentions: true, invitationResponses: true},
      email: {mentions: false, invitationResponses: true}
    });

    const second = await request(app)
      .patch('/api/account/me/profile')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrf)
      .send({preferences: {defaultBoardVisibility: 'workspace', notifications: {inApp: {invitationResponses: false}}}});
    expect(second.status).toBe(200);
    expect(second.body.preferences).toEqual({
      notifications: {
        inApp: {mentions: true, invitationResponses: false},
        email: {mentions: false, invitationResponses: true}
      },
      defaultBoardVisibility: 'workspace'
    });

    const read = await request(app).get('/api/account/me/profile').set('Cookie', session.cookie);
    expect(read.status).toBe(200);
    expect(read.body.preferences).toEqual(second.body.preferences);
  });

  it.each([
    ['an unknown preference key', {preferences: {theme: 'dark'}}],
    ['an unknown channel', {preferences: {notifications: {sms: {mentions: true}}}}],
    ['an unknown event', {preferences: {notifications: {email: {digest: true}}}}],
    ['a non-boolean switch', {preferences: {notifications: {email: {mentions: 'no'}}}}],
    ['an unknown visibility', {preferences: {defaultBoardVisibility: 'secret'}}]
  ])('rejects %s', async (_label, body) => {
    expect(profilePatchSchema.safeParse(body).success).toBe(false);

    const user = await createUser();
    const session = sessionFor(user._id);
    const res = await request(app)
      .patch('/api/account/me/profile')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrf)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({success: false, code: ErrorCodes.VALIDATION_ERROR});
  });
});

describe('notification preferences', () => {
  async function mention(recipientId: Types.ObjectId, actorId: Types.ObjectId) {
    await notificationService.notifyMention({
      mentionedUserIds: [recipientId.toString()],
      actorId,
      boardId: new Types.ObjectId(),
      cardId: new Types.ObjectId(),
      commentId: 'c1',
      snippet: 'hey @user',
      boardName: 'Launch'
    });
  }

  it('creates the in-app mention and sends the email by default', async () => {
    const actor = await createUser();
    const recipient = await createUser();

    await mention(recipient._id, actor._id);

    expect(await NotificationModel.countDocuments({userId: recipient._id, type: 'mention'})).toBe(1);
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({to: recipient.email})
    );
  });

  it('skips the in-app mention when inApp.mentions is off', async () => {
    const actor = await createUser();
    const recipient = await createUser({
      preferences: {notifications: {inApp: {mentions: false}}}
    });

    await mention(recipient._id, actor._id);

    expect(await NotificationModel.countDocuments({userId: recipient._id})).toBe(0);
    // The other channel is independent.
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('skips the mention email when email.mentions is off', async () => {
    const actor = await createUser();
    const recipient = await createUser({
      preferences: {notifications: {email: {mentions: false}}}
    });

    await mention(recipient._id, actor._id);

    expect(await NotificationModel.countDocuments({userId: recipient._id, type: 'mention'})).toBe(1);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('suppresses invitation responses but never the invitation itself', async () => {
    const inviter = await createUser({
      preferences: {
        notifications: {
          inApp: {invitationResponses: false},
          email: {invitationResponses: false}
        }
      }
    });
    const invitee = await createUser({
      preferences: {
        notifications: {
          inApp: {mentions: false, invitationResponses: false},
          email: {mentions: false, invitationResponses: false}
        }
      }
    });
    const boardId = new Types.ObjectId();
    const collaboratorId = new Types.ObjectId();

    await notificationService.notifyInvitationAnswered({
      inviterId: inviter._id,
      inviteeId: invitee._id,
      boardId,
      collaboratorId,
      boardName: 'Launch',
      decision: 'accepted'
    });
    expect(await NotificationModel.countDocuments({userId: inviter._id})).toBe(0);
    expect(emailService.sendEmail).not.toHaveBeenCalled();

    await notificationService.notifyInvitationSent({
      inviteeId: invitee._id,
      invitee: {firstName: invitee.firstName, lastName: invitee.lastName, email: invitee.email},
      inviterId: inviter._id,
      boardId,
      collaboratorId,
      boardName: 'Launch',
      role: 'editor'
    });
    expect(
      await NotificationModel.countDocuments({userId: invitee._id, type: 'board_invitation'})
    ).toBe(1);
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({to: invitee.email})
    );
  });
});

describe('DELETE /api/account/me', () => {
  async function seed() {
    const doomed = await createUser({avatarUrl: 'https://cdn/avatar.png', avatarPublicId: 'fluely/avatars/a'});
    const other = await createUser();

    // A board the doomed account owns, with children.
    const owned = await BoardModel.create({name: 'Mine', ownerId: doomed._id});
    const list = await ListModel.create({boardId: owned._id, name: 'To do'});
    const card = await CardModel.create({boardId: owned._id, listId: list._id, title: 'Card'});
    await BoardCollaboratorModel.create({
      boardId: owned._id,
      userId: other._id,
      role: 'editor',
      status: 'accepted',
      invitedBy: doomed._id
    });
    await BoardPresenceModel.create({boardId: owned._id, userId: other._id, name: 'Other', lastSeenAt: new Date()});
    await ActivityLogModel.create({
      boardId: owned._id,
      userId: doomed._id,
      actionType: 'card.created',
      targetType: 'card',
      targetId: card._id.toString(),
      revision: 1
    });
    await MediaAttachmentModel.create({
      ownerId: other._id,
      boardId: owned._id,
      cardId: card._id,
      kind: 'video',
      resourceType: 'video',
      originalName: 'clip.mp4',
      url: 'https://cdn/clip.mp4',
      publicId: 'fluely/tasks/clip',
      mimeType: 'video/mp4',
      sizeBytes: 10
    });
    await MediaAttachmentModel.create({
      ownerId: doomed._id,
      kind: 'image',
      resourceType: 'image',
      originalName: 'library.png',
      url: 'https://cdn/library.png',
      publicId: 'fluely/content-planner/library',
      mimeType: 'image/png',
      sizeBytes: 10
    });
    await MentionModel.create({
      boardId: owned._id,
      cardId: card._id,
      commentId: 'c1',
      mentionedUserId: other._id,
      mentionedBy: doomed._id
    });
    await NotificationModel.create({
      userId: other._id,
      type: 'mention',
      actorId: doomed._id,
      boardId: owned._id,
      cardId: card._id
    });

    // Someone else's board the doomed account collaborates on.
    const theirs = await BoardModel.create({name: 'Theirs', ownerId: other._id});
    const theirList = await ListModel.create({boardId: theirs._id, name: 'Doing'});
    const theirCard = await CardModel.create({
      boardId: theirs._id,
      listId: theirList._id,
      title: 'Shared',
      memberIds: [doomed._id, other._id]
    });
    await BoardCollaboratorModel.create({
      boardId: theirs._id,
      userId: doomed._id,
      role: 'viewer',
      status: 'accepted',
      invitedBy: other._id
    });
    await BoardPresenceModel.create({boardId: theirs._id, userId: doomed._id, name: 'Doomed', lastSeenAt: new Date()});
    await NotificationModel.create({
      userId: doomed._id,
      type: 'mention',
      actorId: other._id,
      boardId: theirs._id,
      cardId: theirCard._id
    });
    await MentionModel.create({
      boardId: theirs._id,
      cardId: theirCard._id,
      commentId: 'c2',
      mentionedUserId: doomed._id,
      mentionedBy: other._id
    });

    // Workspaces: one solo, one shared with `other`.
    const solo = await WorkspaceModel.create({name: 'Solo', slug: `solo-${userCounter}`, ownerId: doomed._id});
    await WorkspaceMemberModel.create({workspaceId: solo._id, userId: doomed._id, role: 'owner'});
    const shared = await WorkspaceModel.create({name: 'Shared', slug: `shared-${userCounter}`, ownerId: doomed._id});
    await WorkspaceMemberModel.create({workspaceId: shared._id, userId: doomed._id, role: 'owner'});
    await WorkspaceMemberModel.create({workspaceId: shared._id, userId: other._id, role: 'member'});

    return {doomed, other, owned, theirs, theirCard, solo, shared};
  }

  it('deletes the account and everything it owns, and ends the session', async () => {
    const {doomed, other, owned, theirs, theirCard, solo, shared} = await seed();
    const session = sessionFor(doomed._id);

    const res = await request(app)
      .delete('/api/account/me')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrf)
      .send({password: PASSWORD, confirmation: 'DELETE'});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({success: true});

    // Auth cookies cleared, refresh token revoked.
    const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(setCookie.some(c => c.startsWith(`${ACCESS_TOKEN_COOKIE}=;`))).toBe(true);
    expect(setCookie.some(c => c.startsWith(`${REFRESH_TOKEN_COOKIE}=;`))).toBe(true);
    await expect(blocklistService.isRevoked(session.refresh)).resolves.toBe(true);

    // The account is gone.
    expect(await UserModel.findById(doomed._id)).toBeNull();

    // The owned board and all of its children are gone.
    expect(await BoardModel.findById(owned._id)).toBeNull();
    expect(await ListModel.countDocuments({boardId: owned._id})).toBe(0);
    expect(await CardModel.countDocuments({boardId: owned._id})).toBe(0);
    expect(await BoardCollaboratorModel.countDocuments({boardId: owned._id})).toBe(0);
    expect(await BoardPresenceModel.countDocuments({boardId: owned._id})).toBe(0);
    expect(await ActivityLogModel.countDocuments({boardId: owned._id})).toBe(0);
    expect(await MediaAttachmentModel.countDocuments({boardId: owned._id})).toBe(0);
    expect(await MentionModel.countDocuments({boardId: owned._id})).toBe(0);
    expect(await NotificationModel.countDocuments({boardId: owned._id})).toBe(0);
    expect(await MediaAttachmentModel.countDocuments({ownerId: doomed._id})).toBe(0);

    // Cloudinary assets destroyed with their exact resource types.
    expect(deleteFromCloudinary).toHaveBeenCalledWith('fluely/tasks/clip', 'video');
    expect(deleteFromCloudinary).toHaveBeenCalledWith('fluely/content-planner/library', 'image');
    expect(deleteFromCloudinary).toHaveBeenCalledWith('fluely/avatars/a', 'image');

    // Traces on someone else's board are gone; the board itself is untouched.
    expect(await BoardModel.findById(theirs._id)).not.toBeNull();
    expect(await BoardCollaboratorModel.countDocuments({userId: doomed._id})).toBe(0);
    expect(await BoardPresenceModel.countDocuments({userId: doomed._id})).toBe(0);
    expect(await NotificationModel.countDocuments({userId: doomed._id})).toBe(0);
    expect(await MentionModel.countDocuments({mentionedUserId: doomed._id})).toBe(0);
    const card = await CardModel.findById(theirCard._id);
    expect(card?.memberIds.map(String)).toEqual([other._id.toString()]);

    // Workspaces: the solo one is deleted, the shared one passes to `other`.
    expect(await WorkspaceModel.findById(solo._id)).toBeNull();
    expect(await WorkspaceMemberModel.countDocuments({workspaceId: solo._id})).toBe(0);
    const kept = await WorkspaceModel.findById(shared._id);
    expect(kept?.ownerId.toString()).toBe(other._id.toString());
    const heir = await WorkspaceMemberModel.findOne({workspaceId: shared._id, userId: other._id});
    expect(heir?.role).toBe('owner');
    expect(await WorkspaceMemberModel.countDocuments({userId: doomed._id})).toBe(0);

    // The other person is untouched.
    expect(await UserModel.findById(other._id)).not.toBeNull();
  });

  it('rejects a wrong password and keeps everything', async () => {
    const {doomed, owned} = await seed();
    const session = sessionFor(doomed._id);

    const res = await request(app)
      .delete('/api/account/me')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrf)
      .send({password: 'Wrong-password-1', confirmation: 'DELETE'});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({success: false, code: ErrorCodes.INVALID_CREDENTIALS});
    expect(await UserModel.findById(doomed._id)).not.toBeNull();
    expect(await BoardModel.findById(owned._id)).not.toBeNull();
    expect(deleteFromCloudinary).not.toHaveBeenCalled();
    await expect(blocklistService.isRevoked(session.refresh)).resolves.toBe(false);
  });

  it.each([
    ['a missing confirmation', {password: PASSWORD}],
    ['a lowercase confirmation', {password: PASSWORD, confirmation: 'delete'}],
    ['a missing password', {confirmation: 'DELETE'}]
  ])('rejects %s as a validation error', async (_label, body) => {
    const user = await createUser();
    const session = sessionFor(user._id);

    const res = await request(app)
      .delete('/api/account/me')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrf)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({success: false, code: ErrorCodes.VALIDATION_ERROR});
    expect(await UserModel.findById(user._id)).not.toBeNull();
  });

  it('requires a CSRF token', async () => {
    const user = await createUser();
    const session = sessionFor(user._id);

    const res = await request(app)
      .delete('/api/account/me')
      .set('Cookie', session.cookie)
      .send({password: PASSWORD, confirmation: 'DELETE'});

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({success: false, code: ErrorCodes.CSRF_TOKEN_INVALID});
    expect(await UserModel.findById(user._id)).not.toBeNull();
  });
});
