import {Types} from 'mongoose';
import {jest} from '@jest/globals';

jest.mock('../api/repositories/board.repository', () => ({
  boardRepository: {
    findById: jest.fn()
  }
}));

jest.mock('../api/repositories/user.repository', () => ({
  userRepository: {
    findById: jest.fn()
  }
}));

jest.mock('../api/services/boardAccess.service', () => ({
  getBoardAccessLevel: jest.fn()
}));

jest.mock('../api/repositories/boardPresence.repository', () => ({
  boardPresenceRepository: {
    upsert: jest.fn(),
    pruneStale: jest.fn(),
    listActive: jest.fn()
  }
}));

jest.mock('../api/services/activity.service', () => ({
  activityService: {
    since: jest.fn()
  }
}));

jest.mock('../api/utils/transaction', () => ({
  withProductTransaction: (work: (session: undefined) => Promise<unknown>) =>
    work(undefined)
}));

jest.mock('../api/utils/actor', () => ({
  actorFromRequest: jest.fn()
}));

import {boardRepository} from '../api/repositories/board.repository';
import {userRepository} from '../api/repositories/user.repository';
import {getBoardAccessLevel} from '../api/services/boardAccess.service';
import {boardPresenceRepository} from '../api/repositories/boardPresence.repository';
import {activityService} from '../api/services/activity.service';
import {actorFromRequest} from '../api/utils/actor';
import {pollService, type PollResult} from '../api/services/poll.service';
import {Actor} from '../api/utils/actor';
import {BoardDocument} from '../api/models/Board.model';

const BOARD_ID = new Types.ObjectId('ccccccccccccccccccccccc1');
const USER_ID = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaa01');

const mockedBoards = boardRepository as jest.Mocked<typeof boardRepository>;
const mockedUsers = userRepository as jest.Mocked<typeof userRepository>;
const mockedAccess = getBoardAccessLevel as jest.MockedFunction<typeof getBoardAccessLevel>;
const mockedPresence = boardPresenceRepository as jest.Mocked<typeof boardPresenceRepository>;
const mockedActivity = activityService as jest.Mocked<typeof activityService>;
const mockedActor = actorFromRequest as jest.MockedFunction<typeof actorFromRequest>;

function makeBoard(revision = 5): BoardDocument {
  return {
    _id: BOARD_ID,
    revision,
    listOrder: [],
    ownerId: USER_ID,
    workspaceId: null,
    visibility: 'private',
    name: 'Test Board',
    description: '',
    background: 'default',
    backgroundMediaId: null,
    labels: [],
    settings: {commentPermission: 'members', selfJoin: false},
    publicSlug: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject() { return this; }
  } as unknown as BoardDocument;
}

function makeActor(actorId = USER_ID): Actor {
  return {actorType: 'user' as const, actorId};
}

function mockRequest(actor: Actor, board: BoardDocument) {
  const req = {
    board,
    params: {boardId: board._id.toString()}
  } as any;
  mockedActor.mockReturnValue(actor);
  mockedAccess.mockResolvedValue('read' as any);
  return req;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('pollService.poll', () => {
  it('upserts presence, prunes stale, returns presence + activity since revision', async () => {
    const board = makeBoard(10);
    const actor = makeActor();

    const now = new Date();
    const cutoff = new Date(now.getTime() - 12_000);

    mockedUsers.findById.mockResolvedValue({
      firstName: 'Test',
      lastName: 'User'
    } as any);

    mockedPresence.upsert.mockResolvedValue({} as any);
    mockedPresence.pruneStale.mockResolvedValue(undefined as any);
    mockedPresence.listActive.mockResolvedValue([
      {userId: USER_ID, name: 'Test User'} as any
    ]);

    mockedActivity.since.mockResolvedValue([
      {
        id: 'act-1',
        boardId: BOARD_ID.toString(),
        userId: USER_ID.toString(),
        actionType: 'card.created',
        targetType: 'card',
        targetId: 'card-1',
        metadata: {title: 'New card', listId: 'list-1'},
        actor: {id: USER_ID.toString(), name: 'Test User'},
        createdAt: new Date(),
        revision: 8
      }
    ]);

    const result = await pollService.poll(board, actor, 7);

    expect(mockedPresence.upsert).toHaveBeenCalledWith(board._id, actor.actorId, 'Test User', undefined);
    expect(mockedPresence.pruneStale).toHaveBeenCalledWith(board._id, expect.any(Date), undefined);
    expect(mockedPresence.listActive).toHaveBeenCalledWith(board._id, expect.any(Date), undefined);
    expect(mockedActivity.since).toHaveBeenCalledWith(board._id, 7);

    expect(result.revision).toBe(10);
    expect(result.presence).toEqual([{id: USER_ID.toString(), name: 'Test User'}]);
    expect(result.activity).toHaveLength(1);
    expect(result.activity[0].actionType).toBe('card.created');
  });

  it('defaults since to board.revision when undefined', async () => {
    const board = makeBoard(12);
    const actor = makeActor();

    mockedPresence.upsert.mockResolvedValue({} as any);
    mockedPresence.pruneStale.mockResolvedValue(undefined as any);
    mockedPresence.listActive.mockResolvedValue([]);
    mockedActivity.since.mockResolvedValue([]);

    const result = await pollService.poll(board, actor, undefined);

    expect(mockedActivity.since).toHaveBeenCalledWith(board._id, 12);
    expect(result.revision).toBe(12);
  });

  it('resolves user name from repository', async () => {
    const board = makeBoard(5);
    const actor = makeActor();

    mockedUsers.findById.mockResolvedValue({
      firstName: 'Jane',
      lastName: 'Doe'
    } as any);

    mockedPresence.upsert.mockResolvedValue({} as any);
    mockedPresence.pruneStale.mockResolvedValue(undefined as any);
    mockedPresence.listActive.mockResolvedValue([]);
    mockedActivity.since.mockResolvedValue([]);

    await pollService.poll(board, actor, 4);

    expect(mockedUsers.findById).toHaveBeenCalledWith(actor.actorId.toString());
    expect(mockedPresence.upsert).toHaveBeenCalledWith(
      board._id,
      actor.actorId,
      'Jane Doe',
      undefined
    );
  });
});

describe('pollController.poll', () => {
  it('returns poll result on success', async () => {
    const board = makeBoard(8);
    const actor = makeActor();
    const req = mockRequest(actor, board);
    req.query = {since: '6'};

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    } as any;

    const mockResult: PollResult = {
      revision: 8,
      presence: [{id: USER_ID.toString(), name: 'Test User'}],
      activity: [
        {
          id: 'act-1',
          boardId: BOARD_ID.toString(),
          userId: USER_ID.toString(),
          actionType: 'card.moved',
          targetType: 'card',
          targetId: 'card-1',
          metadata: {title: 'Moved', fromListId: 'l1', toListId: 'l2'},
          actor: {id: USER_ID.toString(), name: 'Test User'},
          createdAt: new Date(),
          revision: 7
        }
      ]
    };

    jest.spyOn(pollService, 'poll').mockResolvedValue(mockResult);

    await import('../api/controllers/poll.controller').then(m => m.pollController.poll(req, res));

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockResult
    });
  });

  it('returns 400 for invalid since parameter', async () => {
    const board = makeBoard(5);
    const actor = makeActor();
    const req = mockRequest(actor, board);
    req.query = {since: 'not-a-number'};

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    } as any;

    await expect(
      import('../api/controllers/poll.controller').then(m => m.pollController.poll(req, res))
    ).rejects.toMatchObject({statusCode: 400, code: 'VALIDATION_ERROR'});
  });
});