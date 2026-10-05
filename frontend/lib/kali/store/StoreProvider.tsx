"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AppData,
  Board,
  Card,
  List,
  Label,
  Collaborator,
  CollaboratorRole,
  SocialPost,
  SocialPostPlatform,
  SocialMediaAttachment,
  SocialAnalytics,
  Platform,
  Visibility,
} from "./schema";
import {
  BOARD_TEMPLATES,
  emptyData,
  YOU_ID,
  canWriteBoard,
  canManageBoard,
} from "./schema";
import { clearData, loadData, saveData } from "./storage";
import { StoreContext } from "./useStore";
import type { PendingInvitation, Store, StoreUser } from "./useStore";
import { uid } from "@/lib/kali/utils/id";
import { formatDate } from "@/lib/kali/utils/dates";
import { useSocialPosts } from "@/lib/kali/feature-hooks/useSocialPosts";
import {
  createBoardOnServer,
  fetchBoards,
  fetchCollaborators,
  fetchPendingInvitations,
  inviteCollaborator as inviteCollaboratorOnServer,
  mergeServerBoard,
  removeCollaboratorOnServer,
  respondToInvitation as respondToInvitationOnServer,
  setBoardVisibilityOnServer,
  setCollaboratorRoleOnServer,
} from "@/lib/kali/api/boards";
import {
  createCardOnServer,
  createListOnServer,
  deleteCardOnServer,
  deleteListOnServer,
  fetchStructure,
  moveCardOnServer,
  reorderCardsOnServer,
  reorderListsOnServer,
  toCard,
  toList,
  updateCardOnServer,
  updateListOnServer,
} from "@/lib/kali/api/boardChildren";
import type {CreateCardInput, StructureDto} from "@/lib/kali/api/boardChildren";
import { getFriendlyErrorMessage } from "@/lib/api/getFriendlyErrorMessage";

function patchRecord<T extends { id: string }>(
  rec: Record<string, T>,
  id: string,
  patch: Partial<T>,
): Record<string, T> {
  const item = rec[id];
  if (!item) return rec;
  return { ...rec, [id]: { ...item, ...patch } };
}

const now = () => new Date().toISOString();

/**
 * Whether a board has a server row behind it.
 *
 * This is the switch that keeps the app usable while children are being moved
 * to the server: a board created here, or a template, has no `ownerId` and no
 * revision, so it keeps working entirely on local mutations. Everything else
 * goes to the server and is reconciled with what comes back.
 */
function isServerBoard(board: Board | undefined): board is Board {
  return Boolean(board?.ownerId && board.revision !== null);
}

/**
 * Translates a store card patch into the server's vocabulary.
 *
 * Four card fields never leave the browser -- `cover`, `files`, `comments`, and
 * `activity` hold base64 image data or notes the server has no column for -- so
 * they are dropped here rather than sent and rejected. `watching` is a
 * per-person flag that belongs in the user's own record, not on a shared board
 * document, so it stays local as well; sending it would let one person's
 * "watching" state show up on everybody else's board.
 *
 * Only fields actually present in the patch are included, so an absent key stays
 * absent on the wire instead of being sent as null and clearing the column.
 */
function toCardPatch(patch: Partial<Card>): Partial<CreateCardInput> {
  const out: Partial<CreateCardInput> = {};
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.desc !== undefined) out.desc = patch.desc;
  if (patch.dueDate !== undefined) out.dueDate = patch.dueDate;
  if (patch.startDate !== undefined) out.startDate = patch.startDate;
  if (patch.location !== undefined) out.location = patch.location;
  if (patch.labelIds !== undefined) out.labelIds = patch.labelIds;
  if (patch.memberIds !== undefined) out.memberIds = patch.memberIds;
  return out;
}

/**
 * Stamp the signed-in person's name onto the local "you" member.
 *
 * The store is persisted under a single key that is not namespaced per account,
 * so a name written for one person would otherwise still be sitting there for
 * whoever signs in next on the same browser. Reapplying it on every mount is
 * what makes that safe: it corrects the stored name, and it picks up one changed
 * in settings.
 *
 * An empty name is ignored, so a response that somehow lacks one falls back to
 * the seeded "You" rather than blanking the chip.
 */
function withUserName(data: AppData, name: string | undefined): AppData {
  const trimmed = name?.trim();
  const member = data.members[YOU_ID];
  if (!trimmed || !member || member.name === trimmed) return data;

  return {
    ...data,
    members: { ...data.members, [YOU_ID]: { ...member, name: trimmed } },
  };
}

function makeCard(list: List, title: string, extra: Partial<Card> = {}): Card {
  return {
    id: uid(),
    boardId: list.boardId,
    listId: list.id,
    title,
    desc: "",
    cover: null,
    coverSize: "small",
    labelIds: [],
    memberIds: [],
    dueDate: null,
    startDate: null,
    location: "",
    watching: false,
    archived: false,
    done: false,
    files: [],
    comments: [],
    activity: [],
    createdAt: now(),
    updatedAt: now(),
    ...extra,
  };
}

function withCardAdded(prev: AppData, card: Card): AppData {
  const list = prev.lists[card.listId];
  if (!list) return prev;
  const board = prev.boards[card.boardId];
  return {
    ...prev,
    cards: { ...prev.cards, [card.id]: card },
    lists: {
      ...prev.lists,
      [card.listId]: { ...list, cardOrder: [...list.cardOrder, card.id] },
    },
    boards: board
      ? { ...prev.boards, [board.id]: { ...board, updatedAt: now() } }
      : prev.boards,
  };
}

interface StoreProviderProps {
  children: ReactNode;
  /**
   * The signed-in person.
   *
   * Injected rather than fetched here so this store stays independent of auth
   * — it is persisted app data and has no business knowing about tokens or
   * sessions. The id is what separates a board the person owns from one shared
   * with them, which is the difference between an editable board and a
   * read-only one.
   */
  currentUser?: StoreUser;
}

