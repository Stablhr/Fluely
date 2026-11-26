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

describe('what an editor may write on a card', () => {
  function patchCard(userId: Types.ObjectId, boardId: Types.ObjectId, cardId: Types.ObjectId, body: object) {
    const session = sessionFor(userId);
    return request(app)
      .patch(`/api/boards/${boardId.toString()}/cards/${cardId.toString()}`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrf)
      .send(body);
  }

  it('answers 400, not 500, when a title is over the stored length limit', async () => {
    const {owner, board, card} = await setup();
    // 200 emoji pass the 300-character request limit but are 400 UTF-16 units.
    // Creating runs the model's checks (an update does not), which used to answer 500.
    const session = sessionFor(owner._id);
    const res = await request(app)
      .post(`/api/boards/${board._id.toString()}/cards`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrf)
      .send({listId: card.listId.toString(), title: THUMBS.repeat(200)});
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
  });

  it("cannot rewrite, delete or forge someone else's comment", async () => {
    const {owner, board, card} = await setup();
    const editor = await createUser();
    await addCollaborator(board._id, editor._id, owner._id, 'editor');

    const res = await patchCard(editor._id, board._id, card._id, {
      comments: [{id: 'comment-2', authorId: owner._id.toString(), text: 'Owner says ship it'}]
    });

    expect(res.status).toBe(200);
    const stored = await CardModel.findById(card._id).lean();
    expect(stored?.comments.map(c => [c.id, c.text, String(c.authorId)])).toEqual([
      ['comment-2', 'Owner says ship it', editor._id.toString()],
      ['comment-1', 'Looks good', owner._id.toString()]
    ]);

    const edit = await patchCard(editor._id, board._id, card._id, {
      comments: [{id: 'comment-1', text: 'Changed'}]
    });
    expect(edit.status).toBe(200);
    const after = await CardModel.findById(card._id).lean();
    expect(after?.comments.find(c => c.id === 'comment-1')?.text).toBe('Looks good');
  });

  it("cannot attach another user's private file", async () => {
    const {owner, board, card} = await setup();
    const editor = await createUser();
    const stranger = await createUser();
    await addCollaborator(board._id, editor._id, owner._id, 'editor');
    const privateFile = await MediaAttachmentModel.create({
      ownerId: stranger._id,
      kind: 'image',
      resourceType: 'image',
      originalName: 'secret.png',
      url: 'https://res.cloudinary.com/demo/image/upload/secret.png',
      publicId: 'fluely/content-planner/secret',
      mimeType: 'image/png',
      sizeBytes: 10
    });

    const res = await patchCard(editor._id, board._id, card._id, {mediaIds: [privateFile._id.toString()]});
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('secret.png');

    const own = await MediaAttachmentModel.create({
      ownerId: editor._id,
      kind: 'image',
      resourceType: 'image',
      originalName: 'mine.png',
      url: 'https://res.cloudinary.com/demo/image/upload/mine.png',
      publicId: 'fluely/content-planner/mine',
      mimeType: 'image/png',
      sizeBytes: 10
    });
    expect((await patchCard(editor._id, board._id, card._id, {mediaIds: [own._id.toString()]})).status).toBe(200);
  });
});

