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
import {ListModel} from '../api/models/List.model';
import {CardModel} from '../api/models/Card.model';

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

const THUMBS = '\u{1F44D}';
const HEART = '❤️';

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return UserModel.create({
    firstName: `First${userCounter}`,
    lastName: 'Person',
    email: `reactions${userCounter}@example.test`,
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

async function addCollaborator(
  boardId: Types.ObjectId,
  userId: Types.ObjectId,
  invitedBy: Types.ObjectId,
  role: 'editor' | 'viewer'
) {
  await BoardCollaboratorModel.create({boardId, userId, role, status: 'accepted', invitedBy});
}

/** A board with one list and one card holding one comment. */
async function setup(
  options: {
    reactions?: Record<string, unknown>;
    commentPermission?: 'everyone' | 'members' | 'editors';
  } = {}
) {
  const owner = await createUser();
  const board = await BoardModel.create({
    name: 'Launch',
    ownerId: owner._id,
    settings: {commentPermission: options.commentPermission ?? 'members', selfJoin: false}
  });
  const list = await ListModel.create({boardId: board._id, name: 'To do'});
  const card = await CardModel.create({
    boardId: board._id,
    listId: list._id,
    position: 0,
    title: 'Write copy',
    comments: [
      {
        id: 'comment-1',
        authorId: owner._id,
        parentId: null,
        text: 'Looks good',
        reactions: options.reactions ?? {},
        createdAt: new Date()
      }
    ]
  });
  return {owner, board, card};
}

function react(
  userId: Types.ObjectId,
  boardId: Types.ObjectId,
  cardId: Types.ObjectId | string,
  commentId: string,
  emoji: unknown
) {
  const session = sessionFor(userId);
  return request(app)
    .post(
      `/api/boards/${boardId.toString()}/cards/${cardId.toString()}/comments/${commentId}/reactions`
    )
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrf)
    .send({emoji});
}

function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.body).toMatchObject({success: false, code});
  expect(typeof res.body.message).toBe('string');
}

describe('toggling a reaction', () => {
  it('adds the caller, then removes them, bumping the revision each time', async () => {
    const {owner, board, card} = await setup();

    const on = await react(owner._id, board._id, card._id, 'comment-1', THUMBS);
    expect(on.status).toBe(200);
    expect(on.body).toEqual({
      comment: {
        id: 'comment-1',
        reactions: {[THUMBS]: {count: 1, userIds: [owner._id.toString()]}}
      },
      revision: board.revision + 1
    });

    const off = await react(owner._id, board._id, card._id, 'comment-1', THUMBS);
    expect(off.status).toBe(200);
    expect(off.body).toEqual({
      comment: {id: 'comment-1', reactions: {}},
      revision: board.revision + 2
    });

    // The emptied emoji is gone from storage, not left behind as an empty set.
    const stored = await CardModel.findById(card._id).lean();
    expect(stored?.comments[0].reactions).toEqual({});
  });

  it('trims the emoji', async () => {
    const {owner, board, card} = await setup();

    const res = await react(owner._id, board._id, card._id, 'comment-1', `  ${HEART} `);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.comment.reactions)).toEqual([HEART]);
  });

  it('keeps both people when two react with the same emoji', async () => {
    const {owner, board, card} = await setup();
    const editor = await createUser();
    await addCollaborator(board._id, editor._id, owner._id, 'editor');

    const [first, second] = await Promise.all([
      react(owner._id, board._id, card._id, 'comment-1', THUMBS),
      react(editor._id, board._id, card._id, 'comment-1', THUMBS)
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const stored = await CardModel.findById(card._id).lean();
    const entry = (stored?.comments[0].reactions as Record<string, {userIds: Types.ObjectId[]}>)[
      THUMBS
    ];
    expect(entry.userIds.map(String).sort()).toEqual(
      [owner._id.toString(), editor._id.toString()].sort()
    );

    const later = first.body.revision > second.body.revision ? first : second;
    expect(later.body.comment.reactions[THUMBS].count).toBe(2);
    expect([...later.body.comment.reactions[THUMBS].userIds].sort()).toEqual(
      [owner._id.toString(), editor._id.toString()].sort()
    );
  });

  it('keeps a legacy count alongside new people, and removing never touches it', async () => {
    const {owner, board, card} = await setup({reactions: {[THUMBS]: 3}});

    const on = await react(owner._id, board._id, card._id, 'comment-1', THUMBS);
    expect(on.status).toBe(200);
    expect(on.body.comment.reactions).toEqual({
      [THUMBS]: {count: 4, userIds: [owner._id.toString()]}
    });

    const stored = await CardModel.findById(card._id).lean();
    expect(stored?.comments[0].reactions).toEqual({
      [THUMBS]: {userIds: [owner._id], legacy: 3}
    });

    const off = await react(owner._id, board._id, card._id, 'comment-1', THUMBS);
    expect(off.status).toBe(200);
    expect(off.body.comment.reactions).toEqual({[THUMBS]: {count: 3, userIds: []}});
  });

  it('reports a comment that does not exist', async () => {
    const {owner, board, card} = await setup();

    const res = await react(owner._id, board._id, card._id, 'no-such-comment', THUMBS);

    expectError(res, 404, ErrorCodes.COMMENT_NOT_FOUND);
  });

  it('reports a card that does not exist', async () => {
    const {owner, board} = await setup();

    const res = await react(owner._id, board._id, new Types.ObjectId(), 'comment-1', THUMBS);

    expectError(res, 404, ErrorCodes.CARD_NOT_FOUND);
  });
});

