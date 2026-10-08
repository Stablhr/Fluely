import {Types} from 'mongoose';

jest.mock('../api/repositories/list.repository', () => ({
  listRepository: {
    create: jest.fn(),
    findByIdForBoard: jest.fn(),
    listByBoard: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}));

jest.mock('../api/repositories/card.repository', () => ({
  cardRepository: {
    create: jest.fn(),
    findByIdForBoard: jest.fn(),
    findByListForBoard: jest.fn(),
    listByBoard: jest.fn(),
    update: jest.fn(),
    move: jest.fn(),
    delete: jest.fn(),
    deleteByList: jest.fn()
  }
}));

jest.mock('../api/repositories/board.repository', () => ({
  boardRepository: {
    update: jest.fn(),
    bumpRevision: jest.fn()
  }
}));

// The mutation services run their writes inside `withProductTransaction` and
// tee an activity entry alongside them. The transaction helper is replaced with
// its documented standalone-Mongo fallback (session undefined), so nothing here
// needs a database.
jest.mock('../api/utils/transaction', () => ({
  withProductTransaction: (work: (session: undefined) => Promise<unknown>) =>
    work(undefined)
}));

jest.mock('../api/services/activity.service', () => ({
  activityService: {
    // The implementation is re-installed in `beforeEach` — `resetAllMocks`
    // wipes factory-defined implementations.
    log: jest.fn(),
    list: jest.fn(async () => [])
  }
}));

import {listRepository} from '../api/repositories/list.repository';
import {cardRepository} from '../api/repositories/card.repository';
import {boardRepository} from '../api/repositories/board.repository';
import {listService} from '../api/services/list.service';
import {cardService} from '../api/services/card.service';
import {activityService} from '../api/services/activity.service';

const BOARD = new Types.ObjectId('ccccccccccccccccccccccc1');
const OTHER_BOARD = new Types.ObjectId('ccccccccccccccccccccccc2');
const LIST = new Types.ObjectId('ddddddddddddddddddddddd1');
const OTHER_LIST = new Types.ObjectId('ddddddddddddddddddddddd2');
const CARD = new Types.ObjectId('eeeeeeeeeeeeeeeeeeeeeee1');
const OTHER_CARD = new Types.ObjectId('eeeeeeeeeeeeeeeeeeeeeee2');

/** The account performing the writes — every mutation now records who did it. */
const ACTOR = {
  actorType: 'user' as const,
  actorId: new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaa01')
};

const mockedLists = listRepository as jest.Mocked<typeof listRepository>;
const mockedCards = cardRepository as jest.Mocked<typeof cardRepository>;
const mockedBoards = boardRepository as jest.Mocked<typeof boardRepository>;
const mockedActivity = activityService as jest.Mocked<typeof activityService>;

// Derived from the real signatures, so a change to a repository's return type
// breaks these fakes instead of quietly drifting.
type BoardRow = Parameters<typeof listService.create>[1];
type ListRow = Awaited<ReturnType<typeof listRepository.listByBoard>>[number];
type CardRow = Awaited<ReturnType<typeof cardRepository.listByBoard>>[number];

function board(revision = 4, listOrder: Types.ObjectId[] = []): BoardRow {
  return {_id: BOARD, revision, listOrder} as unknown as BoardRow;
}

function list(overrides: Partial<ListRow> = {}): ListRow {
  return {
    _id: LIST,
    boardId: BOARD,
    name: 'To do',
    assignee: null,
    collapsed: false,
    backgroundColor: null,
    position: 0,
    cardOrder: [],
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as unknown as ListRow;
}

function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    _id: CARD,
    boardId: BOARD,
    listId: LIST,
    title: 'Write copy',
    desc: '',
    coverMediaId: null,
    coverSize: 'medium',
    labelIds: [],
    memberIds: [],
    dueDate: null,
    startDate: null,
    location: null,
    watching: false,
    mediaIds: [],
    archived: false,
    done: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as unknown as CardRow;
}

/** A revision bump that succeeds, unless a test is exercising the conflict. */
function allowBump() {
  mockedBoards.bumpRevision.mockResolvedValue({matchedCount: 1} as never);
}

/** Stands in for the audit write — echoes the entry the service asked to log. */
function installActivityLog() {
  mockedActivity.log.mockImplementation(async (_session, params) => ({
    id: 'activity-1',
    boardId: params.boardId.toString(),
    userId: params.actor.actorId.toString(),
    actionType: params.actionType,
    targetType: params.targetType,
    targetId: params.targetId ?? null,
    metadata: (params.metadata ?? {}) as Record<string, unknown>,
    actor: {id: params.actor.actorId.toString(), name: 'Test Actor'},
    createdAt: new Date(),
    revision: params.revision ?? 0
  }));
}

beforeEach(() => {
  // `resetAllMocks`, not `clearAllMocks`: only the former drains the
  // `mockResolvedValueOnce` queue, and a leftover value from a previous test
  // would make a call that should return null succeed instead.
  jest.resetAllMocks();
  allowBump();
  mockedBoards.update.mockResolvedValue({matchedCount: 1} as never);
  installActivityLog();
});

describe('list writes', () => {
  it('appends a new list to the board order, which is what makes it visible', async () => {
    mockedLists.create.mockResolvedValue(list());

    await listService.create(ACTOR, board(4, [OTHER_LIST]), {name: 'To do'});

    expect(mockedBoards.update).toHaveBeenCalledWith(
      BOARD.toString(),
      {listOrder: [OTHER_LIST, LIST]},
      false,
      undefined
    );
  });

  it('rejects a list that belongs to another board', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(null);

    await expect(
      listService.update(ACTOR, board(), LIST.toString(), {name: 'Renamed'})
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});
  });

  it('refuses a reorder that names a list from another board', async () => {
    mockedLists.listByBoard.mockResolvedValue([list()]);

    await expect(
      listService.reorder(ACTOR, board(), [LIST.toString(), OTHER_LIST.toString()], 4)
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});
  });

  it('does not write the order when a reorder is refused', async () => {
    mockedLists.listByBoard.mockResolvedValue([list()]);

    await expect(
      listService.reorder(ACTOR, board(), [OTHER_LIST.toString()], 4)
    ).rejects.toThrow();

    expect(mockedBoards.bumpRevision).not.toHaveBeenCalled();
    expect(mockedBoards.update).not.toHaveBeenCalled();
  });

  it('takes the list out of the board order on delete', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(list());

    await listService.remove(ACTOR, board(4, [OTHER_LIST, LIST]), LIST.toString(), 4);

    expect(mockedBoards.update).toHaveBeenCalledWith(
      BOARD.toString(),
      {listOrder: [OTHER_LIST]},
      false,
      undefined
    );
    expect(mockedLists.delete).toHaveBeenCalledWith(LIST.toString(), BOARD, undefined);
  });
});

