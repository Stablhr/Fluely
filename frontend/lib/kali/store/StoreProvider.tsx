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
  Member,
  SocialPost,
  SocialPostPlatform,
  SocialMediaAttachment,
  SocialAnalytics,
  Platform,
  Visibility,
} from "./schema";
import {
  BOARD_TEMPLATES,
  MEMBER_COLORS,
  emptyData,
  YOU_ID,
  canWriteBoard,
  canManageBoard,
} from "./schema";
import { clearData, loadData, saveData, storageKey } from "./storage";
import { StoreContext } from "./useStore";
import type {
  KickSignal,
  PendingInvitation,
  PresenceMember,
  Store,
  StoreUser,
} from "./useStore";
import { uid } from "@/lib/kali/utils/id";
import { formatDate } from "@/lib/kali/utils/dates";
import { useSocialPosts } from "@/lib/kali/feature-hooks/useSocialPosts";
import type { BoardActivityDto, BoardDto, BoardPollResponse } from "@/lib/kali/api/boards";
import {
  createBoardOnServer,
  deleteBoardOnServer,
  fetchBoardActivity,
  fetchBoards,
  fetchCollaborators,
  fetchPendingInvitations,
  inviteCollaborator as inviteCollaboratorOnServer,
  mergeServerBoard,
  removeCollaboratorOnServer,
  respondToInvitation as respondToInvitationOnServer,
  setBoardVisibilityOnServer,
  setCollaboratorRoleOnServer,
  updateBoardOnServer,
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
  setCardMemberOnServer,
  toCard,
  toList,
  updateCardOnServer,
  updateListOnServer,
} from "@/lib/kali/api/boardChildren";
import type { CreateCardInput, CardDto, ListDto, StructureDto } from "@/lib/kali/api/boardChildren";
import {
  fetchNotifications,
  markAllNotificationsRead as markAllNotificationsReadOnServer,
  markNotificationRead as markNotificationReadOnServer,
} from "@/lib/kali/api/notifications";
import type { AppNotificationDto } from "@/lib/kali/api/notifications";
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
 * Payload guards for realtime events.
 *
 * An event is cross-origin input, so the identity fields each converter needs
 * are checked before use — anything else falls back to a structure re-pull
 * rather than writing a half-formed record into the store.
 */
function isListDto(value: unknown): value is ListDto {
  const rec = value as Record<string, unknown> | null;
  return Boolean(
    rec && typeof rec.id === "string" && typeof rec.boardId === "string",
  );
}

function isCardDto(value: unknown): value is CardDto {
  const rec = value as Record<string, unknown> | null;
  return Boolean(
    rec &&
      typeof rec.id === "string" &&
      typeof rec.boardId === "string" &&
      typeof rec.listId === "string",
  );
}

function isBoardDto(value: unknown): value is BoardDto {
  const rec = value as Record<string, unknown> | null;
  return Boolean(
    rec &&
      typeof rec.id === "string" &&
      typeof rec.name === "string" &&
      typeof rec.visibility === "string",
  );
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
  if (patch.done !== undefined) out.done = patch.done;
  if (patch.labelIds !== undefined) out.labelIds = patch.labelIds;
  if (patch.memberIds !== undefined) out.memberIds = patch.memberIds;
  if (patch.coverSize !== undefined) out.coverSize = patch.coverSize;
  // Persist uploaded card photos (and cover changes) to the server so other
  // collaborators see them. `cover` is translated to the media id the server
  // stores; `files` are translated to their media ids.
  if (patch.cover !== undefined) {
    if (patch.cover === null) {
      out.coverMediaId = null;
    } else if (
      typeof patch.cover === "object" &&
      (patch.cover.type === "image" || patch.cover.type === "video")
    ) {
      out.coverMediaId = patch.cover.mediaId ?? null;
    }
  }
  if (patch.files !== undefined) {
    out.mediaIds = patch.files
      .map((file) => file.mediaId)
      .filter((id): id is string => Boolean(id));
  }
  if (patch.comments !== undefined) {
    out.comments = patch.comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      parentId: c.parentId ?? null,
      text: c.text,
      reactions: c.reactions,
      createdAt: c.createdAt,
    }));
  }
  return out;
}

/**
 * Member identity across the wire.
 *
 * The store can name exactly one member -- the signed-in person, filed under
 * the local key `YOU_ID` -- because the roster itself lives on the server. The
 * server knows that same person by their account id. Every member id that
 * crosses the boundary is translated between the two; without it a card
 * assignment would send `YOU_ID` as though it were a user id and come back as a
 * validation error.
 *
 * `OBJECT_ID` is the shape the server's `objectId` rule accepts, so an id that
 * does not match is one the server cannot key: it is dropped on the way out
 * rather than sent to fail, and left as-is on the way in.
 */
const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Store member ids -> server user ids, dropping anything the server cannot key. */
function memberIdsToServer(
  ids: string[],
  youId: string | null | undefined,
): string[] {
  return ids
    .map((id) => (id === YOU_ID && youId ? youId : id))
    .filter((id) => OBJECT_ID.test(id));
}

/**
 * Server user ids -> store member ids.
 *
 * Only the signed-in person has a member record to render, so their account id
 * becomes the local key; every other id is left untouched and simply has no
 * member to draw -- the same as any other id the roster cannot name.
 */
function memberIdsFromServer(
  ids: string[],
  youId: string | null | undefined,
): string[] {
  if (!youId || !ids.includes(youId)) return ids;
  return ids.map((id) => (id === youId ? YOU_ID : id));
}

/** A single store member id -> the server's user id, or null when it cannot key it. */
function memberIdToServer(
  id: string | null | undefined,
  youId: string | null | undefined,
): string | null {
  if (!id) return null;
  const resolved = id === YOU_ID && youId ? youId : id;
  return OBJECT_ID.test(resolved) ? resolved : null;
}

/** Applies `memberIdsFromServer` to a card without disturbing the rest of it. */
function withLocalMemberIds(card: Card, youId: string | null | undefined): Card {
  const memberIds = memberIdsFromServer(card.memberIds, youId);
  return memberIds === card.memberIds ? card : { ...card, memberIds };
}

/** Stable, readable avatar colour for a board member with no local record. */
function memberColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

/**
 * Owner plus accepted collaborators only. The owner is remapped to the local
 * "you" id when it is the signed-in person, matching how card member ids are
 * stored after `withLocalMemberIds`. Local-only members are appended so boards
 * that have never left the browser still render their assignee.
 */