describe('emoji validation', () => {
  it.each([
    ['an empty string', ''],
    ['whitespace', '   '],
    ['letters', 'abc'],
    ['an emoji with a letter', `${THUMBS}a`],
    ['a dotted path', `${THUMBS}.x`],
    ['a dollar operator', '$set'],
    ['an emoji with a space inside', `${THUMBS} ${HEART}`],
    ['more than 16 code units', THUMBS.repeat(9)],
    ['a number', 5]
  ])('rejects %s', async (_label, emoji) => {
    const {owner, board, card} = await setup();

    const res = await react(owner._id, board._id, card._id, 'comment-1', emoji);

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    const stored = await BoardModel.findById(board._id);
    expect(stored?.revision).toBe(board.revision);
  });

  it('caps a comment at 20 distinct emojis', async () => {
    // 20 legacy emojis already on the comment.
    const reactions: Record<string, number> = {};
    for (let i = 0; i < 20; i += 1) reactions[String.fromCodePoint(0x1f600 + i)] = 1;
    const {owner, board, card} = await setup({reactions});

    const twentyFirst = await react(owner._id, board._id, card._id, 'comment-1', THUMBS);
    expectError(twentyFirst, 400, ErrorCodes.VALIDATION_ERROR);

    // An emoji that is already there can still be joined.
    const existing = await react(
      owner._id,
      board._id,
      card._id,
      'comment-1',
      String.fromCodePoint(0x1f600)
    );
    expect(existing.status).toBe(200);
    expect(Object.keys(existing.body.comment.reactions)).toHaveLength(20);
  });
});

describe('the card PATCH no longer writes reactions', () => {
  it('keeps stored reactions on existing comments and starts new ones empty', async () => {
    const {owner, board, card} = await setup();
    await react(owner._id, board._id, card._id, 'comment-1', THUMBS);
    const current = await BoardModel.findById(board._id);

    const session = sessionFor(owner._id);
    const res = await request(app)
      .patch(`/api/boards/${board._id.toString()}/cards/${card._id.toString()}`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrf)
      .send({
        expectedRevision: current?.revision,
        comments: [
          {id: 'comment-1', text: 'Looks good', reactions: {[THUMBS]: 99, [HEART]: 5}},
          {id: 'comment-2', text: 'New one', reactions: {[HEART]: 7}}
        ]
      });

    expect(res.status).toBe(200);
    const [first, second] = res.body.card.comments;
    expect(first.reactions).toEqual({[THUMBS]: {count: 1, userIds: [owner._id.toString()]}});
    expect(second.reactions).toEqual({});

    const stored = await CardModel.findById(card._id).lean();
    expect(stored?.comments[0].reactions).toEqual({[THUMBS]: {userIds: [owner._id]}});
    expect(stored?.comments[1].reactions ?? {}).toEqual({});
  });
});

describe('who may react', () => {
  it('turns away a viewer on a board where only editors may comment', async () => {
    const {owner, board, card} = await setup({commentPermission: 'editors'});
    const viewer = await createUser();
    await addCollaborator(board._id, viewer._id, owner._id, 'viewer');

    const res = await react(viewer._id, board._id, card._id, 'comment-1', THUMBS);

    expectError(res, 403, ErrorCodes.FORBIDDEN);
    const stored = await CardModel.findById(card._id).lean();
    // An empty object is minimized away on create, so it may read as missing.
    expect(stored?.comments[0].reactions ?? {}).toEqual({});
  });

  it('lets an editor react on that board', async () => {
    const {owner, board, card} = await setup({commentPermission: 'editors'});
    const editor = await createUser();
    await addCollaborator(board._id, editor._id, owner._id, 'editor');

    const res = await react(editor._id, board._id, card._id, 'comment-1', THUMBS);

    expect(res.status).toBe(200);
  });

  it('lets a viewer react where members may comment', async () => {
    const {owner, board, card} = await setup({commentPermission: 'members'});
    const viewer = await createUser();
    await addCollaborator(board._id, viewer._id, owner._id, 'viewer');

    const res = await react(viewer._id, board._id, card._id, 'comment-1', THUMBS);

    expect(res.status).toBe(200);
  });

  it('hides a private board from someone with no access', async () => {
    const {board, card} = await setup();
    const stranger = await createUser();

    const res = await react(stranger._id, board._id, card._id, 'comment-1', THUMBS);

    expectError(res, 404, ErrorCodes.BOARD_NOT_FOUND);
  });
});

describe('reactions in the board structure', () => {
  it('serializes people and legacy counts, omitting empty emojis', async () => {
    const {owner, board, card} = await setup({reactions: {[HEART]: 2, '\u{1F389}': 0}});
    await react(owner._id, board._id, card._id, 'comment-1', THUMBS);

    const session = sessionFor(owner._id);
    const res = await request(app)
      .get(`/api/boards/${board._id.toString()}/structure`)
      .set('Cookie', session.cookie);

    expect(res.status).toBe(200);
    const [served] = res.body.cards;
    expect(served.comments[0].reactions).toEqual({
      [HEART]: {count: 2, userIds: []},
      [THUMBS]: {count: 1, userIds: [owner._id.toString()]}
    });
  });
});