describe('card writes', () => {
  it('refuses to file a card under a list on another board', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(null);

    await expect(
      cardService.create(ACTOR, board(), {listId: OTHER_LIST.toString(), title: 'Sneaky'})
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});

    expect(mockedCards.create).not.toHaveBeenCalled();
  });

  it('appends a new card to its list order', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.create.mockResolvedValue(card());

    await cardService.create(ACTOR, board(), {listId: LIST.toString(), title: 'Write copy'});

    expect(mockedLists.update).toHaveBeenCalledWith(
      LIST.toString(),
      BOARD,
      {cardOrder: [CARD]},
      undefined
    );
  });

  it('rejects a card that belongs to another board', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(null);

    await expect(
      cardService.update(ACTOR, board(), OTHER_CARD.toString(), {title: 'Renamed'})
    ).rejects.toMatchObject({statusCode: 404, code: 'CARD_NOT_FOUND'});
  });

  it('rewrites both list orders when a card moves between lists', async () => {
    // The card is leaving LIST, whose order still mentions it, and joining
    // OTHER_LIST. Leaving either array stale would show the card twice or not
    // at all.
    mockedCards.findByIdForBoard
      .mockResolvedValueOnce(card())
      .mockResolvedValueOnce(card({listId: OTHER_LIST}));
    // Read order matters: the destination list is resolved first, then the list
    // the card is leaving.
    mockedLists.findByIdForBoard
      .mockResolvedValueOnce(list({_id: OTHER_LIST, cardOrder: []}))
      .mockResolvedValueOnce(list({cardOrder: [CARD, OTHER_CARD]}));

    await cardService.move(ACTOR, board(), CARD.toString(), {listId: OTHER_LIST.toString()});

    expect(mockedLists.update).toHaveBeenCalledWith(
      LIST.toString(),
      BOARD,
      {cardOrder: [OTHER_CARD]},
      undefined
    );
    expect(mockedLists.update).toHaveBeenCalledWith(
      OTHER_LIST.toString(),
      BOARD,
      {cardOrder: [CARD]},
      undefined
    );
    expect(mockedCards.move).toHaveBeenCalledWith(
      CARD.toString(),
      BOARD,
      OTHER_LIST,
      undefined
    );
  });

  it('refuses a move whose destination list is on another board', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(card());
    mockedLists.findByIdForBoard.mockResolvedValue(null);

    await expect(
      cardService.move(ACTOR, board(), CARD.toString(), {listId: OTHER_LIST.toString()})
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});

    expect(mockedCards.move).not.toHaveBeenCalled();
  });

  it('refuses a move that smuggles another board card into the order', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(card());
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.listByBoard.mockResolvedValue([card()]);

    await expect(
      cardService.move(ACTOR, board(), CARD.toString(), {
        listId: LIST.toString(),
        cardOrder: [CARD.toString(), OTHER_CARD.toString()]
      })
    ).rejects.toMatchObject({statusCode: 404, code: 'CARD_NOT_FOUND'});

    expect(mockedCards.move).not.toHaveBeenCalled();
  });

  it('takes a deleted card out of its list order', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(card());
    mockedLists.findByIdForBoard.mockResolvedValue(list({cardOrder: [CARD, OTHER_CARD]}));

    await cardService.remove(ACTOR, board(), CARD.toString(), 4);

    expect(mockedLists.update).toHaveBeenCalledWith(
      LIST.toString(),
      BOARD,
      {cardOrder: [OTHER_CARD]},
      undefined
    );
    expect(mockedCards.delete).toHaveBeenCalledWith(CARD.toString(), BOARD, undefined);
  });

  it('refuses a card order naming cards from another board', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.listByBoard.mockResolvedValue([card()]);

    await expect(
      cardService.reorder(ACTOR, board(), LIST.toString(), [OTHER_CARD.toString()], 4)
    ).rejects.toMatchObject({statusCode: 404, code: 'CARD_NOT_FOUND'});
  });
});

