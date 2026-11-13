import jwt from 'jsonwebtoken';
import mongoose, {Types} from 'mongoose';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server-core';

// Nothing in this suite may reach Cloudinary or an SMTP server.
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
import {ErrorCodes} from '../api/constants/errorCodes';
import {hashToken} from '../api/utils/crypto';
import {UserModel} from '../api/models/User.model';
import {BoardModel} from '../api/models/Board.model';
import {BoardCollaboratorModel} from '../api/models/BoardCollaborator.model';
import {ActivityLogModel} from '../api/models/ActivityLog.model';
import {MediaAttachmentModel} from '../api/models/MediaAttachment.model';

jest.setTimeout(30_000);

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
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

const CLOUD = env.CLOUDINARY_CLOUD_NAME ?? 'demo';
const cloudinaryUrl = (name: string) =>
  `https://res.cloudinary.com/${CLOUD}/image/upload/v1/fluely/boards/${name}.jpg`;

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return UserModel.create({
    firstName: `First${userCounter}`,
    lastName: 'Person',
    email: `background${userCounter}@example.test`,
    passwordHash: 'x',
    isVerified: true
  });
}

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
    cookie: `${ACCESS_TOKEN_COOKIE}=${access}; ${REFRESH_TOKEN_COOKIE}=${refresh}; ${CSRF_COOKIE}=${csrf}`,
    csrf
  };
}

function patchBoard(userId: Types.ObjectId, boardId: Types.ObjectId, body: object) {
  const session = sessionFor(userId);
  return request(app)
    .patch(`/api/boards/${boardId.toString()}`)
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrf)
    .send(body);
}

async function createMedia(
  ownerId: Types.ObjectId,
  boardId: Types.ObjectId | null,
  overrides: Record<string, unknown> = {}
) {
  return MediaAttachmentModel.create({
    ownerId,
    boardId,
    kind: 'image',
    resourceType: 'image',
    originalName: 'photo.jpg',
    url: cloudinaryUrl(`photo-${new Types.ObjectId().toString()}`),
    publicId: 'fluely/boards/photo',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    ...overrides
  });
}

async function setup() {
  const owner = await createUser();
  const board = await BoardModel.create({name: 'Launch', ownerId: owner._id});
  return {owner, board};
}

function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.body).toMatchObject({success: false, code});
  expect(typeof res.body.message).toBe('string');
}

describe('board background colours', () => {
  it('accepts a hex colour, clears the media id, bumps the revision and logs it', async () => {
    const {owner, board} = await setup();
    const media = await createMedia(owner._id, board._id);
    await BoardModel.updateOne(
      {_id: board._id},
      {backgroundMediaId: media._id, background: media.url}
    );

    const res = await patchBoard(owner._id, board._id, {background: '#1F2937'});

    expect(res.status).toBe(200);
    expect(res.body.board).toMatchObject({background: '#1F2937', backgroundMediaId: null});
    expect(res.body.board.revision).toBe(board.revision + 1);

    const stored = await BoardModel.findById(board._id);
    expect(stored?.background).toBe('#1F2937');
    expect(stored?.backgroundMediaId).toBeNull();
    // The previous photo stays in the board's library.
    expect(await MediaAttachmentModel.findById(media._id)).not.toBeNull();

    const activity = await ActivityLogModel.find({boardId: board._id, actionType: 'board.updated'});
    expect(activity).toHaveLength(1);
  });

  it('accepts a short hex colour and "default"', async () => {
    const {owner, board} = await setup();

    const short = await patchBoard(owner._id, board._id, {background: '#abc'});
    expect(short.status).toBe(200);
    expect(short.body.board.background).toBe('#abc');

    const reset = await patchBoard(owner._id, board._id, {background: 'default'});
    expect(reset.status).toBe(200);
    expect(reset.body.board).toMatchObject({background: 'default', backgroundMediaId: null});
  });

  it.each([
    'https://tracker.example/pixel.gif',
    'url(https://tracker.example/pixel.gif)',
    'red',
    'linear-gradient(red, blue)',
    '#12345',
    'DEFAULT'
  ])('rejects %s', async value => {
    const {owner, board} = await setup();

    const res = await patchBoard(owner._id, board._id, {background: value});

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    const stored = await BoardModel.findById(board._id);
    expect(stored?.background).toBe('default');
    expect(stored?.revision).toBe(board.revision);
  });

  it('still loads a board whose stored background predates the validation', async () => {
    const {owner, board} = await setup();
    await BoardModel.updateOne({_id: board._id}, {background: 'linear-gradient(red, blue)'});

    const session = sessionFor(owner._id);
    const res = await request(app)
      .get(`/api/boards/${board._id.toString()}`)
      .set('Cookie', session.cookie);

    expect(res.status).toBe(200);
    expect(res.body.board.background).toBe('linear-gradient(red, blue)');
  });
});

