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

import {listRepository} from '../api/repositories/list.repository';
import {cardRepository} from '../api/repositories/card.repository';
import {boardRepository} from '../api/repositories/board.repository';
import {listService} from '../api/services/list.service';
import {cardService} from '../api/services/card.service';

const BOARD = new Types.ObjectId('ccccccccccccccccccccccc1');
const OTHER_BOARD = new Types.ObjectId('ccccccccccccccccccccccc2');
const LIST = new Types.ObjectId('ddddddddddddddddddddddd1');
const OTHER_LIST = new Types.ObjectId('ddddddddddddddddddddddd2');
const CARD = new Types.ObjectId('eeeeeeeeeeeeeeeeeeeeeee1');
const OTHER_CARD = new Types.ObjectId('eeeeeeeeeeeeeeeeeeeeeee2');

const mockedLists = listRepository as jest.Mocked<typeof listRepository>;
const mockedCards = cardRepository as jest.Mocked<typeof cardRepository>;
const mockedBoards = boardRepository as jest.Mocked<typeof boardRepository>;

// Derived from the real signatures, so a change to a repository's return type
// breaks these fakes instead of quietly drifting.
type BoardRow = Parameters<typeof listService.create>[0];
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

beforeEach(() => {
  // `resetAllMocks`, not `clearAllMocks`: only the former drains the
  // `mockResolvedValueOnce` queue, and a leftover value from a previous test
  // would make a call that should return null succeed instead.
  jest.resetAllMocks();
  allowBump();
  mockedBoards.update.mockResolvedValue({matchedCount: 1} as never);
});

describe('list writes', () => {
  it('appends a new list to the board order, which is what makes it visible', async () => {
    mockedLists.create.mockResolvedValue(list());

    await listService.create(board(4, [OTHER_LIST]), {name: 'To do'});

    expect(mockedBoards.update).toHaveBeenCalledWith(
      BOARD.toString(),
      {listOrder: [OTHER_LIST, LIST]},
      false
    );
  });

  it('rejects a list that belongs to another board', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(null);

    await expect(
      listService.update(board(), LIST.toString(), {name: 'Renamed'})
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});
  });

  it('refuses a reorder that names a list from another board', async () => {
    mockedLists.listByBoard.mockResolvedValue([list()]);

    await expect(
      listService.reorder(board(), [LIST.toString(), OTHER_LIST.toString()], 4)
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});
  });

  it('does not write the order when a reorder is refused', async () => {
    mockedLists.listByBoard.mockResolvedValue([list()]);

    await expect(listService.reorder(board(), [OTHER_LIST.toString()], 4)).rejects.toThrow();

    expect(mockedBoards.bumpRevision).not.toHaveBeenCalled();
    expect(mockedBoards.update).not.toHaveBeenCalled();
  });

  it('takes the list out of the board order on delete', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(list());

    await listService.remove(board(4, [OTHER_LIST, LIST]), LIST.toString(), 4);

    expect(mockedBoards.update).toHaveBeenCalledWith(
      BOARD.toString(),
      {listOrder: [OTHER_LIST]},
      false
    );
    expect(mockedLists.delete).toHaveBeenCalledWith(LIST.toString(), BOARD);
  });
});

describe('card writes', () => {
  it('refuses to file a card under a list on another board', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(null);

    await expect(
      cardService.create(board(), {listId: OTHER_LIST.toString(), title: 'Sneaky'})
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});

    expect(mockedCards.create).not.toHaveBeenCalled();
  });

  it('appends a new card to its list order', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.create.mockResolvedValue(card());

    await cardService.create(board(), {listId: LIST.toString(), title: 'Write copy'});

    expect(mockedLists.update).toHaveBeenCalledWith(LIST.toString(), BOARD, {
      cardOrder: [CARD]
    });
  });

  it('rejects a card that belongs to another board', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(null);

    await expect(
      cardService.update(board(), OTHER_CARD.toString(), {title: 'Renamed'})
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

    await cardService.move(board(), CARD.toString(), {listId: OTHER_LIST.toString()});

    expect(mockedLists.update).toHaveBeenCalledWith(LIST.toString(), BOARD, {
      cardOrder: [OTHER_CARD]
    });
    expect(mockedLists.update).toHaveBeenCalledWith(OTHER_LIST.toString(), BOARD, {
      cardOrder: [CARD]
    });
    expect(mockedCards.move).toHaveBeenCalledWith(CARD.toString(), BOARD, OTHER_LIST);
  });

  it('refuses a move whose destination list is on another board', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(card());
    mockedLists.findByIdForBoard.mockResolvedValue(null);

    await expect(
      cardService.move(board(), CARD.toString(), {listId: OTHER_LIST.toString()})
    ).rejects.toMatchObject({statusCode: 404, code: 'LIST_NOT_FOUND'});

    expect(mockedCards.move).not.toHaveBeenCalled();
  });

  it('refuses a move that smuggles another board card into the order', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(card());
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.listByBoard.mockResolvedValue([card()]);

    await expect(
      cardService.move(board(), CARD.toString(), {
        listId: LIST.toString(),
        cardOrder: [CARD.toString(), OTHER_CARD.toString()]
      })
    ).rejects.toMatchObject({statusCode: 404, code: 'CARD_NOT_FOUND'});

    expect(mockedCards.move).not.toHaveBeenCalled();
  });

  it('takes a deleted card out of its list order', async () => {
    mockedCards.findByIdForBoard.mockResolvedValue(card());
    mockedLists.findByIdForBoard.mockResolvedValue(list({cardOrder: [CARD, OTHER_CARD]}));

    await cardService.remove(board(), CARD.toString(), 4);

    expect(mockedLists.update).toHaveBeenCalledWith(LIST.toString(), BOARD, {
      cardOrder: [OTHER_CARD]
    });
    expect(mockedCards.delete).toHaveBeenCalledWith(CARD.toString(), BOARD);
  });

  it('refuses a card order naming cards from another board', async () => {
    mockedLists.findByIdForBoard.mockResolvedValue(list());
    mockedCards.listByBoard.mockResolvedValue([card()]);

    await expect(
      cardService.reorder(board(), LIST.toString(), [OTHER_CARD.toString()], 4)
    ).rejects.toMatchObject({statusCode: 404, code: 'CARD_NOT_FOUND'});
  });
});

describe('child writes share the board revision', () => {
  it('reports a conflict when the revision bump matches nothing', async () => {
    // Someone else committed between the client reading revision 4 and this
    // write landing. The card must not be created.
    mockedBoards.bumpRevision.mockResolvedValue({matchedCount: 0} as never);
    mockedLists.findByIdForBoard.mockResolvedValue(list());

    await expect(
      listService.create(board(4), {name: 'To do', expectedRevision: 4})
    ).rejects.toMatchObject({statusCode: 409, code: 'REVISION_CONFLICT'});

    expect(mockedLists.create).not.toHaveBeenCalled();
  });

  it('folds the expected revision into the bump so the check cannot be skipped', async () => {
    mockedLists.create.mockResolvedValue(list());

    await listService.create(board(4), {name: 'To do', expectedRevision: 4});

    expect(mockedBoards.bumpRevision).toHaveBeenCalledWith({_id: BOARD, revision: 4});
  });

  it('bumps without a revision filter when the client sends none', async () => {
    mockedLists.create.mockResolvedValue(list());

    await listService.create(board(4), {name: 'To do'});

    expect(mockedBoards.bumpRevision).toHaveBeenCalledWith({_id: BOARD});
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