describe('child writes share the board revision', () => {
  it('reports a conflict when the revision bump matches nothing', async () => {
    // Someone else committed between the client reading revision 4 and this
    // write landing. The card must not be created.
    mockedBoards.bumpRevision.mockResolvedValue(null as never);
    mockedLists.findByIdForBoard.mockResolvedValue(list());

    await expect(
      listService.create(ACTOR, board(4), {name: 'To do', expectedRevision: 4})
    ).rejects.toMatchObject({statusCode: 409, code: 'REVISION_CONFLICT'});

    expect(mockedLists.create).not.toHaveBeenCalled();
  });

  it('hands back the new revision so the next write is not a self-conflict', async () => {
    // Every child write advances the board's counter. A client that kept
    // sending the revision it started with would have its second write rejected
    // as a conflict with itself, so the new value has to travel back.
    mockedBoards.bumpRevision.mockResolvedValue({revision: 5} as never);
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedLists.create.mockResolvedValue(list() as never);
    mockedBoards.update.mockResolvedValue(undefined as never);

    const result = await listService.create(ACTOR, board(4), {
      name: 'To do',
      expectedRevision: 4,
    });

    expect(result.revision).toBe(5);
  });

  it('folds the expected revision into the bump so the check cannot be skipped', async () => {
    mockedLists.create.mockResolvedValue(list());

    await listService.create(ACTOR, board(4), {name: 'To do', expectedRevision: 4});

    expect(mockedBoards.bumpRevision).toHaveBeenCalledWith(
      {_id: BOARD, revision: 4},
      undefined
    );
  });

  it('bumps without a revision filter when the client sends none', async () => {
    mockedLists.create.mockResolvedValue(list());

    await listService.create(ACTOR, board(4), {name: 'To do'});

    expect(mockedBoards.bumpRevision).toHaveBeenCalledWith({_id: BOARD}, undefined);
  });
});

describe('board structure', () => {
  it('returns lists in the board order and appends any the order omits', async () => {
    const {boardService} = jest.requireActual('../api/services/board.service');
    const second = new Types.ObjectId('ddddddddddddddddddddddd3');
    mockedLists.listByBoard.mockResolvedValue([
      list({_id: LIST}),
      list({_id: second, name: 'Unlisted'})
    ]);
    mockedCards.listByBoard.mockResolvedValue([card()]);

    const result = await boardService.structure(
      board(4, [second, LIST]) as Parameters<typeof boardService.structure>[0]
    );

    // `second` leads the board order, so it must come first even though the
    // unlisted list exists.
    expect(result.lists.map((l: {id: string}) => l.id)).toEqual([
      second.toString(),
      LIST.toString()
    ]);
    expect(result.cards).toHaveLength(1);
  });

  it('keeps a list the order array forgot about', async () => {
    const {boardService} = jest.requireActual('../api/services/board.service');
    mockedLists.listByBoard.mockResolvedValue([list()]);
    mockedCards.listByBoard.mockResolvedValue([]);

    // An empty order array must not make the board look empty.
    const result = await boardService.structure(
      board(4, []) as Parameters<typeof boardService.structure>[0]
    );

    expect(result.lists).toHaveLength(1);
  });
});