function boardMembersFor(
  data: AppData,
  boardId: string,
  youId: string | null | undefined,
): Member[] {
  const board = data.boards[boardId];
  if (!board) return Object.values(data.members);

  const members: Member[] = [];
  const seen = new Set<string>();
  const add = (member: Member) => {
    if (seen.has(member.id)) return;
    seen.add(member.id);
    members.push(member);
  };

  if (board.ownerId) {
    const isYou = Boolean(youId && board.ownerId === youId);
    const local = isYou ? data.members[YOU_ID] : undefined;
    add({
      id: isYou ? YOU_ID : board.ownerId,
      name:
        local?.name ||
        board.ownerName?.trim() ||
        "Board owner",
      color: local?.color ?? memberColorFor(board.ownerId),
    });
  }

  for (const collaborator of board.collaborators) {
    if (collaborator.status !== "accepted") continue;
    const isYou = Boolean(youId && collaborator.userId === youId);
    const local = isYou ? data.members[YOU_ID] : undefined;
    add({
      id: isYou ? YOU_ID : collaborator.userId,
      name:
        local?.name ||
        collaborator.name ||
        collaborator.email ||
        "Collaborator",
      color: local?.color ?? memberColorFor(collaborator.userId),
    });
  }

  // Local-only members, including the fallback "You" record. Kept last so the
  // server roster wins the display name when both describe the same person.
  for (const member of Object.values(data.members)) add(member);

  return members;
}

/**
 * A list's assignee as the store shows it: a name, not the user id the server
 * keeps. Only the signed-in person can be named from here -- the roster lives on
 * the server -- so every other id is left as it came and simply shows as the id
 * it is.
 */
function withLocalAssignee(
  list: List,
  youId: string | null | undefined,
  youName: string | undefined,
): List {
  if (!youId || !youName || list.assignee !== youId) return list;
  return { ...list, assignee: youName };
}

/**
 * Whether a rejected write lost the board's optimistic-concurrency check.
 *
 * Normalized errors carry the server's `code`, but the value can also arrive
 * still wrapped in an Axios response, so both shapes are checked.
 */