export function StoreProvider({ children, currentUser }: StoreProviderProps) {
  /* Named in the initializer rather than in an effect: the layout only mounts
     this once it knows who is signed in, so the name is available on the very
     first render, and the store has no reason to repaint a frame with the wrong
     name first. Every account change unmounts this — sign-out and sign-in both
     swap the whole route tree — so a remount always re-reads the name. */
  const [data, setData] = useState<AppData>(() =>
    withUserName(loadData(), currentUser?.name),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitation[]
  >([]);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Social posts: API-first with localStorage fallback
  const social = useSocialPosts();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        saveData(dataRef.current);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save your changes.",
        );
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    const flush = () => {
      try {
        saveData(dataRef.current);
      } catch {
        // best effort on unload
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  const dismissError = () => setError(null);

  const mutate = (fn: (draft: AppData) => AppData) => setData(fn);

  /* ── Board children (lists and cards) ──────────────────────────────
     A board with a server row is the source of truth for its lists and cards;
     everything below writes through and reconciles what comes back. A board that
     only ever existed in this browser has no `ownerId` and no revision, so it
     keeps working on local mutations alone -- that is what `isServerBoard`
     decides, and it is why the app stays usable with an un-imported board. */

  /**
   * Marks a board's children as owned by the server, so the one-time import
   * never runs again for it.
   */
  const markChildrenSynced = useCallback((boardId: string) => {
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board) return prev;
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: { ...board, childrenSyncedAt: now() },
        },
      };
    });
  }, []);

  /**
   * Pushes a board's local lists and cards to the server, once.
   *
   * Boards created before lists and cards became server-backed have real work
   * sitting only in the browser. Taking the server's -- empty -- view of them
   * would blank those boards, so on the first reconcile they are pushed up
   * instead.
   *
   * Matched by position and name rather than through a stored id map, which
   * makes a re-run complete a half-finished import instead of duplicating it:
   * each local list is compared with the server list at the same index, and only
   * the ones that do not line up are created. Once the marker is set this never
   * runs again, so a board whose lists were deliberately emptied is not
   * silently refilled from the browser.
   */
  const importLocalChildren = useCallback(
    async (boardId: string, server: StructureDto) => {
      const data = dataRef.current;
      const board = data.boards[boardId];
      if (!board) return;

      const localLists = board.listOrder
        .map(id => data.lists[id])
        .filter((list): list is List => Boolean(list));

      if (localLists.length === 0) {
        markChildrenSynced(boardId);
        return;
      }

      let revision: number | undefined = board.revision ?? undefined;

      for (let i = 0; i < localLists.length; i += 1) {
        const local = localLists[i];
        const existing = server.lists[i];

        let listId: string;
        let serverCardOrder: string[] = existing?.cardOrder ?? [];

        if (existing && existing.name === local.name) {
          listId = existing.id;
        } else {
          const created = await createListOnServer(boardId, {
            name: local.name,
            backgroundColor: local.backgroundColor || null,
            position: i,
            expectedRevision: revision,
          });
          listId = created.id;
          serverCardOrder = [];
          revision = created.revision;
        }

        const localCards = local.cardOrder
          .map(id => data.cards[id])
          .filter((card): card is Card => Boolean(card));

        for (let j = 0; j < localCards.length; j += 1) {
          if (serverCardOrder[j]) continue;
          const card = await createCardOnServer(boardId, {
            listId,
            title: localCards[j].title,
            desc: localCards[j].desc,
            dueDate: localCards[j].dueDate,
            startDate: localCards[j].startDate,
            location: localCards[j].location || null,
            labelIds: localCards[j].labelIds,
            memberIds: localCards[j].memberIds,
            expectedRevision: revision,
          });
          revision = card.revision;
        }
      }

      markChildrenSynced(boardId);
    },
    [markChildrenSynced],
  );

  /**
   * Records a board's revision after a child write.
   *
   * Every list and card write advances the board's single concurrency counter,
   * so the local copy has to move with it or the next write would be rejected
   * as a conflict with this one.
   */
  const applyRevision = (boardId: string, revision: number | undefined) => {
    if (typeof revision !== "number") return;
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board) return prev;
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: { ...board, revision },
        },
      };
    });
  };

  /**
   * Pulls a board's lists and cards and merges them in.
   *
   * Merge, not replace, and that is the whole subtlety. Four card fields --
   * `cover`, `files`, `comments`, `activity` -- exist only in the browser: the
   * first three hold base64 image data too large to put in a board document,
   * and the fourth is generated locally as a side effect of acting. A wholesale
   * replace would drop a user's attachments and notes on every sync, so
   * `toCard` keeps the local copy of those and lets the server own the rest.
   */
  const syncBoardStructure = useCallback(async (boardId: string) => {
    const board = dataRef.current.boards[boardId];
    if (!isServerBoard(board)) return;

    try {
      let structure = await fetchStructure(boardId);

      // A board whose children have never been reconciled is holding real work
      // the server has not seen, so push that up before adopting the server's
      // view of it. Everything after this point can trust the server's order.
      //
      // The push is followed by a second read rather than a recursive call:
      // `importLocalChildren` sets the synced marker, so one more fetch is all
      // it takes to reach the state the recursion was re-entering to get.
      if (!board.childrenSyncedAt) {
        await importLocalChildren(boardId, structure);
        structure = await fetchStructure(boardId);
      }

      mutate((prev) => {
        const current = prev.boards[boardId];
        if (!current) return prev;

        const lists: Record<string, List> = {...prev.lists};
        const cards: Record<string, Card> = {...prev.cards};

        structure.lists.forEach((dto, index) => {
          lists[dto.id] = toList(dto, index, lists[dto.id]);
        });
        structure.cards.forEach((dto) => {
          cards[dto.id] = toCard(dto, cards[dto.id]);
        });

        // The board's own list order comes from the server, since that array is
        // the authority. Local lists the server has never heard of are dropped
        // from the sequence but left in the records, so nothing is destroyed if
        // this turns out to be the wrong call.
        const serverListOrder = structure.lists.map(list => list.id);
        const serverCardIds = new Set(structure.cards.map(card => card.id));

        // Once the server owns this board's children, a record it does not know
        // about is a write that failed, not unsaved work -- so it is pruned
        // rather than left behind as an orphan that nothing will ever render.
        if (current.childrenSyncedAt) {
          for (const [id, list] of Object.entries(lists)) {
            if (list.boardId === boardId && !serverListOrder.includes(id)) {
              delete lists[id];
            }
          }
          for (const [id, card] of Object.entries(cards)) {
            if (card.boardId === boardId && !serverCardIds.has(id)) {
              delete cards[id];
            }
          }
        }

        return {
          ...prev,
          lists,
          cards,
          boards: {
            ...prev.boards,
            [boardId]: {
              ...current,
              listOrder: serverListOrder,
              updatedAt: current.updatedAt,
            },
          },
        };
      });
    } catch (err) {
      setError(
        getFriendlyErrorMessage(err, "Could not load this board’s contents."),
      );
    }
  }, [importLocalChildren, mutate, setError]);

  /**
   * Sends a child write to the server and adopts the new board revision.
   *
   * On rejection the board is re-read rather than rewound to a captured
   * snapshot. The server is the source of truth for a synced board, so pulling
   * it again is both simpler than a per-mutation rollback and more honest: it
   * also picks up anything a collaborator changed in the meantime, which a
   * rollback to a stale local copy would have silently discarded.
   */
  const writeThrough = useCallback(
    async (
      boardId: string,
      send: (revision: number | undefined) => Promise<number | undefined>,
      failureMessage: string,
    ) => {
      try {
        const revision = await send(
          dataRef.current.boards[boardId]?.revision ?? undefined,
        );
        applyRevision(boardId, revision);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, failureMessage));
        void syncBoardStructure(boardId);
      }
    },
    [applyRevision, syncBoardStructure, setError],
  );

  const getBoard = (id: string) => data.boards[id];
  const getCard = (id: string) => data.cards[id];

  const getLists = (boardId: string): List[] => {
    const board = data.boards[boardId];
    if (!board) return [];
    return board.listOrder.map((id) => data.lists[id]).filter(Boolean);
  };

  const getCards = (listId: string): Card[] => {
    const list = data.lists[listId];
    if (!list) return [];
    return list.cardOrder.map((id) => data.cards[id]).filter(Boolean);
  };

  /**
   * Builds a board from a template.
   *
   * The board itself is created on the server, so it gets a real id, an owner, a
   * revision counter, and a place in the workspace. Its lists and labels are
   * still only local: the server models those as separate child resources, and
   * that work is not done yet. So the board row is written from the server's
   * response and the template scaffolding is attached underneath it.
   *
   * Rejects if the request fails, rather than creating a local-only board, so
   * the user is never left with a board that silently cannot be shared.
   */
  const createBoard = async (
    templateId: string,
    name: string,
  ): Promise<string> => {
    const template =
      BOARD_TEMPLATES.find((t) => t.id === templateId) ?? BOARD_TEMPLATES[0];

    const labels: Record<string, Label> = {};
    const labelPayload = template.labels.map((l) => {
      const id = uid();
      labels[id] = { id, name: l.name, color: l.color };
      return { id, name: l.name, color: l.color };
    });

    let dto;
    try {
      dto = await createBoardOnServer({
        name,
        description: template.description,
        background: template.swatch,
        templateId: template.id,
        labels: labelPayload,
      });
    } catch (err) {
      setError(
        getFriendlyErrorMessage(
          err,
          "Could not create the board. Please try again.",
        ),
      );
      throw err;
    }

    const boardId = dto.id;
    const lists: Record<string, List> = {};
    const listOrder: string[] = [];
    template.lists.forEach((listName, order) => {
      const id = uid();
      lists[id] = {
        id,
        boardId,
        name: listName,
        assignee: "",
        collapsed: false,
        order,
        cardOrder: [],
        backgroundColor: "",
      };
      listOrder.push(id);
    });

    const board: Board = {
      ...mergeServerBoard(undefined, dto),
      id: boardId,
      starred: false,
      listOrder,
      labels,
      collaborators: [],
      settings: { commentPermission: "members", selfJoin: false },
      activity: [],
      archivedLists: [],
    };

    mutate((prev) => ({
      ...prev,
      boards: { ...prev.boards, [boardId]: board },
      lists: { ...prev.lists, ...lists },
      ui: { ...prev.ui, lastVisitedBoardId: boardId },
    }));
    return boardId;
  };

  const deleteBoard = (id: string) => {
    mutate((prev) => {
      const board = prev.boards[id];
      if (!board) return prev;
      const listIds = new Set(board.listOrder);
      const lists: Record<string, List> = {};
      for (const [k, v] of Object.entries(prev.lists)) {
        if (!listIds.has(k)) lists[k] = v;
      }
      const cards: Record<string, Card> = {};
      for (const [k, v] of Object.entries(prev.cards)) {
        if (!listIds.has(v.listId)) cards[k] = v;
      }
      const boards = { ...prev.boards };
      delete boards[id];
      return {
        ...prev,
        boards,
        lists,
        cards,
        ui: {
          ...prev.ui,
          lastVisitedBoardId:
            prev.ui.lastVisitedBoardId === id
              ? null
              : prev.ui.lastVisitedBoardId,
        },
      };
    });
  };

  const renameBoard = (id: string, name: string) =>
    mutate((prev) => ({
      ...prev,
      boards: patchRecord(prev.boards, id, { name, updatedAt: now() }),
    }));

  const toggleStar = (id: string) =>
    mutate((prev) => {
      const board = prev.boards[id];
      if (!board) return prev;
      return {
        ...prev,
        boards: patchRecord(prev.boards, id, {
          starred: !board.starred,
          updatedAt: now(),
        }),
      };
    });

  const addList = (boardId: string, name: string) => {
    const id = uid();
    if (isServerBoard(dataRef.current.boards[boardId])) {
      void writeThrough(
        boardId,
        revision =>
          createListOnServer(boardId, { name, expectedRevision: revision }).then(
            created => {
              // The server names the list, so the optimistic local row is
              // re-keyed onto the real id rather than left to disagree with it.
              mutate(prev => {
                const local = prev.lists[id];
                if (!local) return prev;
                const lists = {...prev.lists};
                delete lists[id];
                lists[created.id] = {...local, id: created.id, name: created.name};
                const board = prev.boards[boardId];
                return {
                  ...prev,
                  lists,
                  boards: board
                    ? {
                        ...prev.boards,
                        [boardId]: {
                          ...board,
                          listOrder: board.listOrder.map(x =>
                            x === id ? created.id : x,
                          ),
                        },
                      }
                    : prev.boards,
                };
              });
              return created.revision;
            },
          ),
        "Could not add that list.",
      );
    }
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board) return prev;
      const list: List = {
        id,
        boardId,
        name,
        assignee: "",
        collapsed: false,
        order: board.listOrder.length,
        cardOrder: [],
        backgroundColor: "",
      };
      return {
        ...prev,
        lists: { ...prev.lists, [id]: list },
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            listOrder: [...board.listOrder, id],
            activity: [
              { id: uid(), text: `Created list '${name}'`, createdAt: now() },
              ...(board.activity ?? []),
            ],
            updatedAt: now(),
          },
        },
      };
    });
  };

  const renameList = (id: string, name: string) => {
    const list = dataRef.current.lists[id];
    if (list && isServerBoard(dataRef.current.boards[list.boardId])) {
      void writeThrough(
        list.boardId,
        revision =>
          updateListOnServer(list.boardId, id, {
            name,
            expectedRevision: revision,
          }).then(updated => {
            mutate(prev => {
              const current = prev.lists[id];
              if (!current) return prev;
              return {
                ...prev,
                lists: {
                  ...prev.lists,
                  [id]: {
                    ...current,
                    name: updated.name,
                    collapsed: updated.collapsed,
                    backgroundColor: updated.backgroundColor ?? "",
                    cardOrder: updated.cardOrder ?? current.cardOrder,
                  },
                },
              };
            });
            return updated.revision;
          }),
        "Could not rename that list.",
      );
    }
    mutate((prev) => {
      const list = prev.lists[id];
      if (!list) return prev;
      const board = prev.boards[list.boardId];
      return {
        ...prev,
        lists: patchRecord(prev.lists, id, { name }),
        boards: board
          ? {
              ...prev.boards,
              [list.boardId]: {
                ...board,
                activity: [
                  {
                    id: uid(),
                    text: `Renamed list to '${name}'`,
                    createdAt: now(),
                  },
                  ...(board.activity ?? []),
                ],
                updatedAt: now(),
              },
            }
          : prev.boards,
      };
    });
  };

  /**
   * Sends a list field change to the server when the board has one.
   *
   * The three simple list setters below differ only in which field they touch,
   * so they share this rather than each repeating the write-through and the
   * reconciliation.
   */
  /**
   * Finds the member id behind a display name.
   *
   * The store's list and card `assignee` is a name, while the server's is a
   * reference to a user. Null means the name belongs to nobody in the member
   * list -- a leftover from a board this person cannot see the roster of -- and
   * the caller keeps that value local instead of sending an id that is not
   * there.
   */
  const resolveMemberId = (name: string): string | null => {
    if (!name) return null;
    const match = Object.values(dataRef.current.members).find(
      member => member.name === name,
    );
    return match?.id ?? null;
  };

  const patchListOnServer = (
    id: string,
    local: Partial<List>,
    server: {
      backgroundColor?: string | null;
      collapsed?: boolean;
      assignee?: string | null;
    },
    failureMessage: string,
  ) => {
    const list = dataRef.current.lists[id];
    if (!list || !isServerBoard(dataRef.current.boards[list.boardId])) return;

    void writeThrough(
      list.boardId,
      revision =>
        updateListOnServer(list.boardId, id, {
          ...server,
          expectedRevision: revision,
        }).then(updated => {
          mutate(prev => {
            const current = prev.lists[id];
            if (!current) return prev;
            return {
              ...prev,
              lists: {
                ...prev.lists,
                [id]: {
                  ...current,
                  ...local,
                  collapsed: updated.collapsed ?? current.collapsed,
                  backgroundColor:
                    updated.backgroundColor ?? current.backgroundColor,
                  cardOrder: updated.cardOrder ?? current.cardOrder,
                },
              },
            };
          });
          return updated.revision;
        }),
      failureMessage,
    );
  };

  const setListAssignee = (id: string, name: string) => {
    patchListOnServer(
      id,
      {assignee: name},
      // The store keeps a display name where the server keeps a user id, so the
      // name is resolved against the board's members. A name that matches nobody
      // is left local rather than sent as a bogus id -- the server would reject
      // it, and a rejected write is worse than one that never leaves.
      {assignee: resolveMemberId(name)},
      "Could not assign that list.",
    );
    mutate((prev) => ({
      ...prev,
      lists: patchRecord(prev.lists, id, { assignee: name }),
    }));
  };

  const setListBackgroundColor = (id: string, color: string) => {
    patchListOnServer(
      id,
      { backgroundColor: color },
      { backgroundColor: color || null },
      "Could not change that list’s colour.",
    );
    mutate((prev) => ({
      ...prev,
      lists: patchRecord(prev.lists, id, { backgroundColor: color }),
    }));
  };

  const toggleListCollapsed = (id: string) => {
    const collapsed = !(dataRef.current.lists[id]?.collapsed ?? false);
    patchListOnServer(id, { collapsed }, { collapsed }, "Could not collapse that list.");
    mutate((prev) => {
      const list = prev.lists[id];
      if (!list) return prev;
      return {
        ...prev,
        lists: patchRecord(prev.lists, id, { collapsed: !list.collapsed }),
      };
    });
  };

  const archiveList = (id: string) => {
    mutate((prev) => {
      const list = prev.lists[id];
      if (!list) return prev;
      const board = prev.boards[list.boardId];
      if (!board) return prev;
      const cardIds = new Set(list.cardOrder);
      const archivedCards: Card[] = list.cardOrder
        .map((cid) => prev.cards[cid])
        .filter((c): c is Card => Boolean(c));
      const archivedEntry = { list: { ...list }, cards: archivedCards };
      const cards: Record<string, Card> = {};
      for (const [k, v] of Object.entries(prev.cards)) {
        if (!cardIds.has(k)) cards[k] = v;
      }
      const lists = { ...prev.lists };
      delete lists[id];
      const boardActivity = [
        { id: uid(), text: `Archived list '${list.name}'`, createdAt: now() },
        ...(board.activity ?? []),
      ];
      return {
        ...prev,
        lists,
        cards,
        boards: {
          ...prev.boards,
          [list.boardId]: {
            ...board,
            listOrder: board.listOrder.filter((x) => x !== id),
            archivedLists: [...(board.archivedLists ?? []), archivedEntry],
            activity: boardActivity,
            updatedAt: now(),
          },
        },
      };
    });
  };

  const restoreList = (boardId: string, archivedIndex: number) => {
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board) return prev;
      const entry = (board.archivedLists ?? [])[archivedIndex];
      if (!entry) return prev;
      const { list, cards: archivedCards } = entry;
      const newLists = { ...prev.lists, [list.id]: list };
      const newCards = { ...prev.cards };
      for (const c of archivedCards) {
        newCards[c.id] = c;
      }
      const boardActivity = [
        { id: uid(), text: `Restored list '${list.name}'`, createdAt: now() },
        ...(board.activity ?? []),
      ];
      return {
        ...prev,
        lists: newLists,
        cards: newCards,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            listOrder: [...board.listOrder, list.id],
            archivedLists: (board.archivedLists ?? []).filter(
              (_, i) => i !== archivedIndex,
            ),
            activity: boardActivity,
            updatedAt: now(),
          },
        },
      };
    });
  };

  const moveList = (boardId: string, startIndex: number, endIndex: number) => {
    // Computed up front from the committed order rather than from inside the
    // reducer: this is the array that has to be sent, and the reducer's draft is
    // not available outside it.
    const current = dataRef.current.boards[boardId];
    if (current && isServerBoard(current)) {
      const order = [...current.listOrder];
      const [moved] = order.splice(startIndex, 1);
      if (moved) {
        order.splice(endIndex, 0, moved);
        void writeThrough(
          boardId,
          revision =>
            reorderListsOnServer(boardId, order, revision).then(
              result => result.revision,
            ),
          "Could not move that list.",
        );
      }
    }
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board) return prev;
      const order = [...board.listOrder];
      const [moved] = order.splice(startIndex, 1);
      if (!moved) return prev;
      order.splice(endIndex, 0, moved);
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: { ...board, listOrder: order, updatedAt: now() },
        },
      };
    });
  };

  const addCard = (listId: string, title: string): string => {
    const id = uid();
    const list = dataRef.current.lists[listId];
    if (list && isServerBoard(dataRef.current.boards[list.boardId])) {
      void writeThrough(
        list.boardId,
        revision =>
          createCardOnServer(list.boardId, {
            listId,
            title,
            expectedRevision: revision,
          }).then(created => {
            // Re-key the optimistic card onto the server's id, and drop it from
            // the list's local order: the server appends it, so leaving the
            // placeholder in place would show the card twice.
            mutate(prev => {
              const local = prev.cards[id];
              if (!local) return prev;
              const cards = {...prev.cards};
              delete cards[id];
              cards[created.id] = toCard(created, {...local, id: created.id});
              const target = prev.lists[listId];
              return {
                ...prev,
                cards,
                lists: target
                  ? {
                      ...prev.lists,
                      [listId]: {
                        ...target,
                        cardOrder: target.cardOrder
                          .filter(x => x !== id)
                          .concat(created.id),
                      },
                    }
                  : prev.lists,
              };
            });
            return created.revision;
          }),
        "Could not add that card.",
      );
    }
    mutate((prev) => {
      const list = prev.lists[listId];
      if (!list) return prev;
      const board = prev.boards[list.boardId];
      const card = makeCard(list, title, { id });
      const base = withCardAdded(prev, card);
      return board
        ? {
            ...base,
            boards: {
              ...base.boards,
              [list.boardId]: {
                ...base.boards[list.boardId],
                activity: [
                  {
                    id: uid(),
                    text: `Created card '${title}'`,
                    createdAt: now(),
                  },
                  ...(base.boards[list.boardId]?.activity ?? []),
                ],
              },
            },
          }
        : base;
    });
    return id;
  };

  const deleteCard = (id: string) => {
    const card = dataRef.current.cards[id];
    if (card && isServerBoard(dataRef.current.boards[card.boardId])) {
      void writeThrough(
        card.boardId,
        revision =>
          deleteCardOnServer(card.boardId, id, revision).then(newRevision => {
            return newRevision;
          }),
        "Could not delete that card.",
      );
    }
    mutate((prev) => {
      const card = prev.cards[id];
      if (!card) return prev;
      const cards = { ...prev.cards };
      delete cards[id];
      const list = prev.lists[card.listId];
      if (!list) return { ...prev, cards };
      return {
        ...prev,
        cards,
        lists: {
          ...prev.lists,
          [card.listId]: {
            ...list,
            cardOrder: list.cardOrder.filter((x) => x !== id),
          },
        },
      };
    });
  };

  const updateCard = (id: string, patch: Partial<Card>) => {
    const card = dataRef.current.cards[id];
    if (card && isServerBoard(dataRef.current.boards[card.boardId])) {
      void writeThrough(
        card.boardId,
            () =>
          updateCardOnServer(card.boardId, id, toCardPatch(patch)).then(
            (updated) => {
              mutate((prev) => {
                const current = prev.cards[id];
                if (!current) return prev;
                return {
                  ...prev,
                  cards: {
                    ...prev.cards,
                    [id]: {...toCard(updated, current), ...patch},
                  },
                };
              });
              return updated.revision;
            },
          ),
        "Could not save that card.",
      );
    }
    mutate((prev) => ({
      ...prev,
      cards: patchRecord(prev.cards, id, { ...patch, updatedAt: now() }),
    }));
  };

  const moveCard = (cardId: string, destListId: string, destIndex: number) => {
    const card = dataRef.current.cards[cardId];
    const dest = dataRef.current.lists[destListId];
    if (card && dest && isServerBoard(dataRef.current.boards[card.boardId])) {
      // The destination's whole new order is computed here rather than sent as
      // an index: the source list has to be rewritten too, and the two are only
      // consistent if the client states both sides at once.
      const srcListId = card.listId;
      const src = dataRef.current.lists[srcListId];
      const destOrder =
        srcListId === destListId
          ? (src?.cardOrder ?? []).filter(x => x !== cardId)
          : dest.cardOrder.filter(x => x !== cardId);
      destOrder.splice(destIndex, 0, cardId);

      void writeThrough(
        card.boardId,
        revision =>
          moveCardOnServer(card.boardId, cardId, {
            listId: destListId,
            cardOrder: destOrder,
            expectedRevision: revision,
          }).then(result => result.revision),
        "Could not move that card.",
      );
    }
    mutate((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      const srcListId = card.listId;
      const src = prev.lists[srcListId];
      const dest = prev.lists[destListId];
      if (!src || !dest) return prev;
      const srcOrder = src.cardOrder.filter((id) => id !== cardId);
      const destOrder =
        srcListId === destListId
          ? srcOrder
          : dest.cardOrder.filter((id) => id !== cardId);
      destOrder.splice(destIndex, 0, cardId);
      const movedText =
        srcListId === destListId
          ? "moved this card within the list"
          : `moved this card to ${dest.name}`;
      const board = prev.boards[card.boardId];
      const boardActivity =
        board && srcListId !== destListId
          ? [
              {
                id: uid(),
                text: `Moved '${card.title}' from ${src.name} to ${dest.name}`,
                createdAt: now(),
              },
              ...(board.activity ?? []),
            ]
          : (board?.activity ?? []);
      return {
        ...prev,
        lists: {
          ...prev.lists,
          [srcListId]: { ...src, cardOrder: srcOrder },
          [destListId]: { ...dest, cardOrder: destOrder },
        },
        cards: {
          ...prev.cards,
          [cardId]: {
            ...card,
            listId: destListId,
            updatedAt: now(),
            activity: [
              { id: uid(), text: movedText, createdAt: now() },
              ...card.activity,
            ],
          },
        },
        boards: board
          ? {
              ...prev.boards,
              [card.boardId]: {
                ...board,
                activity: boardActivity,
                updatedAt: now(),
              },
            }
          : prev.boards,
      };
    });
  };

  const addActivity = (cardId: string, text: string) => {
    mutate((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: {
            ...card,
            updatedAt: now(),
            activity: [{ id: uid(), text, createdAt: now() }, ...card.activity],
          },
        },
      };
    });
  };

  const addInboxItem = (text: string) =>
    mutate((prev) => ({
      ...prev,
      inbox: [{ id: uid(), text, createdAt: now() }, ...prev.inbox],
    }));

  const dismissInboxItem = (id: string) =>
    mutate((prev) => ({
      ...prev,
      inbox: prev.inbox.filter((i) => i.id !== id),
    }));

  const archiveCard = (id: string) =>
    mutate((prev) => {
      const card = prev.cards[id];
      if (!card || card.archived) return prev;
      const board = prev.boards[card.boardId];
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: {
            ...card,
            archived: true,
            updatedAt: now(),
            activity: [
              { id: uid(), text: "archived this card", createdAt: now() },
              ...card.activity,
            ],
          },
        },
        boards: board
          ? {
              ...prev.boards,
              [card.boardId]: {
                ...board,
                activity: [
                  {
                    id: uid(),
                    text: `Archived card '${card.title}'`,
                    createdAt: now(),
                  },
                  ...(board.activity ?? []),
                ],
                updatedAt: now(),
              },
            }
          : prev.boards,
      };
    });

  const restoreCard = (id: string) =>
    mutate((prev) => {
      const card = prev.cards[id];
      if (!card || !card.archived) return prev;
      let listId = card.listId;
      let listName = prev.lists[listId]?.name;
      if (!prev.lists[listId]) {
        const board = prev.boards[card.boardId];
        listId = board?.listOrder[0] ?? card.listId;
        listName = prev.lists[listId]?.name ?? "a list";
      }
      const board = prev.boards[card.boardId];
      const boardActivity = board
        ? [
            {
              id: uid(),
              text: `Restored card '${card.title}' to ${listName}`,
              createdAt: now(),
            },
            ...(board.activity ?? []),
          ]
        : [];
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: {
            ...card,
            archived: false,
            listId,
            updatedAt: now(),
            activity: [
              { id: uid(), text: "restored this card", createdAt: now() },
              ...card.activity,
            ],
          },
        },
        boards: board
          ? {
              ...prev.boards,
              [card.boardId]: {
                ...board,
                activity: boardActivity,
                updatedAt: now(),
              },
            }
          : prev.boards,
      };
    });

  const toggleDone = (id: string) =>
    mutate((prev) => {
      const card = prev.cards[id];
      if (!card) return prev;
      const done = !card.done;
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: {
            ...card,
            done,
            updatedAt: now(),
            activity: [
              {
                id: uid(),
                text: done ? "marked this card as done" : "reopened this card",
                createdAt: now(),
              },
              ...card.activity,
            ],
          },
        },
      };
    });

  /**
   * Changes a board's visibility, optimistically.
   *
   * The local row flips immediately so the menu feels instant, then the server
   * is asked. If the server refuses — most often a revision conflict, or a board
   * this person does not own — the local row is rolled back to exactly what it
   * was. Showing the choice and then quietly undoing it would be worse than
   * waiting, so the rollback is paired with an error the user can act on.
   *
   * The revision travels with the request: it is what lets the server reject a
   * change made against a stale copy instead of overwriting someone else's.
   */
  const setBoardVisibility = async (id: string, visibility: Visibility) => {
    const board = dataRef.current.boards[id];
    if (!board) return;
    if (board.visibility === visibility) return;

    const previous = {
      visibility: board.visibility,
      publicSlug: board.publicSlug,
    };

    mutate((prev) => {
      const current = prev.boards[id];
      if (!current) return prev;
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [id]: {
            ...current,
            visibility,
            // The slug is the server's to mint. Dropping it locally stops a
            // revoked link from being offered in the moment before the reload.
            publicSlug: visibility === "public" ? current.publicSlug : null,
            activity: [
              {
                id: uid(),
                text: `Changed visibility to ${visibility}`,
                createdAt: now(),
              },
              ...(current.activity ?? []),
            ],
            updatedAt: now(),
          },
        },
      };
    });

    setPendingBoardId(id);
    try {
      const dto = await setBoardVisibilityOnServer(
        id,
        visibility,
        board.revision,
      );
      mutate((prev) => {
        const current = prev.boards[id];
        if (!current) return prev;
        return {
          ...prev,
          boards: {
            ...prev.boards,
            [id]: { ...current, ...mergeServerBoard(current, dto) },
          },
        };
      });
    } catch (err) {
      mutate((prev) => {
        const current = prev.boards[id];
        if (!current) return prev;
        return {
          ...prev,
          boards: { ...prev.boards, [id]: { ...current, ...previous } },
        };
      });
      setError(
        getFriendlyErrorMessage(
          err,
          "Could not change who can see this board.",
        ),
      );
    } finally {
      setPendingBoardId(null);
    }
  };

  const setBoardBackground = (id: string, background: string) =>
    mutate((prev) => {
      const board = prev.boards[id];
      if (!board) return prev;
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [id]: {
            ...board,
            background,
            activity: [
              { id: uid(), text: "Changed board background", createdAt: now() },
              ...(board.activity ?? []),
            ],
            updatedAt: now(),
          },
        },
      };
    });

  const setBoardDescription = (id: string, description: string) =>
    mutate((prev) => ({
      ...prev,
      boards: patchRecord(prev.boards, id, { description, updatedAt: now() }),
    }));

  const addBoardActivity = (boardId: string, text: string) =>
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board) return prev;
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            activity: [
              { id: uid(), text, createdAt: now() },
              ...(board.activity ?? []),
            ],
            updatedAt: now(),
          },
        },
      };
    });

  const setBoardSettings = (
    boardId: string,
    patch: Partial<Board["settings"]>,
  ) =>
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board) return prev;
      const currentSettings = board.settings ?? {
        commentPermission: "members" as const,
        selfJoin: false,
      };
      const newSettings = { ...currentSettings, ...patch };
      const changed: string[] = [];
      if (
        patch.commentPermission &&
        patch.commentPermission !== currentSettings.commentPermission
      ) {
        changed.push(
          `comments to ${patch.commentPermission === "members" ? "board members" : "anyone"}`,
        );
      }
      if (
        patch.selfJoin !== undefined &&
        patch.selfJoin !== currentSettings.selfJoin
      ) {
        changed.push(`self-join ${patch.selfJoin ? "enabled" : "disabled"}`);
      }
      const activityText =
        changed.length > 0
          ? `Updated settings: ${changed.join(", ")}`
          : "Updated board settings";
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            settings: newSettings,
            activity: [
              { id: uid(), text: activityText, createdAt: now() },
              ...(board.activity ?? []),
            ],
            updatedAt: now(),
          },
        },
      };
    });

  const makeTemplate = (boardId: string): string => {
    const srcBoard = data.boards[boardId];
    if (!srcBoard) return "";
    const newBoardId = uid();
    const labels: Record<string, Label> = {};
    Object.values(srcBoard.labels).forEach((l) => {
      const id = uid();
      labels[id] = { id, name: l.name, color: l.color };
    });
    const newLists: Record<string, List> = {};
    const listOrder: string[] = [];
    srcBoard.listOrder.forEach((listId) => {
      const src = data.lists[listId];
      if (!src) return;
      const newId = uid();
      newLists[newId] = {
        ...src,
        id: newId,
        boardId: newBoardId,
        cardOrder: [],
      };
      listOrder.push(newId);
    });
    const newBoard: Board = {
      id: newBoardId,
      name: `${srcBoard.name} (template)`,
      description: srcBoard.description,
      visibility: "private",
      starred: false,
      background: srcBoard.background,
      createdAt: now(),
      updatedAt: now(),
      listOrder,
      labels,
      collaborators: [],
      access: "owner",
      ownerId: null,
      workspaceId: null,
      publicSlug: null,
      revision: null,
      settings: { commentPermission: "members", selfJoin: false },
      activity: [
        {
          id: uid(),
          text: `Created template from '${srcBoard.name}'`,
          createdAt: now(),
        },
      ],
      archivedLists: [],
    };
    mutate((prev) => ({
      ...prev,
      boards: { ...prev.boards, [newBoardId]: newBoard },
      lists: { ...prev.lists, ...newLists },
      ui: { ...prev.ui, lastVisitedBoardId: newBoardId },
    }));
    return newBoardId;
  };

  const addLabel = (boardId: string, name: string, color: string): string => {
    const id = uid();
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board) return prev;
      const label: Label = { id, name, color };
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            labels: { ...board.labels, [id]: label },
            activity: [
              { id: uid(), text: `Created label '${name}'`, createdAt: now() },
              ...(board.activity ?? []),
            ],
            updatedAt: now(),
          },
        },
      };
    });
    return id;
  };

  const updateLabel = (
    boardId: string,
    labelId: string,
    patch: Partial<Label>,
  ) =>
    mutate((prev) => {
      const board = prev.boards[boardId];
      const label = board?.labels[labelId];
      if (!board || !label) return prev;
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            labels: { ...board.labels, [labelId]: { ...label, ...patch } },
            updatedAt: now(),
          },
        },
      };
    });

  const deleteLabel = (boardId: string, labelId: string) =>
    mutate((prev) => {
      const board = prev.boards[boardId];
      if (!board || !board.labels[labelId]) return prev;
      const labelName = board.labels[labelId].name;
      const labels = { ...board.labels };
      delete labels[labelId];
      const cards: Record<string, Card> = {};
      for (const [k, v] of Object.entries(prev.cards)) {
        cards[k] =
          v.boardId === boardId && v.labelIds.includes(labelId)
            ? { ...v, labelIds: v.labelIds.filter((l) => l !== labelId) }
            : v;
      }
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            labels,
            activity: [
              {
                id: uid(),
                text: `Deleted label '${labelName}'`,
                createdAt: now(),
              },
              ...(board.activity ?? []),
            ],
            updatedAt: now(),
          },
        },
        cards,
      };
    });

  /* ── Collaboration ────────────────────────────────────────────────
     The four share actions below used to append a name to a local array. They
     now go to the server, because a name the server has never heard of cannot
     grant anyone access to anything. */

  const boardAccess = useCallback(
    (id: string) => dataRef.current.boards[id]?.access ?? "none",
    [],
  );

  const canWrite = useCallback(
    (id: string) => canWriteBoard(boardAccess(id)),
    [boardAccess],
  );

  const canManage = useCallback(
    (id: string) => canManageBoard(boardAccess(id)),
    [boardAccess],
  );

  const getCollaborators = useCallback(
    (boardId: string): Collaborator[] =>
      dataRef.current.boards[boardId]?.collaborators ?? [],
    [],
  );

  /**
   * Pulls the boards this person can reach and merges them in.
   *
   * Merge rather than replace, because lists and cards are still local: a
   * wholesale replace with the server payload would blank every board down to
   * the empty `listOrder` the server knows about. Boards that exist only in this
   * browser are left alone, which is what keeps an un-imported workspace
   * intact.
   */
  const syncBoards = useCallback(async () => {
    try {
      const [dtos, invitations] = await Promise.all([
        fetchBoards("accessible"),
        fetchPendingInvitations().catch(() => [] as PendingInvitation[]),
      ]);

      setPendingInvitations(invitations as PendingInvitation[]);

      if (dtos.length === 0) return;

      mutate((prev) => {
        const boards: Record<string, Board> = { ...prev.boards };
        for (const dto of dtos) {
          const existing = boards[dto.id];
          // A board the server knows about but this browser has never seen still
          // needs the local-only fields, or it would have no lists to render.
          const local: Board = existing ?? {
            id: dto.id,
            name: dto.name,
            description: dto.description ?? "",
            visibility: dto.visibility,
            starred: false,
            background: dto.background ?? "",
            createdAt: dto.createdAt,
            updatedAt: dto.updatedAt,
            listOrder: [],
            labels: {},
            collaborators: [],
            access: dto.access,
            ownerId: dto.ownerId,
            workspaceId: dto.workspaceId,
            publicSlug: dto.publicSlug,
            revision: dto.revision,
            settings: { commentPermission: "members", selfJoin: false },
            activity: [],
            archivedLists: [],
          };
          boards[dto.id] = { ...local, ...mergeServerBoard(existing, dto) };
        }
        return { ...prev, boards };
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not load your boards."));
    }
  }, []);

  // One pull per mount. The layout remounts this on every account change, so
  // there is no need to watch for a user switch here.
  //
  // Wrapped in an inner async function rather than called inline, matching how
  // useSocialPosts does its mount fetch: the state updates then happen after an
  // await rather than during the effect body itself.
  useEffect(() => {
    async function load() {
      try {
        await syncBoards();
      } catch {
        // syncBoards has already put a readable message in the error slot.
      }
    }
    void load();
  }, [syncBoards]);

  const loadCollaborators = useCallback(async (boardId: string) => {
    try {
      const collaborators = await fetchCollaborators(boardId);
      mutate((prev) => {
        const board = prev.boards[boardId];
        if (!board) return prev;
        return {
          ...prev,
          boards: { ...prev.boards, [boardId]: { ...board, collaborators } },
        };
      });
    } catch (err) {
      setError(
        getFriendlyErrorMessage(
          err,
          "Could not load the people on this board.",
        ),
      );
    }
  }, []);

  const inviteCollaborator = async (
    boardId: string,
    email: string,
    role: CollaboratorRole,
  ) => {
    setPendingBoardId(boardId);
    try {
      const collaborator = await inviteCollaboratorOnServer(
        boardId,
        email,
        role,
      );
      mutate((prev) => {
        const board = prev.boards[boardId];
        if (!board) return prev;
        const collaborators = board.collaborators.some(
          (c) => c.id === collaborator.id,
        )
          ? board.collaborators.map((c) =>
              c.id === collaborator.id ? collaborator : c,
            )
          : [...board.collaborators, collaborator];
        return {
          ...prev,
          boards: {
            ...prev.boards,
            [boardId]: {
              ...board,
              collaborators,
              activity: [
                {
                  id: uid(),
                  text: `Invited ${collaborator.name} as ${role}`,
                  createdAt: now(),
                },
                ...(board.activity ?? []),
              ],
            },
          },
        };
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not send that invitation."));
      throw err;
    } finally {
      setPendingBoardId(null);
    }
  };

  const setCollaboratorRole = async (
    boardId: string,
    collaboratorId: string,
    role: CollaboratorRole,
  ) => {
    const board = dataRef.current.boards[boardId];
    const previous = board?.collaborators.find(
      (c) => c.id === collaboratorId,
    )?.role;
    if (previous === role) return;

    setPendingBoardId(boardId);
    // Optimistic: the dropdown should not lag a round trip behind the click.
    mutate((prev) => {
      const current = prev.boards[boardId];
      if (!current) return prev;
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...current,
            collaborators: current.collaborators.map((c) =>
              c.id === collaboratorId ? { ...c, role } : c,
            ),
          },
        },
      };
    });

    try {
      await setCollaboratorRoleOnServer(boardId, collaboratorId, role);
    } catch (err) {
      if (previous) {
        mutate((prev) => {
          const current = prev.boards[boardId];
          if (!current) return prev;
          return {
            ...prev,
            boards: {
              ...prev.boards,
              [boardId]: {
                ...current,
                collaborators: current.collaborators.map((c) =>
                  c.id === collaboratorId ? { ...c, role: previous } : c,
                ),
              },
            },
          };
        });
      }
      setError(
        getFriendlyErrorMessage(err, "Could not change that person’s access."),
      );
    } finally {
      setPendingBoardId(null);
    }
  };

  const removeCollaborator = async (
    boardId: string,
    collaboratorId: string,
  ) => {
    const board = dataRef.current.boards[boardId];
    const removed = board?.collaborators.find((c) => c.id === collaboratorId);
    const previous = board?.collaborators ?? [];

    setPendingBoardId(boardId);
    mutate((prev) => {
      const current = prev.boards[boardId];
      if (!current) return prev;
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...current,
            collaborators: current.collaborators.filter(
              (c) => c.id !== collaboratorId,
            ),
            activity: removed
              ? [
                  {
                    id: uid(),
                    text: `Removed ${removed.name}`,
                    createdAt: now(),
                  },
                  ...(current.activity ?? []),
                ]
              : current.activity,
          },
        },
      };
    });

    try {
      await removeCollaboratorOnServer(boardId, collaboratorId);
    } catch (err) {
      mutate((prev) => {
        const current = prev.boards[boardId];
        if (!current) return prev;
        return {
          ...prev,
          boards: {
            ...prev.boards,
            [boardId]: { ...current, collaborators: previous },
          },
        };
      });
      setError(getFriendlyErrorMessage(err, "Could not remove that person."));
    } finally {
      setPendingBoardId(null);
    }
  };

  const respondToInvitation = async (
    invitationId: string,
    decision: "accepted" | "declined",
  ) => {
    try {
      await respondToInvitationOnServer(invitationId, decision);
      // Accepting grants access, so the new board has to be pulled in; either
      // way the invitation is gone from this person's list.
      setPendingInvitations((prev) =>
        prev.filter((i) => i.id !== invitationId),
      );
      if (decision === "accepted") await syncBoards();
    } catch (err) {
      setError(
        getFriendlyErrorMessage(err, "Could not answer that invitation."),
      );
      throw err;
    }
  };

  const moveInboxToBoard = (itemId: string, boardId: string, listId: string) =>
    mutate((prev) => {
      const item = prev.inbox.find((i) => i.id === itemId);
      const list = prev.lists[listId];
      if (!item || !list || list.boardId !== boardId) return prev;
      const card = makeCard(list, item.text, {
        activity: [{ id: uid(), text: "created from inbox", createdAt: now() }],
      });
      return {
        ...withCardAdded(prev, card),
        inbox: prev.inbox.filter((i) => i.id !== itemId),
      };
    });

  const scheduleInboxItem = (itemId: string, boardId: string, date: string) =>
    mutate((prev) => {
      const item = prev.inbox.find((i) => i.id === itemId);
      const board = prev.boards[boardId];
      if (!item || !board || board.listOrder.length === 0) return prev;
      const listId = board.listOrder[0];
      const list = prev.lists[listId];
      if (!list) return prev;
      const card = makeCard(list, item.text, {
        dueDate: date,
        activity: [
          {
            id: uid(),
            text: `scheduled for ${formatDate(date)}`,
            createdAt: now(),
          },
          { id: uid(), text: "created from inbox", createdAt: now() },
        ],
      });
      return {
        ...withCardAdded(prev, card),
        inbox: prev.inbox.filter((i) => i.id !== itemId),
      };
    });

  const resetAll = () => {
    clearData();
    setData(withUserName(emptyData(), currentUser?.name));
  };

  /* ── Social Posts (delegated to useSocialPosts hook) ──────────── */

  const addSocialPost = (
    input: Omit<SocialPost, "id" | "createdAt" | "updatedAt">,
  ): SocialPost => {
    // Synchronous wrapper — fires API call in background, returns optimistic result
    const optimistic: SocialPost = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    };
    social.addPost(input).catch(() => {});
    return optimistic;
  };

  const updateSocialPost = (id: string, patch: Partial<SocialPost>) =>
    social.updatePost(id, patch);

  const deleteSocialPost = (id: string) => social.deletePost(id);

  const duplicateSocialPost = (id: string): SocialPost | null =>
    social.duplicatePost(id);

  const moveSocialPost = (id: string, newDate: string, newTime?: string) =>
    social.movePost(id, newDate, newTime);

  const scheduleSocialPost = (
    id: string,
    input: {
      scheduledDate: string;
      scheduledTime?: string;
      timezone?: string;
      repeat?: SocialPost["repeat"];
      repeatUntil?: string;
    },
  ) => social.schedulePost(id, input);

  const cancelSocialPost = (id: string, platform?: Platform) =>
    social.cancelPost(id, platform);

  const retrySocialPost = (id: string, platform?: Platform) =>
    social.retryPost(id, platform);

  const refreshSocialJobs = (postId?: string) => social.refreshJobs(postId);

  const refreshSocialPost = (postId: string) => social.refreshPost(postId);

  const getSocialPostsByDate = (date: string): SocialPost[] =>
    social.getByDate(date);

  const getSocialPostsByPlatform = (platform: Platform): SocialPost[] =>
    social.getByPlatform(platform);

  const getSocialPostsByStatus = (status: SocialPost["status"]): SocialPost[] =>
    social.getByStatus(status);

  const getSocialPostsByCard = (cardId: string): SocialPost[] =>
    social.getByCard(cardId);

  const getUnscheduledPosts = (): SocialPost[] => social.getUnscheduled();

  const addPlatformToPost = (postId: string, platform: Platform) =>
    social.addPlatform(postId, platform);

  const removePlatformFromPost = (postId: string, platform: Platform) =>
    social.removePlatform(postId, platform);

  const updatePostPlatform = (
    postId: string,
    platform: Platform,
    patch: Partial<SocialPostPlatform>,
  ) => social.updatePlatform(postId, platform, patch);

  const addMediaToPost = (
    postId: string,
    media: Omit<SocialMediaAttachment, "id">,
  ) => social.addMedia(postId, media);

  const removeMediaFromPost = (postId: string, mediaId: string) =>
    social.removeMedia(postId, mediaId);

  const updatePostAnalytics = (
    postId: string,
    platform: Platform,
    analytics: SocialAnalytics,
  ) => social.updateAnalytics(postId, platform, analytics);

  const boards = useMemo(
    () =>
      Object.values(data.boards).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [data.boards],
  );
  const members = useMemo(() => Object.values(data.members), [data.members]);

  const value: Store = {
    data,
    error,
    dismissError,
    boards,
    members,
    getBoard,
    getLists,
    getCards,
    getCard,
    createBoard,
    deleteBoard,
    renameBoard,
    toggleStar,
    addList,
    renameList,
    setListAssignee,
    setListBackgroundColor,
    toggleListCollapsed,
    archiveList,
    restoreList,
    moveList,
    addCard,
    deleteCard,
    updateCard,
    moveCard,
    addActivity,
    addBoardActivity,
    setBoardSettings,
    makeTemplate,
    addInboxItem,
    dismissInboxItem,
    moveInboxToBoard,
    scheduleInboxItem,
    archiveCard,
    restoreCard,
    toggleDone,
    setBoardVisibility,
    setBoardBackground,
    setBoardDescription,
    addLabel,
    updateLabel,
    deleteLabel,

    /* Collaboration */
    syncBoards,
    pendingBoardId,
    currentUserId: currentUser?.id ?? null,
    canWrite,
    canManage,
    boardAccess,
    getCollaborators,
    loadCollaborators,
    inviteCollaborator,
    setCollaboratorRole,
    removeCollaborator,
    pendingInvitations,
    respondToInvitation,

    resetAll,
    socialPosts: social.posts,
    socialJobs: social.jobs,
    addSocialPost,
    updateSocialPost,
    deleteSocialPost,
    duplicateSocialPost,
    moveSocialPost,
    scheduleSocialPost,
    cancelSocialPost,
    retrySocialPost,
    refreshSocialJobs,
    refreshSocialPost,
    getSocialPostsByDate,
    getSocialPostsByPlatform,
    getSocialPostsByStatus,
    getSocialPostsByCard,
    getUnscheduledPosts,
    addPlatformToPost,
    removePlatformFromPost,
    updatePostPlatform,
    addMediaToPost,
    removeMediaFromPost,
    updatePostAnalytics,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}