describe('an order may only name cards that live in the target list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a card that is on this board but in another list', async () => {
    // The case board-ownership checking cannot catch. This card genuinely
    // belongs to this board, so a board-only check would admit it -- and the
    // card would then sit in two lists' cardOrder while its listId names one.
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.listByBoard.mockResolvedValue([
      card({_id: OTHER_CARD, listId: OTHER_LIST}) as CardRow,
    ]);

    await expect(
      cardService.reorder(ACTOR, board(), LIST.toString(), [OTHER_CARD.toString()]),
    ).rejects.toMatchObject({code: 'CARD_NOT_FOUND'});
    expect(mockedLists.update).not.toHaveBeenCalled();
  });

  it('rejects a card from another board', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.listByBoard.mockResolvedValue([card() as CardRow]);

    await expect(
      cardService.reorder(ACTOR, board(), LIST.toString(), [OTHER_CARD.toString()]),
    ).rejects.toMatchObject({code: 'CARD_NOT_FOUND'});
    expect(mockedLists.update).not.toHaveBeenCalled();
  });

  it('rejects the same card smuggled in through a list PATCH', async () => {
    // The PATCH body accepts a cardOrder and so needs the identical guard;
    // without it any ObjectId could be seeded into a list, including a card id
    // belonging to a different board.
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.listByBoard.mockResolvedValue([card() as CardRow]);

    await expect(
      listService.update(ACTOR, board(), LIST.toString(), {
        cardOrder: [OTHER_CARD.toString()],
      }),
    ).rejects.toMatchObject({code: 'CARD_NOT_FOUND'});
    expect(mockedLists.update).not.toHaveBeenCalled();
  });

  it('accepts an order naming the cards actually in that list', async () => {
    // The counterpart to the first case: the guard has to reject the wrong list,
    // not reject everything, or legitimate reordering would be impossible.
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.listByBoard.mockResolvedValue([
      card() as CardRow,
      card({_id: OTHER_CARD}) as CardRow,
    ]);
    mockedLists.update.mockResolvedValue({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedId: null,
      upsertedCount: 0,
    });

    await cardService.reorder(
      ACTOR,
      board(),
      LIST.toString(),
      [OTHER_CARD.toString(), CARD.toString()],
    );

    expect(mockedLists.update).toHaveBeenCalled();
  });

  it('accepts the card being moved, whose listId is still the source', async () => {
    // A move is validated before listId changes, so the card in transit has to
    // be allowed explicitly or every cross-list move would fail.
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.findByIdForBoard
      .mockResolvedValueOnce(card({listId: OTHER_LIST}))
      .mockResolvedValueOnce(card({listId: LIST}));
    mockedCards.listByBoard.mockResolvedValue([
      card({_id: OTHER_CARD}) as CardRow,
    ]);

    await cardService.move(ACTOR, board(), CARD.toString(), {
      listId: LIST.toString(),
      cardOrder: [OTHER_CARD.toString(), CARD.toString()],
    });

    expect(mockedCards.move).toHaveBeenCalled();
  });
});

describe('every write records who did it', () => {
  it('logs the activity entry with the write', async () => {
    mockedLists.create.mockResolvedValue(list());

    await listService.create(ACTOR, board(4, [OTHER_LIST]), {name: 'To do'});

    expect(mockedActivity.log).toHaveBeenCalledTimes(1);
    expect(mockedActivity.log).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        boardId: BOARD,
        actor: ACTOR,
        actionType: 'list.created',
        targetType: 'list',
        targetId: LIST.toString()
      })
    );
  });

  it('names the activity after the facet that changed', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(card({done: false}));
    mockedLists.findByIdForBoard.mockResolvedValue(list());

    await cardService.update(ACTOR, board(), CARD.toString(), {done: true});

    expect(mockedActivity.log).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({actionType: 'card.status_changed', targetType: 'card'})
    );
  });

  it('logs nothing when the write is refused', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(null);

    await expect(
      listService.update(ACTOR, board(), LIST.toString(), {name: 'Renamed'})
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});

    expect(mockedActivity.log).not.toHaveBeenCalled();
  });

  it('does not record a write that lost the revision race', async () => {
    mockedBoards.bumpRevision.mockResolvedValue(null as never);
    mockedLists.create.mockResolvedValue(list());

    await expect(
      listService.create(ACTOR, board(4), {name: 'To do', expectedRevision: 4})
    ).rejects.toMatchObject({statusCode: 409, code: 'REVISION_CONFLICT'});

    expect(mockedActivity.log).not.toHaveBeenCalled();
  });
});