describe('board background on create', () => {
  function createBoard(userId: Types.ObjectId, body: object) {
    const session = sessionFor(userId);
    return request(app)
      .post('/api/boards')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrf)
      .send(body);
  }

  it('accepts a hex colour', async () => {
    const owner = await createUser();
    const res = await createBoard(owner._id, {name: 'Launch', background: '#2554C7'});
    expect(res.status).toBe(201);
    expect(res.body.board.background).toBe('#2554C7');
  });

  it('rejects a URL, so a new board cannot point at an outside image', async () => {
    const owner = await createUser();
    for (const background of ['https://tracker.example.com/pixel.png', 'url(https://x.test/a.png)']) {
      const res = await createBoard(owner._id, {name: 'Launch', background});
      expectError(res, 400, 'VALIDATION_ERROR');
    }
  });
});

describe('board background photos', () => {
  it('sets the background to the media url from the stored record', async () => {
    const {owner, board} = await setup();
    const media = await createMedia(owner._id, board._id);

    const res = await patchBoard(owner._id, board._id, {
      backgroundMediaId: media._id.toString(),
      expectedRevision: board.revision
    });

    expect(res.status).toBe(200);
    expect(res.body.board).toMatchObject({
      background: media.url,
      backgroundMediaId: media._id.toString(),
      revision: board.revision + 1
    });
  });

  it('lets an editor use an image another member uploaded to the board', async () => {
    const {owner, board} = await setup();
    const editor = await createUser();
    await BoardCollaboratorModel.create({
      boardId: board._id,
      userId: editor._id,
      role: 'editor',
      status: 'accepted',
      invitedBy: owner._id
    });
    const media = await createMedia(owner._id, board._id);

    const res = await patchBoard(editor._id, board._id, {backgroundMediaId: media._id.toString()});

    expect(res.status).toBe(200);
    expect(res.body.board.background).toBe(media.url);
  });

  it('rejects media from another board', async () => {
    const {owner, board} = await setup();
    const other = await BoardModel.create({name: 'Other', ownerId: owner._id});
    const media = await createMedia(owner._id, other._id);

    const res = await patchBoard(owner._id, board._id, {backgroundMediaId: media._id.toString()});

    expectError(res, 400, ErrorCodes.INVALID_BACKGROUND_MEDIA);
  });

  it('rejects media that is not scoped to any board', async () => {
    const {owner, board} = await setup();
    const media = await createMedia(owner._id, null);

    const res = await patchBoard(owner._id, board._id, {backgroundMediaId: media._id.toString()});

    expectError(res, 400, ErrorCodes.INVALID_BACKGROUND_MEDIA);
  });

  it('rejects a non-image', async () => {
    const {owner, board} = await setup();
    const media = await createMedia(owner._id, board._id, {
      kind: 'video',
      resourceType: 'video',
      mimeType: 'video/mp4'
    });

    const res = await patchBoard(owner._id, board._id, {backgroundMediaId: media._id.toString()});

    expectError(res, 400, ErrorCodes.INVALID_BACKGROUND_MEDIA);
  });

  it('rejects a missing id', async () => {
    const {owner, board} = await setup();

    const res = await patchBoard(owner._id, board._id, {
      backgroundMediaId: new Types.ObjectId().toString()
    });

    expectError(res, 400, ErrorCodes.INVALID_BACKGROUND_MEDIA);
  });

  it('rejects an image record whose url is not on our Cloudinary', async () => {
    const {owner, board} = await setup();
    const media = await createMedia(owner._id, board._id, {
      url: 'https://tracker.example/pixel.gif'
    });

    const res = await patchBoard(owner._id, board._id, {backgroundMediaId: media._id.toString()});

    expectError(res, 400, ErrorCodes.INVALID_BACKGROUND_MEDIA);
    const stored = await BoardModel.findById(board._id);
    expect(stored?.background).toBe('default');
  });

  it('resets to the default when the media id is cleared', async () => {
    const {owner, board} = await setup();
    const media = await createMedia(owner._id, board._id);
    await patchBoard(owner._id, board._id, {backgroundMediaId: media._id.toString()});

    const res = await patchBoard(owner._id, board._id, {backgroundMediaId: null});

    expect(res.status).toBe(200);
    expect(res.body.board).toMatchObject({background: 'default', backgroundMediaId: null});
    expect(await MediaAttachmentModel.findById(media._id)).not.toBeNull();
  });

  it('rejects both fields in one request', async () => {
    const {owner, board} = await setup();
    const media = await createMedia(owner._id, board._id);

    const res = await patchBoard(owner._id, board._id, {
      background: '#ffffff',
      backgroundMediaId: media._id.toString()
    });

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
  });

  it('does not let a viewer change the background', async () => {
    const {owner, board} = await setup();
    const viewer = await createUser();
    await BoardCollaboratorModel.create({
      boardId: board._id,
      userId: viewer._id,
      role: 'viewer',
      status: 'accepted',
      invitedBy: owner._id
    });
    const media = await createMedia(owner._id, board._id);

    const colour = await patchBoard(viewer._id, board._id, {background: '#000000'});
    expect(colour.status).toBe(403);
    expect(colour.body.success).toBe(false);

    const photo = await patchBoard(viewer._id, board._id, {
      backgroundMediaId: media._id.toString()
    });
    expect(photo.status).toBe(403);

    const stored = await BoardModel.findById(board._id);
    expect(stored?.background).toBe('default');
    expect(stored?.backgroundMediaId).toBeNull();
  });
});
