import jwt from 'jsonwebtoken';
import mongoose, {Types} from 'mongoose';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server-core';

jest.mock('../api/services/cloudinary.service', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(async () => undefined),
  folderForMedia: () => 'fluely/boards',
  toResourceType: (value: string) => (value === 'video' || value === 'raw' ? value : 'image')
}));

jest.mock('../api/services/email.service', () => ({
  emailService: {sendEmail: jest.fn(async () => undefined)}
}));

import app from '../app';
import {env} from '../api/config/env';
import {ACCESS_TOKEN_COOKIE, CSRF_COOKIE, REFRESH_TOKEN_COOKIE} from '../api/constants/cookies';
import {hashToken} from '../api/utils/crypto';
import {UserModel} from '../api/models/User.model';
import {BoardModel} from '../api/models/Board.model';
import {BoardCollaboratorModel} from '../api/models/BoardCollaborator.model';
import {MediaAttachmentModel} from '../api/models/MediaAttachment.model';
import {deleteFromCloudinary} from '../api/services/cloudinary.service';

/*
 * When an owner deletes a shared board, members' devices drop it by re-reading
 * their board list (StoreProvider `syncBoards`) and, on the board page, by the
 * poll failing. Both rely on the server forgetting the board for them.
 */

jest.setTimeout(30_000);

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {autoIndex: false});
}, 120_000);

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

let counter = 0;
async function createUser() {
  counter += 1;
  return UserModel.create({
    firstName: `Del${counter}`,
    lastName: 'Person',
    email: `deletion${counter}@example.test`,
    passwordHash: 'x',
    isVerified: true
  });
}

function as(userId: Types.ObjectId) {
  const access = jwt.sign({userId: userId.toString(), type: 'user'}, env.JWT_SECRET, {expiresIn: 900});
  const refresh = jwt.sign({userId: userId.toString(), type: 'user'}, env.JWT_REFRESH_SECRET, {
    expiresIn: 3600,
    jwtid: hashToken(String(Math.random()))
  });
  const cookie = `${ACCESS_TOKEN_COOKIE}=${access}; ${REFRESH_TOKEN_COOKIE}=${refresh}; ${CSRF_COOKIE}=csrf`;
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    del: (path: string) => request(app).delete(path).set('Cookie', cookie).set('X-CSRF-Token', 'csrf')
  };
}

async function sharedBoard() {
  const owner = await createUser();
  const member = await createUser();
  const board = await BoardModel.create({name: 'Shared', ownerId: owner._id});
  await BoardCollaboratorModel.create({
    boardId: board._id,
    userId: member._id,
    role: 'editor',
    status: 'accepted',
    invitedBy: owner._id
  });
  return {owner, member, board};
}

const ids = (res: request.Response) => (res.body.boards as {id: string}[]).map(b => b.id);

describe('deleting a shared board', () => {
  it('removes it from the other member’s board list, even when it was their only board', async () => {
    const {owner, member, board} = await sharedBoard();
    const before = await as(member._id).get('/api/boards?scope=accessible');
    expect(ids(before)).toEqual([board._id.toString()]);

    expect((await as(owner._id).del(`/api/boards/${board._id}`)).status).toBe(200);

    const after = await as(member._id).get('/api/boards?scope=accessible');
    expect(after.status).toBe(200);
    // An empty list is the answer the client must still reconcile against.
    expect(ids(after)).toEqual([]);
  });

  it('makes the member’s board poll fail so an open board page leaves it', async () => {
    const {owner, member, board} = await sharedBoard();
    await as(owner._id).del(`/api/boards/${board._id}`);
    const poll = await as(member._id).get(`/api/boards/${board._id}/poll?since=0`);
    expect([403, 404]).toContain(poll.status);
  });
});

describe('deleting a board with files', () => {
  it('deletes its files from Cloudinary, not only their rows', async () => {
    const {owner, board} = await sharedBoard();
    await MediaAttachmentModel.create({
      ownerId: owner._id,
      boardId: board._id,
      kind: 'video',
      resourceType: 'video',
      originalName: 'clip.mp4',
      url: 'https://res.cloudinary.com/demo/video/upload/clip.mp4',
      publicId: 'fluely/boards/clip',
      mimeType: 'video/mp4',
      sizeBytes: 10
    });

    expect((await as(owner._id).del(`/api/boards/${board._id}`)).status).toBe(200);

    expect(deleteFromCloudinary).toHaveBeenCalledWith('fluely/boards/clip', 'video');
    expect(await MediaAttachmentModel.countDocuments({boardId: board._id})).toBe(0);
  });
});