function isRevisionConflict(error: unknown): boolean {
  const err = error as
    | { code?: unknown; response?: { data?: { code?: unknown } } }
    | null
    | undefined;
  const code = err?.code ?? err?.response?.data?.code;
  return code === "REVISION_CONFLICT";
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
function withCurrentUser(
  data: AppData,
  currentUser: StoreUser | undefined,
): AppData {
  const member = data.members[YOU_ID];
  if (!member) return data;
  const name = currentUser?.name ?? member.name;
  const avatarUrl = currentUser?.avatarUrl ?? member.avatarUrl ?? null;
  const avatarColor = currentUser?.avatarColor ?? member.avatarColor ?? null;
  if (
    member.name === name &&
    member.avatarUrl === avatarUrl &&
    member.avatarColor === avatarColor
  ) {
    return data;
  }
  return {
    ...data,
    members: {
      ...data.members,
      [YOU_ID]: { ...member, name, avatarUrl, avatarColor },
    },
  };
}

/**
 * Structural comparison for polled payloads.
 *
 * A poll that comes back with nothing new must not change state identity: a
 * fresh array every ten seconds would re-render every `useStore()` consumer —
 * the entire board — and that re-render lands mid-drag as a visible hitch.
 */
function samePayload<T>(prev: T, next: T): boolean {
  return JSON.stringify(prev) === JSON.stringify(next);
}

function makeCard(list: List, title: string, extra: Partial<Card> = {}): Card {
  return {
    id: uid(),
    boardId: list.boardId,
    listId: list.id,
    title,
    desc: "",
    cover: null,
    // The portrait band is the default cover; the thin strip is opt-in from
    // the cover panel's size picker.
    coverSize: "large",
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
    withCurrentUser(loadData(currentUser?.id), currentUser),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitation[]
  >([]);
  const [notifications, setNotifications] = useState<AppNotificationDto[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [presenceByBoard, setPresenceByBoard] = useState<
    Record<string, PresenceMember[]>
  >({});
  const [activityByBoard, setActivityByBoard] = useState<
    Record<string, BoardActivityDto[]>
  >({});
  const dataRef = useRef(data);

  /**
   * Child writes (list/card create, patch, move) that are still outstanding.
   *
   * `syncBoardStructure` must not land while one of these is in flight: the
   * store then holds an optimistic change the server has not confirmed, and a
   * structure read would replace it with the server's pre-write view -- a
   * just-created list or card dropped from the order, or a dragged card
   * snapped back. Worse, the merge's prune deletes the optimistic record, so
   * the write's own response can no longer re-key it. Syncs that arrive
   * mid-write are re-scheduled instead, and run once nothing is outstanding.
   */
  const inflightChildWritesRef = useRef(0);
  // Serializes board writes per board so a rapid burst of drags/edits can't
  // race on the single revision counter. Each `writeThrough` call chains onto
  // the previous one for the same board instead of firing in parallel.
  const boardWriteQueuesRef = useRef(new Map<string, Promise<void>>());

  /**
   * Held in a ref so `syncBoardStructure` can re-schedule itself without a
   * circular `useCallback` dependency on `scheduleStructureSync` (which
   * depends on it in turn). Assigned next to its definition below.
   */
  const scheduleStructureSyncRef = useRef<(boardId: string) => void>(() => {});

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Social posts: API-first with localStorage fallback
  const social = useSocialPosts();

  useEffect(() => {
    let idleHandle: number | null = null;
    const write = () => {
      idleHandle = null;
      try {
        saveData(dataRef.current, currentUser?.id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save your changes.",
        );
      }
    };
    const timer = window.setTimeout(() => {
      // Serializing the whole store — base64 image covers included — can take
      // long enough to be felt. The idle queue keeps it off the frame where a
      // drop animation is still settling.
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(write, { timeout: 1000 });
      } else {
        write();
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      if (
        idleHandle !== null &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, [data]);

  useEffect(() => {
    const flush = () => {
      try {
        saveData(dataRef.current, currentUser?.id);
      } catch {
        // best effort on unload
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  const dismissError = () => setError(null);

  const mutate = useCallback((fn: (draft: AppData) => AppData) => {
    // Applied eagerly against `dataRef` instead of queued as a state updater:
    // callers in this file read the store back synchronously (the repair-then-
    // import sequence, consecutive write-throughs), and waiting for the render
    // pass would hand them the previous state. Every write goes through here,
    // so the ref stays authoritative for those reads.
    const next = fn(dataRef.current);
    dataRef.current = next;
    setData(next);
  }, []);

  /* ── Who may change a board ────────────────────────────────────────
     The access level is the server's, mirrored onto the board row when boards
     are pulled. Gating on it here -- before any optimistic local write -- is
     what keeps a viewer from watching an edit land and then vanish when the
     server refuses it: the mutation is dropped, no request goes out, and no
     error toast is raised for an action they were never allowed to take. The
     UI hides the same affordances, so this is the backstop rather than the only
     guard.
     A board that only ever lived in this browser carries `access: "owner"` (the
     storage migration writes it), so local-only boards are unaffected. */

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
  }, [mutate]);

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

      // Lists the server already has are skipped by id: after a repair they
      // sit in the same `listOrder` as the local-only lists, and the positional
      // matching below would otherwise create a duplicate of each one.
      const serverIds = new Set(server.lists.map((list) => list.id));
      const localLists = board.listOrder
        .map(id => data.lists[id])
        .filter(
          (list): list is List =>
            Boolean(list) &&
            Boolean(list.id) &&
            !serverIds.has(list.id),
        );

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
            memberIds: memberIdsToServer(
              localCards[j].memberIds,
              currentUser?.id,
            ),
            expectedRevision: revision,
          });
          revision = card.revision;
        }
      }

      markChildrenSynced(boardId);
    },
    [currentUser?.id, markChildrenSynced],
  );

  /**
   * Records a board's revision after a child write.
   *
   * Every list and card write advances the board's single concurrency counter,
   * so the local copy has to move with it or the next write would be rejected
   * as a conflict with this one.
   */
  const applyRevision = useCallback(
    (boardId: string, revision: number | undefined) => {
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
    },
    [mutate],
  );

  /**
   * Heals a board damaged by the old create-response bug.
   *
   * The write helpers used to read the server's `{list, revision}` envelope as
   * if it were the list itself, so every successful create re-keyed the
   * optimistic row onto an undefined id: `listOrder` ended up with undefined
   * holes, all of them resolving to one shared record under the string key
   * "undefined" -- which is why every hole rendered the same list -- and card
   * orders picked up undefined slots of their own. The server has the real
   * lists and cards all along; this folds them back into place.
   *
   * Each broken slot is paired with the next server list no healthy slot has
   * claimed. Creation order lines up with slot order because creates append on
   * both sides, and lists the server has never heard of keep their slots
   * untouched -- `importLocalChildren` below still has to push those. Slots the
   * server has no list for are dropped: their content was unreachable anyway,
   * every one of them resolving to the same corrupted record.
   *
   * Runs before the import so the import only ever sees lists with real ids.
   */
  const repairBoardChildren = useCallback(
    (boardId: string, structure: StructureDto) => {
      mutate((prev) => {
        const current = prev.boards[boardId];
        if (!current) return prev;

        const lists = { ...prev.lists };
        const cards = { ...prev.cards };

        const hasCorruptSlot = current.listOrder.some((id) => {
          const record = lists[id];
          return !record || !record.id;
        });
        const hasCorruptCardSlot = Object.values(lists).some(
          (list) =>
            list.boardId === boardId &&
            list.cardOrder.some((id) => !id),
        );

        if (
          !hasCorruptSlot &&
          !hasCorruptCardSlot &&
          !lists["undefined"] &&
          !cards["undefined"]
        ) {
          return prev;
        }

        const serverIds = new Set(structure.lists.map((list) => list.id));
        const claimed = new Set<string>();
        const adoptions: Array<{
          id: string;
          dto: ListDto;
          record: List | undefined;
        }> = [];
        const listOrder: Array<string | null> = [];

        for (const id of current.listOrder) {
          const record = lists[id];
          if (record?.id && serverIds.has(record.id)) {
            claimed.add(record.id);
            listOrder.push(record.id);
          } else if (record?.id) {
            // A local-only list; the import below owns it, not the repair.
            listOrder.push(id);
          } else {
            const dto = structure.lists.find((list) => !claimed.has(list.id));
            if (dto) {
              claimed.add(dto.id);
              adoptions.push({ id: dto.id, dto, record });
              listOrder.push(dto.id);
            } else {
              listOrder.push(null);
            }
          }
        }

        const finalOrder = listOrder.filter((id): id is string => id !== null);
        for (const [index, id] of finalOrder.entries()) {
          const adoption = adoptions.find((entry) => entry.id === id);
          if (adoption) {
            lists[id] = toList(adoption.dto, index, adoption.record);
          }
        }

        for (const list of Object.values(lists)) {
          if (!list.id || list.boardId !== boardId) continue;
          if (list.cardOrder.some((id) => !id)) {
            lists[list.id] = {
              ...list,
              cardOrder: list.cardOrder.filter(Boolean),
            };
          }
        }

        delete lists["undefined"];
        delete cards["undefined"];

        return {
          ...prev,
          lists,
          cards,
          boards: {
            ...prev.boards,
            [boardId]: { ...current, listOrder: finalOrder },
          },
        };
      });
    },
    [mutate],
  );

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

    // A write of our own that is still in flight means the store holds an
    // optimistic change the server has not confirmed. Re-schedule and sync once
    // it settles rather than merge the server's pre-write view over it.
    const deferForInflightWrite = () => {
      if (inflightChildWritesRef.current === 0) return false;
      scheduleStructureSyncRef.current(boardId);
      return true;
    };

    try {
      if (deferForInflightWrite()) return;
      let structure = await fetchStructure(boardId);

      // Undo create-response damage before anything else reads the ordering
      // arrays: repair pairs the broken slots with the server lists that were
      // created for them, and the import below must only see real ids.
      repairBoardChildren(boardId, structure);

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

      // A write may have started while those reads were in flight; the read is
      // then already behind it, so re-read rather than merge over the write.
      if (deferForInflightWrite()) return;

      mutate((prev) => {
        const current = prev.boards[boardId];
        if (!current) return prev;

        const lists: Record<string, List> = {...prev.lists};
        const cards: Record<string, Card> = {...prev.cards};

        structure.lists.forEach((dto, index) => {
          lists[dto.id] = withLocalAssignee(
            toList(dto, index, lists[dto.id]),
            currentUser?.id,
            currentUser?.name,
          );
        });
        structure.cards.forEach((dto) => {
          cards[dto.id] = withLocalMemberIds(
            toCard(dto, cards[dto.id]),
            currentUser?.id,
          );
        });

        // The board's own list order comes from the server, since that array is
        // the authority. Local lists the server has never heard of are dropped
        // from the sequence but left in the records, so nothing is destroyed if
        // this turns out to be the wrong call. Locally archived lists are the
        // exception: archiving never reaches the server, so the server still
        // lists them and adopting its order wholesale would resurrect them on
        // every open.
        const archivedIds = new Set(
          (current.archivedLists ?? []).map((entry) => entry.list.id),
        );
        const serverListOrder = structure.lists
          .map((list) => list.id)
          .filter((id) => !archivedIds.has(id));
        const serverCardIds = new Set(structure.cards.map((card) => card.id));

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

        // Adopt the revision this read was taken at, never walking it back. A
        // local write may have landed while the read was in flight, so the
        // current value can legitimately be ahead of the server's response;
        // regressing it would make the very next write conflict. Once adopted,
        // the poll stops considering the same change new, and a later write
        // sends a revision the server still holds.
        const nextRevision =
          typeof structure.revision === "number"
            ? Math.max(current.revision ?? 0, structure.revision)
            : current.revision;

        return {
          ...prev,
          lists,
          cards,
          boards: {
            ...prev.boards,
            [boardId]: {
              ...current,
              revision: nextRevision,
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
  }, [currentUser?.id, currentUser?.name, importLocalChildren, mutate, repairBoardChildren, setError]);

  /**
   * Sends a child write to the server and adopts the new board revision.
   *
   * A write that loses the revision race is retried once against a fresh read
   * of the board before it is treated as a failure: the change is still the
   * user's intent, and the only thing wrong with it was its stale revision.
   * This keeps per-keystroke-free edits (title, description, a run of label or
   * member toggles) from being discarded just because a collaborator -- or the
   * previous edit in the same burst -- wrote first.
   *
   * On any other rejection the board is re-read rather than rewound to a
   * captured snapshot. The server is the source of truth for a synced board, so
   * pulling it again is both simpler than a per-mutation rollback and more
   * honest: it also picks up anything a collaborator changed in the meantime,
   * which a rollback to a stale local copy would have silently discarded.
   */
  const writeThrough = useCallback(
    async (
      boardId: string,
      send: (revision: number | undefined) => Promise<number | undefined>,
      failureMessage: string,
      /**
       * Lets a caller that renders its own failure message opt out of the
       * global error banner, and gives it the raw error to inspect.
       */
      options?: {
        surfaceGlobalError?: boolean;
        onError?: (error: unknown) => void;
      },
    ): Promise<{ ok: boolean; error?: unknown }> => {
      // Count this write as in-flight up front, so a concurrent sync defers
      // until it settles rather than merging over its optimistic state.
      inflightChildWritesRef.current += 1;

      // Serialize per board: a rapid burst of drags/edits waits its turn instead
      // of racing on the single revision counter (which is what surfaced the
      // "Someone else changed this board" toast and the resulting revert).
      const previous = boardWriteQueuesRef.current.get(boardId) ?? Promise.resolve();
      let failure: unknown = null;
      const run = previous.then(async () => {
        let failed = false;
        try {
          let attempts = 0;
          while (true) {
            try {
              const revision = await send(
                dataRef.current.boards[boardId]?.revision ?? undefined,
              );
              applyRevision(boardId, revision);
              break;
            } catch (err) {
              if (!isRevisionConflict(err) || attempts >= 3) throw err;
              attempts += 1;
              // Re-read for the revision AND the structure, so the retry's send
              // computes its anchors from the server's current view rather than
              // a stale local copy.
              const structure = await fetchStructure(boardId);
              applyRevision(boardId, structure.revision);
            }
          }
        } catch (err) {
          failed = true;
          failure = err;
          if (options?.surfaceGlobalError !== false) {
            setError(getFriendlyErrorMessage(err, failureMessage));
          }
          options?.onError?.(err);
        } finally {
          if (failed) void syncBoardStructure(boardId);
        }
      });

      // Swallow a rejection so one failed write doesn't break the queue for
      // the next one.
      const settled = run.then(() => {}, () => {});
      boardWriteQueuesRef.current.set(boardId, settled);

      try {
        await run;
      } finally {
        inflightChildWritesRef.current = Math.max(
          0,
          inflightChildWritesRef.current - 1,
        );
      }

      return failure ? { ok: false, error: failure } : { ok: true };
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

  // A useCallback rather than a plain function: the realtime handler below
  // depends on it, and re-creating it every render would churn that callback's
  // identity — and with it the Pusher subscription bound to it.
  const removeBoardLocally = useCallback(
    (id: string) => {
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
    },
    [mutate],
  );

  const deleteBoard = useCallback(
    (id: string) => {
      const board = dataRef.current.boards[id];
      if (board && isServerBoard(board)) {
        void (async () => {
          try {
            await deleteBoardOnServer(id);
          } catch (err) {
            const status =
              (err as {status?: number; response?: {status?: number}})?.status ??
              (err as {response?: {status?: number}})?.response?.status;
            // Collaborators cannot delete server-side, but they still need the
            // board gone from their own device once the owner deletes it.
            if (status !== 403 && status !== 404) {
              setError(
                getFriendlyErrorMessage(err, "Could not delete that board."),
              );
              return;
            }
          }
          removeBoardLocally(id);
        })();
        return;
      }
      removeBoardLocally(id);
    },
    [removeBoardLocally, setError],
  );

  const renameBoard = (id: string, name: string) => {
    if (!canWrite(id)) return;
    mutate((prev) => ({
      ...prev,
      boards: patchRecord(prev.boards, id, { name, updatedAt: now() }),
    }));
  };

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
    if (!canWrite(boardId)) return;
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
                          // The realtime `list.created` event for this same
                          // write may already hold the server id — mapping the
                          // placeholder onto it can therefore produce the id
                          // twice, so the first occurrence wins.
                          listOrder: board.listOrder
                            .map(x => (x === id ? created.id : x))
                            .filter(
                              (x, i, arr) =>
                                x !== created.id || arr.indexOf(x) === i,
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
    if (!list) return;
    if (!canWrite(list.boardId)) return;
    if (isServerBoard(dataRef.current.boards[list.boardId])) {
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
   * Finds the server user id behind a display name.
   *
   * The store's list and card `assignee` is a name, while the server's is a
   * reference to a user, so the name is resolved against the board's members
   * and translated to the id the server can key. Null means the name belongs to
   * nobody the server could reference -- a leftover from a board this person
   * cannot see the roster of -- and the caller keeps that value local instead
   * of sending an id that is not there.
   */
  const resolveMemberId = (name: string): string | null => {
    if (!name) return null;
    const match = Object.values(dataRef.current.members).find(
      member => member.name === name,
    );
    return memberIdToServer(match?.id, currentUser?.id);
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
    // A viewer may collapse or expand a list locally -- reading a collapsed
    // list's cards should keep working -- but the change is not sent: the
    // server would refuse it, and the next structure pull would put the stored
    // value back regardless. The caller still applies it locally.
    if (!canWrite(list.boardId)) return;

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
    const boardId = dataRef.current.lists[id]?.boardId;
    if (!boardId || !canWrite(boardId)) return;
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
    const boardId = dataRef.current.lists[id]?.boardId;
    if (!boardId || !canWrite(boardId)) return;
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
    const list = dataRef.current.lists[id];
    if (!list) return;
    const collapsed = !list.collapsed;
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
    const boardId = dataRef.current.lists[id]?.boardId;
    if (!boardId || !canWrite(boardId)) return;
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
    if (!canWrite(boardId)) return;
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
    if (!canWrite(boardId)) return;
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
    const list = dataRef.current.lists[listId];
    if (!list || !canWrite(list.boardId)) return "";
    const id = uid();
    if (isServerBoard(dataRef.current.boards[list.boardId])) {
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
                        // The realtime `card.created` event for this same
                        // write may already hold the server id, so the
                        // placeholder is dropped along with any duplicate
                        // before the real id is appended — otherwise the card
                        // would render twice when the event lands first.
                        cardOrder: target.cardOrder
                          .filter(x => x !== id && x !== created.id)
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
    if (!card || !canWrite(card.boardId)) return;
    if (isServerBoard(dataRef.current.boards[card.boardId])) {
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
    if (!card || !canWrite(card.boardId)) return;
    if (isServerBoard(dataRef.current.boards[card.boardId])) {
      const patchForServer = { ...patch };
      if (patch.comments !== undefined) {
        patchForServer.comments = patch.comments.map((comment) => ({
          ...comment,
          authorId:
            comment.authorId === YOU_ID ? currentUser?.id ?? comment.authorId : comment.authorId,
        }));
      }
      const serverPatch = toCardPatch(patchForServer);
      if (serverPatch.memberIds !== undefined) {
        serverPatch.memberIds = memberIdsToServer(
          serverPatch.memberIds,
          currentUser?.id,
        );
      }
      // Cover, files, comments, activity, and watching have no server column, so
      // a patch made only of those would go out as an empty body and come back
      // as a validation error. Nothing would be stored either way, so let the
      // local update below stand and skip the request rather than surface a
      // failure for a change the server was never asked to keep.
      if (Object.keys(serverPatch).length > 0) {
        void writeThrough(
          card.boardId,
          revision =>
            updateCardOnServer(card.boardId, id, {
              ...serverPatch,
              expectedRevision: revision,
            }).then((updated) => {
              mutate((prev) => {
                const current = prev.cards[id];
                if (!current) return prev;
                return {
                  ...prev,
                  cards: {
                    ...prev.cards,
                    [id]: {
                      ...withLocalMemberIds(
                        toCard(updated, current),
                        currentUser?.id,
                      ),
                      ...patch,
                    },
                  },
                };
              });
              return updated.revision;
            }),
          "Could not save that card.",
        );
      }
    }
    mutate((prev) => ({
      ...prev,
      cards: patchRecord(prev.cards, id, { ...patch, updatedAt: now() }),
    }));
  };

  /**
   * Owner-only card assignment. Applies optimistically for the owner, then
   * writes through the narrow `/cards/:id/members` endpoint so the server can
   * enforce the same rule and validate that the target is on the board.
   */
  const setCardMember = (
    cardId: string,
    memberId: string,
    assign: boolean,
  ) => {
    const card = dataRef.current.cards[cardId];
    if (!card) return;
    const board = dataRef.current.boards[card.boardId];
    if (!board || board.access !== "owner") return;

    const serverMemberId =
      memberId === YOU_ID ? currentUser?.id ?? null : memberId;
    if (!serverMemberId) return;
    const localMemberId =
      serverMemberId === currentUser?.id ? YOU_ID : serverMemberId;

    mutate((prev) => {
      const current = prev.cards[cardId];
      if (!current) return prev;
      const memberIds = assign
        ? current.memberIds.includes(localMemberId)
          ? current.memberIds
          : [...current.memberIds, localMemberId]
        : current.memberIds.filter(
            (id) => id !== localMemberId && id !== serverMemberId,
          );
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...current, memberIds, updatedAt: now() },
        },
      };
    });

    if (!isServerBoard(board)) return;

    void writeThrough(
      board.id,
      (revision) =>
        setCardMemberOnServer(
          board.id,
          cardId,
          serverMemberId,
          assign ? "add" : "remove",
          revision,
        ).then((updated) => {
          mutate((prev) => {
            const current = prev.cards[cardId];
            if (!current) return prev;
            return {
              ...prev,
              cards: {
                ...prev.cards,
                [cardId]: withLocalMemberIds(
                  toCard(updated, current),
                  currentUser?.id,
                ),
              },
            };
          });
          return updated.revision;
        }),
      "Could not update card assignments.",
    );
  };

  const moveCard = (cardId: string, destListId: string, destIndex: number) => {
    const card = dataRef.current.cards[cardId];
    const dest = dataRef.current.lists[destListId];
    if (!card || !dest || !canWrite(card.boardId)) return;
    if (isServerBoard(dataRef.current.boards[card.boardId])) {
      // Send the fractional-indexing anchors (the cards this one is being
      // dropped between) rather than a bare index: the server computes the
      // new position from their *current* positions, so a concurrent move
      // of another card between the same two neighbours never reorders or
      // reverts this one. The index is kept as a fallback for legacy
      // servers / deleted neighbours.
      void writeThrough(
        card.boardId,
        revision => {
          const latestCard = dataRef.current.cards[cardId];
          const latestDest = dataRef.current.lists[destListId];
          const latestSrc = latestCard ? dataRef.current.lists[latestCard.listId] : undefined;
          const siblings =
            latestCard && latestCard.listId === destListId
              ? (latestSrc?.cardOrder ?? []).filter((id) => id !== cardId)
              : (latestDest?.cardOrder ?? []).filter((id) => id !== cardId);
          const clamped = Math.min(Math.max(destIndex, 0), siblings.length);
          const beforeId = clamped > 0 ? siblings[clamped - 1] : undefined;
          const afterId = clamped < siblings.length ? siblings[clamped] : undefined;
          return moveCardOnServer(card.boardId, cardId, {
            listId: destListId,
            beforeId,
            afterId,
            index: clamped,
            expectedRevision: revision,
          }).then(result => result.revision);
        },
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

  /**
   * Moves a card to another list and reports whether it worked.
   *
   * Unlike `moveCard`, which is fire-and-forget for drag-and-drop, this
   * resolves with the outcome so a caller can undo the move or report the
   * failure. The card is placed at the end of the target list unless an
   * explicit index is given (which is how Undo puts a card back exactly where
   * it was).
   */
  const moveCardToList = async (
    cardId: string,
    destListId: string,
    options?: { index?: number },
  ): Promise<{
    ok: boolean;
    error?: string;
    /** Where the card came from, so the caller can undo the move. */
    previous?: { listId: string; index: number };
  }> => {
    const card = dataRef.current.cards[cardId];
    const dest = dataRef.current.lists[destListId];
    if (!card || !dest) return { ok: false, error: "That list no longer exists." };
    if (!canWrite(card.boardId)) {
      return { ok: false, error: "You do not have edit access to this board." };
    }
    if (card.listId === destListId) return { ok: true };

    const srcListId = card.listId;
    const src = dataRef.current.lists[srcListId];
    if (!src) return { ok: false, error: "That list no longer exists." };

    // Where the card sat in the list it is leaving, so Undo can put it back.
    const previousIndex = Math.max(src.cardOrder.indexOf(cardId), 0);

    // The card's neighbours in the destination list decide its new position.
    // Without an explicit index the card goes last, which the server resolves
    // from its own view of the list so a stale client cannot misplace it.
    const destSiblings = dest.cardOrder.filter((id) => id !== cardId);
    const targetIndex =
      options?.index === undefined
        ? destSiblings.length
        : Math.min(Math.max(options.index, 0), destSiblings.length);
    const beforeId = targetIndex > 0 ? destSiblings[targetIndex - 1] : undefined;
    const afterId = targetIndex < destSiblings.length ? destSiblings[targetIndex] : undefined;

    // Remember enough to put the card back if the server refuses the move.
    const previous = {
      srcListId,
      srcOrder: [...src.cardOrder],
      destOrder: [...dest.cardOrder],
    };

    mutate((prev) => {
      const current = prev.cards[cardId];
      const source = prev.lists[srcListId];
      const target = prev.lists[destListId];
      if (!current || !source || !target) return prev;
      const srcOrder = source.cardOrder.filter((id) => id !== cardId);
      const destOrder = target.cardOrder.filter((id) => id !== cardId);
      destOrder.splice(targetIndex, 0, cardId);
      const board = prev.boards[current.boardId];
      const boardActivity =
        board && srcListId !== destListId
          ? [
              {
                id: uid(),
                text: `Moved '${current.title}' from ${source.name} to ${target.name}`,
                createdAt: now(),
              },
              ...(board.activity ?? []),
            ]
          : (board?.activity ?? []);
      return {
        ...prev,
        lists: {
          ...prev.lists,
          [srcListId]: { ...source, cardOrder: srcOrder },
          [destListId]: { ...target, cardOrder: destOrder },
        },
        cards: {
          ...prev.cards,
          [cardId]: {
            ...current,
            listId: destListId,
            updatedAt: now(),
            activity: [
              { id: uid(), text: `moved this card to ${target.name}`, createdAt: now() },
              ...current.activity,
            ],
          },
        },
        boards: board
          ? {
              ...prev.boards,
              [current.boardId]: {
                ...board,
                activity: boardActivity,
                updatedAt: now(),
              },
            }
          : prev.boards,
      };
    });

    if (!isServerBoard(dataRef.current.boards[card.boardId])) {
      return { ok: true, previous: { listId: srcListId, index: previousIndex } };
    }

    const result = await writeThrough(
      card.boardId,
      revision =>
        moveCardOnServer(card.boardId, cardId, {
          listId: destListId,
          beforeId,
          afterId,
          index: targetIndex,
          appendToEnd: options?.index === undefined,
          expectedRevision: revision,
        }).then(moved => moved.revision),
      "Could not move that card.",
      // The caller renders its own message, so the global error banner would
      // only duplicate it.
      { surfaceGlobalError: false },
    );

    if (!result.ok) {
      // Put the card back where it was: the server never applied the move.
      mutate((prev) => {
        const current = prev.cards[cardId];
        if (!current) return prev;
        return {
          ...prev,
          lists: {
            ...prev.lists,
            [previous.srcListId]: {
              ...(prev.lists[previous.srcListId] ?? src),
              cardOrder: previous.srcOrder,
            },
            [destListId]: {
              ...(prev.lists[destListId] ?? dest),
              cardOrder: previous.destOrder,
            },
          },
          cards: {
            ...prev.cards,
            [cardId]: { ...current, listId: previous.srcListId, updatedAt: now() },
          },
        };
      });
      return {
        ok: false,
        error: getFriendlyErrorMessage(
          result.error,
          "That list no longer exists.",
        ),
      };
    }

    return { ok: true, previous: { listId: srcListId, index: previousIndex } };
  };

  const addActivity = (cardId: string, text: string) => {
    const boardId = dataRef.current.cards[cardId]?.boardId;
    if (!boardId || !canWrite(boardId)) return;
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
      if (!canWrite(card.boardId)) return prev;
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
      if (!canWrite(card.boardId)) return prev;
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

  const toggleDone = (id: string) => {
    const card = dataRef.current.cards[id];
    if (!card || !canWrite(card.boardId)) return;
    const done = !card.done;
    // Optimistic local update with the activity entry.
    mutate((prev) => {
      const c = prev.cards[id];
      if (!c) return prev;
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: {
            ...c,
            done,
            updatedAt: now(),
            activity: [
              {
                id: uid(),
                text: done ? "marked this card as done" : "reopened this card",
                createdAt: now(),
              },
              ...c.activity,
            ],
          },
        },
      };
    });
    // Sync the new done state (and the resulting doneAt) to the server.
    updateCard(id, { done });
  };

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
    if (!canManage(id)) return;
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
      if (!board || !canWrite(id)) return prev;
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
    mutate((prev) => {
      if (!canWrite(id)) return prev;
      return {
        ...prev,
        boards: patchRecord(prev.boards, id, { description, updatedAt: now() }),
      };
    });

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
      if (!board || !canManage(boardId)) return prev;
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
    const board = dataRef.current.boards[boardId];
    // Deduplicate case-insensitively: reuse an existing label with the same name.
    if (board) {
      const existing = Object.values(board.labels).find(
        (label) => label.name.toLowerCase() === name.trim().toLowerCase(),
      );
      if (existing) return existing.id;
    }

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

    const serverBoard = dataRef.current.boards[boardId];
    if (serverBoard && isServerBoard(serverBoard)) {
      const labels = Object.values({
        ...serverBoard.labels,
        [id]: { id, name, color },
      }).map((label) => ({ id: label.id, name: label.name, color: label.color }));
      void (async () => {
        try {
          const dto = await updateBoardOnServer(
            boardId,
            { labels },
            serverBoard.revision,
          );
          mutate((prev) => {
            const current = prev.boards[boardId];
            if (!current) return prev;
            return {
              ...prev,
              boards: {
                ...prev.boards,
                [boardId]: { ...current, ...mergeServerBoard(current, dto) },
              },
            };
          });
        } catch {
          // ignore; local label still present
        }
      })();
    }

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
      if (!canWrite(boardId)) return prev;
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
      if (!canWrite(boardId)) return prev;
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

  const getCollaborators = useCallback(
    (boardId: string): Collaborator[] =>
      dataRef.current.boards[boardId]?.collaborators ?? [],
    [],
  );

  /** The assignable roster: owner + accepted collaborators, no pending invites. */
  const getBoardMembers = useCallback(
    (boardId: string): Member[] =>
      boardMembersFor(dataRef.current, boardId, currentUser?.id),
    [currentUser?.id],
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
        const lists: Record<string, List> = { ...prev.lists };
        const cards: Record<string, Card> = { ...prev.cards };
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

        // Drop boards the server no longer returns (e.g. deleted by their
        // owner) so every device's list reconciles without a manual refresh.
        const serverIds = new Set(dtos.map((dto) => dto.id));
        for (const id of Object.keys(boards)) {
          const board = boards[id];
          if (board && board.ownerId && board.revision !== null && !serverIds.has(id)) {
            const listIds = new Set(board.listOrder);
            for (const [listId, list] of Object.entries(lists)) {
              if (listIds.has(listId) || list.boardId === id) delete lists[listId];
            }
            for (const [cardId, card] of Object.entries(cards)) {
              if (card.boardId === id) delete cards[cardId];
            }
            delete boards[id];
          }
        }

        return { ...prev, boards, lists, cards };
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not load your boards."));
    }
  }, [mutate]);

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

  /**
   * Pulls the notification bell and the pending-invitation list together —
   * they describe the same feature from two angles (the card and the badge),
   * so they are refreshed as one.
   *
   * Background polls never write to the error slot: a dropped connection would
   * otherwise leave a stale banner sitting on screen with nothing to clear it.
   */
  const syncNotifications = useCallback(async () => {
    try {
      const [list, invitationsResult] = await Promise.all([
        fetchNotifications(),
        fetchPendingInvitations()
          .then((data) => ({ ok: true as const, data }))
          .catch(() => ({ ok: false as const, data: [] as PendingInvitation[] })),
      ]);

      // An invitation card is only actionable while its invitation is still
      // pending, so rows without a matching pending invitation are dropped.
      // That is what stops a poll that started before an answer arrived from
      // resurrecting the row the store just removed optimistically. Skipped
      // when the invitations fetch failed, so one dropped request cannot wipe
      // every invitation card from the bell.
      const pendingIds = new Set(invitationsResult.data.map((i) => i.id));
      const notifications = invitationsResult.ok
        ? list.notifications.filter(
            (n) =>
              n.type !== "board_invitation" ||
              (n.collaboratorId !== null && pendingIds.has(n.collaboratorId)),
          )
        : list.notifications;
      const keptIds = new Set(notifications.map((n) => n.id));
      const staleUnread = list.notifications.filter(
        (n) => !keptIds.has(n.id) && !n.read,
      ).length;

      const nextUnread = Math.max(0, list.unreadCount - staleUnread);

      // Identity-preserving writes: React bails out of the re-render when the
      // updater returns the previous value, so an unchanged poll costs nothing.
      setNotifications((prev) =>
        samePayload(prev, notifications) ? prev : notifications,
      );
      setUnreadNotificationCount((prev) =>
        prev === nextUnread ? prev : nextUnread,
      );
      setPendingInvitations((prev) =>
        samePayload(prev, invitationsResult.data) ? prev : invitationsResult.data,
      );
    } catch {
      // Quiet on purpose — see above. The next tick retries.
    }
  }, []);

  // The poll itself: every 10 seconds while the tab is visible, plus an
  // immediate pull when it comes back into focus, so an invitation or an
  // acceptance shows up without a reload.
  useEffect(() => {
    // Wrapped in an inner async function rather than called inline, matching
    // the mount sync above: the state updates then happen after an await
    // rather than during the effect body itself.
    async function firstPull() {
      await syncNotifications();
    }
    void firstPull();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncNotifications();
    }, 10_000);

    const onFocus = () => void syncNotifications();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncNotifications();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncNotifications]);

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
  }, [mutate]);

  /* ── Realtime ────────────────────────────────────────────────────
     One `board.event` per server mutation, pushed over Pusher from
     `useBoardRealtime`. Every event also carries its audit entry, so the
     activity feed advances even when the payload itself is handed to a
     re-pull instead of a direct merge.

     The split is deliberate: direct merges cover payloads this client can
     replay exactly (a created card, a field patch), while anything whose
     final server-side shape depends on ordering — a move's landing index, a
     delete's cascade — falls back to a short debounced structure read, so a
     remote write can never leave this copy subtly wrong. */

  const structureSyncTimers = useRef(new Map<string, number>());

  // The timers outlive nothing: clear them on unmount so a pending pull
  // cannot fire into a torn-down store.
  useEffect(() => {
    const timers = structureSyncTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  /** Debounced re-pull — one GET per burst of events, not one per event. */
  const scheduleStructureSync = useCallback(
    (boardId: string) => {
      const pending = structureSyncTimers.current.get(boardId);
      if (pending !== undefined) window.clearTimeout(pending);
      structureSyncTimers.current.set(
        boardId,
        window.setTimeout(() => {
          structureSyncTimers.current.delete(boardId);
          void syncBoardStructure(boardId);
        }, 150),
      );
    },
    [syncBoardStructure],
  );

  // Kept current for `syncBoardStructure`, which reschedules itself through
  // this ref when it defers over an in-flight write.
  useEffect(() => {
    scheduleStructureSyncRef.current = scheduleStructureSync;
  }, [scheduleStructureSync]);

  /** Drops a board's live roster and feed once the board itself is gone. */
  const forgetBoard = useCallback((boardId: string) => {
    setPresenceByBoard((prev) => {
      if (!(boardId in prev)) return prev;
      const next = { ...prev };
      delete next[boardId];
      return next;
    });
    setActivityByBoard((prev) => {
      if (!(boardId in prev)) return prev;
      const next = { ...prev };
      delete next[boardId];
      return next;
    });
  }, []);

  /**
   * Folds audit entries into a board's feed: newest first, de-duplicated by
   * id, capped so a busy board cannot grow the persisted store without bound.
   * (The feed itself lives in component state, not in `AppData`.)
   */
  const mergeActivity = useCallback(
    (boardId: string, incoming: BoardActivityDto[]) => {
      if (incoming.length === 0) return;
      setActivityByBoard((prev) => {
        const local = prev[boardId] ?? [];
        const seen = new Set(local.map((entry) => entry.id));
        const fresh = incoming.filter((entry) => !seen.has(entry.id));
        if (fresh.length === 0) return prev;
        const merged = [...local, ...fresh]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 100);
        return { ...prev, [boardId]: merged };
      });
    },
    [],
  );

  const replacePresence = useCallback(
    (boardId: string, members: PresenceMember[]) => {
      setPresenceByBoard((prev) =>
        samePayload(prev[boardId], members)
          ? prev
          : { ...prev, [boardId]: members },
      );
    },
    [],
  );

  const loadBoardActivity = useCallback(
    async (boardId: string) => {
      mergeActivity(boardId, await fetchBoardActivity(boardId, 1, 30));
    },
    [mergeActivity],
  );

  const applyBoardPoll = useCallback(
    (boardId: string, response: BoardPollResponse): KickSignal => {
      // Merge activity entries from the poll response
      if (response.activity.length > 0) {
        mergeActivity(boardId, response.activity);
      }

      // Replace presence roster
      replacePresence(boardId, response.presence);

      // Check for kick signals from activity entries
      for (const entry of response.activity) {
        if (entry.actionType === "board.deleted") {
          deleteBoard(boardId);
          forgetBoard(boardId);
          return "deleted";
        }
        if (
          entry.actionType === "collaborator.removed" &&
          entry.metadata.userId === currentUser?.id
        ) {
          deleteBoard(boardId);
          forgetBoard(boardId);
          setError("Your access to this board was removed.");
          return "removed";
        }
      }

      // If server revision is newer than our board's, schedule a structure sync
      const board = dataRef.current.boards[boardId];
      if (board && board.revision !== null && response.revision > board.revision) {
        scheduleStructureSync(boardId);
        void syncBoards();
      }

      return "ok";
    },
    [
      currentUser?.id,
      deleteBoard,
      forgetBoard,
      mergeActivity,
      replacePresence,
      scheduleStructureSync,
      syncBoards,
      setError,
    ],
  );

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
    // Optimistic: the invitation row and its bell card vanish on click, before
    // any round-trip. The snapshots let a failed request restore both exactly.
    const prevPending = pendingInvitations;
    const prevNotifications = notifications;
    const hadUnreadCard = notifications.some(
      (n) => n.collaboratorId === invitationId && !n.read,
    );

    setPendingInvitations((prev) =>
      prev.filter((i) => i.id !== invitationId),
    );
    setNotifications((prev) =>
      prev.filter((n) => n.collaboratorId !== invitationId),
    );
    if (hadUnreadCard) {
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await respondToInvitationOnServer(invitationId, decision);
      // Accepting grants access, so the new board has to be pulled in; then a
      // refresh reconciles counts with the server's now-authoritative state.
      if (decision === "accepted") await syncBoards();
      void syncNotifications();
    } catch (err) {
      setPendingInvitations(prevPending);
      setNotifications(prevNotifications);
      if (hadUnreadCard) {
        setUnreadNotificationCount((prev) => prev + 1);
      }
      setError(
        getFriendlyErrorMessage(err, "Could not answer that invitation."),
      );
      throw err;
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    const target = notifications.find((n) => n.id === notificationId);
    if (!target || target.read) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read: true, readAt: now() } : n,
      ),
    );
    setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationReadOnServer(notificationId);
    } catch (err) {
      // Roll back so the badge cannot drift away from the server's count.
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: false, readAt: null } : n,
        ),
      );
      setUnreadNotificationCount((prev) => prev + 1);
      setError(
        getFriendlyErrorMessage(err, "Could not update that notification."),
      );
    }
  };

  const markAllNotificationsRead = async () => {
    const previous = notifications;
    if (!notifications.some((n) => !n.read)) return;
    setNotifications((prev) =>
      prev.map((n) => (n.read ? n : { ...n, read: true, readAt: now() })),
    );
    setUnreadNotificationCount(0);
    try {
      await markAllNotificationsReadOnServer();
    } catch (err) {
      setNotifications(previous);
      setUnreadNotificationCount(previous.filter((n) => !n.read).length);
      setError(
        getFriendlyErrorMessage(err, "Could not update your notifications."),
      );
    }
  };

  const moveInboxToBoard = (itemId: string, boardId: string, listId: string) =>
    mutate((prev) => {
      const item = prev.inbox.find((i) => i.id === itemId);
      const list = prev.lists[listId];
      if (!item || !list || list.boardId !== boardId) return prev;
      if (!canWrite(boardId)) return prev;
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
      if (!canWrite(boardId)) return prev;
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
    clearData(currentUser?.id);
    // Through `mutate`, not `setData`, so `dataRef` swaps with it -- a later
    // mutation against the stale ref would resurrect the cleared store.
    mutate(() => withCurrentUser(emptyData(), currentUser));
  };

  const setCurrentUser = useCallback(
    (patch: {
      name?: string;
      avatarUrl?: string | null;
      avatarColor?: string | null;
    }) => {
      mutate((prev) => {
        const member = prev.members[YOU_ID];
        if (!member) return prev;
        const next = { ...member, ...patch };
        return {
          ...prev,
          members: { ...prev.members, [YOU_ID]: next },
        };
      });
    },
    [mutate],
  );

  /* ── Cross-tab sync: the signed-in person's own record ──────────────
     One tab's Settings avatar/name change writes through `mutate` →
     `saveData` → localStorage, which fires a `storage` event in every other
     tab. Mirror the current user's avatar/name into this tab's store so the
     header chip, composer and comments update without a reload. */

  useEffect(() => {
    if (!currentUser?.id) return;
    const key = storageKey(currentUser.id);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      let next: AppData;
      try {
        next = JSON.parse(e.newValue) as AppData;
      } catch {
        return;
      }
      const you = next?.members?.[YOU_ID];
      const local = dataRef.current.members[YOU_ID];
      if (!you || !local) return;
      const changed =
        you.avatarUrl !== local.avatarUrl ||
        you.avatarColor !== local.avatarColor ||
        you.name !== local.name;
      if (!changed) return;
      setData((prev) => ({
        ...prev,
        members: {
          ...prev.members,
          [YOU_ID]: { ...local, avatarUrl: you.avatarUrl, avatarColor: you.avatarColor, name: you.name },
        },
      }));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [currentUser?.id]);

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
    setCardMember,
    moveCard,
    moveCardToList,
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
    syncBoardStructure,
    pendingBoardId,
    currentUserId: currentUser?.id ?? null,
    canWrite,
    canManage,
    boardAccess,
    getCollaborators,
    getBoardMembers,
    loadCollaborators,
    inviteCollaborator,
    setCollaboratorRole,
    removeCollaborator,
    pendingInvitations,
    respondToInvitation,
    notifications,
    unreadNotificationCount,
    syncNotifications,
    markNotificationRead,
    markAllNotificationsRead,

    /* Realtime */
    presenceByBoard,
    activityByBoard,
    applyBoardPoll,
    replacePresence,
    loadBoardActivity,

    resetAll,
    setCurrentUser,
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