describe('invitations and the people list', () => {
  function call(userId: Types.ObjectId, method: 'get' | 'post', path: string, body: object = {}) {
    const session = sessionFor(userId);
    const req = request(app)[method](path).set('Cookie', session.cookie).set('X-CSRF-Token', session.csrf);
    return method === 'post' ? req.send(body) : req;
  }

  it('invites someone again after they declined', async () => {
    const {owner, board} = await setup();
    const invitee = await createUser();
    const invite = () =>
      call(owner._id, 'post', `/api/boards/${board._id}/collaborators`, {email: invitee.email, role: 'editor'});

    const first = await invite();
    expect(first.status).toBe(201);
    const row = await BoardCollaboratorModel.findOne({boardId: board._id, userId: invitee._id});
    expect((await call(invitee._id, 'post', `/api/boards/invitations/${row!._id}`, {decision: 'declined'})).status).toBe(200);

    const again = await invite();
    expect(again.status).toBe(201);
    const rows = await BoardCollaboratorModel.find({boardId: board._id, userId: invitee._id});
    expect(rows.map(r => r.status)).toEqual(['pending']);
  });

  it('refuses to accept an expired invitation by id', async () => {
    const {owner, board} = await setup();
    const invitee = await createUser();
    const row = await BoardCollaboratorModel.create({
      boardId: board._id,
      userId: invitee._id,
      role: 'editor',
      status: 'pending',
      invitedBy: owner._id,
      expiresAt: new Date(Date.now() - 1000)
    });
    const res = await call(invitee._id, 'post', `/api/boards/invitations/${row._id}`, {decision: 'accepted'});
    expect(res.status).toBe(410);
    expect((await BoardCollaboratorModel.findById(row._id))?.status).toBe('expired');
  });

  it('shows emails and invitations only to the owner', async () => {
    const {owner, board} = await setup();
    const editor = await createUser();
    const invited = await createUser();
    await addCollaborator(board._id, editor._id, owner._id, 'editor');
    await BoardCollaboratorModel.create({
      boardId: board._id,
      userId: invited._id,
      role: 'viewer',
      status: 'pending',
      invitedBy: owner._id,
      expiresAt: new Date(Date.now() + 60_000)
    });

    const forOwner = (await call(owner._id, 'get', `/api/boards/${board._id}/collaborators`)).body.collaborators;
    expect(forOwner.map((c: {email: string}) => c.email).sort()).toEqual([editor.email, invited.email].sort());

    const forEditor = (await call(editor._id, 'get', `/api/boards/${board._id}/collaborators`)).body.collaborators;
    expect(forEditor.map((c: {userId: string; email: string}) => [c.userId, c.email])).toEqual([
      [editor._id.toString(), '']
    ]);
    const members = (await call(editor._id, 'get', `/api/boards/${board._id}/members`)).body.members;
    expect(members.every((m: {email: string}) => m.email === '')).toBe(true);
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

function claim(userId: Types.ObjectId, boardId: Types.ObjectId, claims: object[]) {
  const session = sessionFor(userId);
  return request(app)
    .post(`/api/boards/${boardId.toString()}/reactions/claim`)
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrf)
    .send({claims});
}

describe('claiming old anonymous reactions', () => {
  it('turns one anonymous reaction into a named one without changing the count', async () => {
    const {owner, board, card} = await setup({reactions: {[THUMBS]: 1}});

    const res = await claim(owner._id, board._id, [
      {cardId: card._id.toString(), commentId: 'comment-1', emoji: THUMBS}
    ]);
    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(1);
    expect(typeof res.body.revision).toBe('number');

    const stored = await CardModel.findById(card._id).lean();
    expect(stored?.comments[0].reactions).toEqual({
      [THUMBS]: {userIds: [owner._id], legacy: 0}
    });
  });

  it('is idempotent: a second claim by the same person changes nothing', async () => {
    const {owner, board, card} = await setup({reactions: {[THUMBS]: 2}});
    const body = [{cardId: card._id.toString(), commentId: 'comment-1', emoji: THUMBS}];

    expect((await claim(owner._id, board._id, body)).body.claimed).toBe(1);
    const again = await claim(owner._id, board._id, body);
    expect(again.body.claimed).toBe(0);
    expect(again.body.revision).toBeUndefined();

    const stored = await CardModel.findById(card._id).lean();
    expect(stored?.comments[0].reactions).toEqual({
      [THUMBS]: {userIds: [owner._id], legacy: 1}
    });
  });

  it('skips claims that no longer apply instead of failing the batch', async () => {
    const {owner, board, card} = await setup({reactions: {[THUMBS]: 1}});
    const res = await claim(owner._id, board._id, [
      {cardId: card._id.toString(), commentId: 'comment-1', emoji: HEART},
      {cardId: card._id.toString(), commentId: 'missing', emoji: THUMBS},
      {cardId: new Types.ObjectId().toString(), commentId: 'comment-1', emoji: THUMBS},
      {cardId: card._id.toString(), commentId: 'comment-1', emoji: THUMBS}
    ]);
    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(1);
  });

  it('never claims more than the anonymous reactions that exist', async () => {
    const {owner, board, card} = await setup({reactions: {[THUMBS]: 1}});
    const other = await createUser();
    await addCollaborator(board._id, other._id, owner._id, 'editor');
    const body = [{cardId: card._id.toString(), commentId: 'comment-1', emoji: THUMBS}];

    expect((await claim(owner._id, board._id, body)).body.claimed).toBe(1);
    expect((await claim(other._id, board._id, body)).body.claimed).toBe(0);
  });

  it('follows the comment permission', async () => {
    const {owner, board, card} = await setup({
      reactions: {[THUMBS]: 1},
      commentPermission: 'editors'
    });
    const viewer = await createUser();
    await addCollaborator(board._id, viewer._id, owner._id, 'viewer');
    const res = await claim(viewer._id, board._id, [
      {cardId: card._id.toString(), commentId: 'comment-1', emoji: THUMBS}
    ]);
    expectError(res, 403, 'FORBIDDEN');
  });
});
