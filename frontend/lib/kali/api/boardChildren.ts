import { httpClient } from "@/lib/api/httpClient";
import type { Card, List } from "@/lib/kali/store/schema";
import { YOU_ID } from "@/lib/kali/store/schema";

/**
 * Board children: lists and cards.
 *
 * Companion to `api/boards.ts`, which covers the board row itself and the
 * collaboration around it. Everything here goes through the shared
 * `httpClient` for the same reason as there: CSRF, refresh-on-401, and error
 * normalization all come along for free.
 *
 * Two ordering facts shape this file. `Board.listOrder` is the authority for
 * list order and `List.cardOrder` for card order, mirroring the arrays the
 * drag-and-drop code already maintains, so a reorder is a whole-array PATCH
 * rather than a per-item position write. And the server owns a single
 * optimistic-concurrency counter per board, so a child write carries the
 * board's revision -- one token covers the board and everything on it.
 *
 * Field names differ from the store in a few places. The server sends
 * `position` where the store keeps `order`, and it has no `cover`/`files`/
 * `comments`/`activity` at all: those hold base64 attachments and per-card
 * notes that live only in the browser for now. `toList` and `toCard` below are
 * the single place that difference is reconciled.
 *
 * Response shapes are the server's, not the store's: a write comes back as
 * `{list, revision}` or `{card, revision}` and structure as `{lists, cards}`.
 * Each function below unwraps its envelope so callers always receive a plain
 * DTO with `revision` merged on top -- never the raw wrapper.
 */

/** Mirrors `serializeList` in `backend/api/services/list.service.ts`. */
export interface ListDto {
  id: string;
  boardId: string;
  name: string;
  /** A user id on the wire, a display name in the store. */
  assignee: string | null;
  collapsed: boolean;
  backgroundColor: string | null;
  position: number;
  cardOrder: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mirrors `serializeCard` in `backend/api/services/card.service.ts`.
 *
 * `coverSize` has four server values against the store's two; `toCard` narrows
 * it rather than widening the store, since a card that was never sized is
 * `small` in every renderer that reads it.
 */
export type CardCoverSize = "small" | "medium" | "large" | "full";

export interface CardDto {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  desc: string;
  coverMediaId: string | null;
  coverSize: CardCoverSize;
  labelIds: string[];
  memberIds: string[];
  dueDate: string | null;
  startDate: string | null;
  location: string | null;
  watching: boolean;
  mediaIds: string[];
  archived: boolean;
  done: boolean;
  position?: number | null;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string | null;
  image?: { url: string } | null;
  coverImageUrl?: string | null;
  /** Media kind of the cover, so a video cover renders as a video. */
  coverKind?: string | null;
  media?: {
    id: string;
    url: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    createdAt: string;
  }[];
  comments?: {
    id: string;
    authorId: string | null;
    parentId: string | null;
    text: string;
    reactions: Record<string, number>;
    createdAt: string;
  }[];
}

/**
 * The whole board in one call, ordered the way the board should render.
 *
 * `revision` is the board's counter as of this read. A polling client adopts it
 * so its own cursor and its next write's `expectedRevision` both stop lagging
 * the server.
 */
export interface StructureDto {
  lists: ListDto[];
  cards: CardDto[];
  revision: number;
}

/**
 * The server keeps four cover sizes; the client shows two: the portrait band
 * ("large") and the thin strip ("small"). "medium" is the server's default for
 * a card with a cover, so it maps to the portrait band -- only an explicit
 * "small" shrinks the image.
 */
function toCoverSize(size: CardCoverSize | undefined): Card["coverSize"] {
  return size === "small" ? "small" : "large";
}

/**
 * Calendar dates vs. instants.
 *
 * The store keeps `dueDate`/`startDate` as calendar dates ("2026-10-12") because
 * that is what the planner, the calendar, and the date pickers compare against.
 * The server stores a `Date` and its DTOs require a full ISO 8601 instant, so
 * the wire format has to be reconciled here in both directions. Sending a
 * calendar date as-is is rejected as a validation error, and adopting a server
 * instant unmodified leaves the store holding "2026-10-12T00:00:00.000Z" -- a
 * value no calendar-day comparison on the client will ever match again.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Server instant -> store calendar date. */
function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/**
 * Store calendar date -> server instant. UTC midnight, so slicing the first ten
 * characters off the server's echo lands back on the very same day regardless of
 * the browser's timezone.
 */
function toServerInstant(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value;
}

/**
 * Turns a server list into a store list, keeping the local-only fields.
 *
 * `order` is not the server's `position` in any meaningful sense -- the
 * authoritative sequence is `board.listOrder` -- but renderers and the archived
 * list UI still read it, so it is derived from the list's index in that array
 * rather than trusted from the wire.
 */
export function toList(
  dto: ListDto,
  index: number,
  existing?: List,
): List {
  return {
    id: dto.id,
    boardId: dto.boardId,
    name: dto.name,
    assignee: dto.assignee ?? existing?.assignee ?? "",
    collapsed: dto.collapsed,
    order: index,
    cardOrder: dto.cardOrder ?? [],
    backgroundColor: dto.backgroundColor ?? existing?.backgroundColor ?? "",
  };
}

/**
 * Turns a server card into a store card, keeping the local-only fields.
 *
 * `cover`, `files`, `comments`, and `activity` are not sent by the server: the
 * first three carry image data as base64 data URLs, which is far too large to
 * put in a board document, and the fourth is generated by this client as a side
 * effect of acting. Overwriting them from a server payload would silently
 * discard a user's attachments and notes on every sync, so an existing local
 * copy always wins for those four and the server owns the rest.
 */
export function toCard(dto: CardDto, existing?: Card): Card {
  const imageUrl =
    dto.imageUrl ?? dto.coverImageUrl ?? dto.image?.url ?? null;

  // Server-owned cover: when the server knows about a cover image, adopt it;
  // when it does not, keep a locally-set color cover but drop a stale image
  // cover so a removed cover does not linger. A video cover is kept as a video
  // so it renders with a player rather than a broken image.
  const coverKind = dto.coverKind ?? "image";
  const coverType = coverKind === "video" ? ("video" as const) : ("image" as const);
  const cover =
    dto.coverMediaId
      ? {
          type: coverType,
          dataUrl:
            imageUrl ??
            (existing?.cover && typeof existing.cover !== "string" &&
            existing.cover.type === coverType
              ? existing.cover.dataUrl
              : ""),
          mediaId: dto.coverMediaId,
        }
      : existing?.cover && typeof existing.cover === "object"
        ? null
        : existing?.cover ?? null;

  // Server-owned attachments: replace the local list with what the server
  // reports, so collaborators see uploads made on another client. Fall back to
  // the local copy when the payload omits the field (older server).
  const files =
    dto.media !== undefined
      ? dto.media.map((m) => ({
          id: m.id,
          name: m.name,
          type:
            m.kind === "image"
              ? ("image" as const)
              : m.kind === "video"
                ? ("video" as const)
                : ("file" as const),
          dataUrl: m.url,
          mediaId: m.id,
          mimeType: m.mimeType,
          size: m.sizeBytes,
          addedAt: m.createdAt ?? new Date().toISOString(),
        }))
      : existing?.files ?? [];

  return {
    id: dto.id,
    boardId: dto.boardId,
    listId: dto.listId,
    title: dto.title,
    desc: dto.desc ?? "",
    cover,
    coverSize: toCoverSize(dto.coverSize),
    labelIds: dto.labelIds ?? [],
    memberIds: dto.memberIds ?? [],
    dueDate: toDateOnly(dto.dueDate),
    startDate: toDateOnly(dto.startDate),
    location: dto.location ?? "",
    watching: dto.watching ?? false,
    archived: dto.archived ?? false,
    done: dto.done ?? false,
    files,
    comments:
      dto.comments !== undefined
        ? dto.comments.map((c) => ({
            id: c.id,
            authorId: c.authorId ?? YOU_ID,
            parentId: c.parentId ?? null,
            text: c.text,
            reactions: c.reactions ?? {},
            createdAt: c.createdAt ?? new Date().toISOString(),
          }))
        : existing?.comments ?? [],
    activity: existing?.activity ?? [],
    createdAt: existing?.createdAt ?? dto.createdAt,
    updatedAt: existing?.updatedAt ?? dto.updatedAt,
  };
}

export interface CreateListInput {
  name: string;
  assignee?: string | null;
  backgroundColor?: string | null;
  position?: number;
  expectedRevision?: number | null;
}

/**
 * Every write response carries the board's new revision.
 *
 * A board has a single optimistic-concurrency counter covering the board and
 * everything on it, so a client that does not read the new value after a write
 * will have its next write rejected as a conflict with its own last one. The
 * value rides along with every response so the client never has to re-fetch the
 * board to find out where it now stands.
 */
export interface WriteResult<T> {
  revision: number;
}

export async function fetchStructure(boardId: string): Promise<StructureDto> {
  const { data } = await httpClient.get<StructureDto>(
    `/boards/${boardId}/structure`,
  );
  return data;
}

export async function createListOnServer(
  boardId: string,
  input: CreateListInput,
): Promise<ListDto & WriteResult<ListDto>> {
  const { data } = await httpClient.post<{
    list: ListDto;
    revision: number;
  }>(`/boards/${boardId}/lists`, {
    ...input,
    // `listCreateSchema.backgroundColor` is optional but not nullable, unlike the
    // patch schema. A colorless list must omit the field rather than send null.
    backgroundColor: input.backgroundColor || undefined,
  });
  return { ...data.list, revision: data.revision };
}

export async function updateListOnServer(
  boardId: string,
  listId: string,
  patch: Partial<CreateListInput> & {
    collapsed?: boolean;
    archivedAt?: string | null;
  },
): Promise<ListDto & WriteResult<ListDto>> {
  const { data } = await httpClient.patch<{
    list: ListDto;
    revision: number;
  }>(`/boards/${boardId}/lists/${listId}`, patch);
  return { ...data.list, revision: data.revision };
}

export async function deleteListOnServer(
  boardId: string,
  listId: string,
  expectedRevision?: number | null,
): Promise<number | undefined> {
  const { data } = await httpClient.delete<{ revision?: number }>(
    `/boards/${boardId}/lists/${listId}`,
    {
      params:
        expectedRevision === undefined || expectedRevision === null
          ? undefined
          : { expectedRevision },
    },
  );
  return data?.revision;
}

export async function reorderListsOnServer(
  boardId: string,
  listOrder: string[],
  expectedRevision?: number | null,
): Promise<{ listOrder: string[]; revision: number }> {
  const { data } = await httpClient.patch<{
    listOrder: string[];
    revision: number;
  }>(`/boards/${boardId}/list-order`, {
    listOrder,
    expectedRevision: expectedRevision ?? undefined,
  });
  return data;
}

export interface CreateCardInput {
  listId: string;
  title: string;
  desc?: string;
  dueDate?: string | null;
  startDate?: string | null;
  location?: string | null;
  labelIds?: string[];
  memberIds?: string[];
  coverSize?: "small" | "medium" | "large" | "full";
  coverMediaId?: string | null;
  mediaIds?: string[];
  done?: boolean;
  comments?: {
    id: string;
    authorId?: string | null;
    parentId?: string | null;
    text: string;
    reactions?: Record<string, number>;
    createdAt?: string;
  }[];
  position?: number;
  expectedRevision?: number | null;
}

export async function createCardOnServer(
  boardId: string,
  input: CreateCardInput,
): Promise<CardDto & WriteResult<CardDto>> {
  const { data } = await httpClient.post<{
    card: CardDto;
    revision: number;
  }>(`/boards/${boardId}/cards`, {
    ...input,
    // `cardCreateSchema` dates are `optionalDate` (optional, not nullable),
    // unlike the patch schema. A card with no date must omit the field, not
    // send null -- `null` fails validation and aborts the whole import.
    dueDate: toServerInstant(input.dueDate) ?? undefined,
    startDate: toServerInstant(input.startDate) ?? undefined,
  });
  return { ...data.card, revision: data.revision };
}

export async function updateCardOnServer(
  boardId: string,
  cardId: string,
  patch: Partial<Omit<CreateCardInput, "listId">>,
): Promise<CardDto & WriteResult<CardDto>> {
  const { data } = await httpClient.patch<{
    card: CardDto;
    revision: number;
  }>(`/boards/${boardId}/cards/${cardId}`, {
    ...patch,
    dueDate: toServerInstant(patch.dueDate),
    startDate: toServerInstant(patch.startDate),
  });
  return { ...data.card, revision: data.revision };
}

/** Owner-only. The server validates the target is an accepted board member. */
export async function setCardMemberOnServer(
  boardId: string,
  cardId: string,
  userId: string,
  action: "add" | "remove",
  expectedRevision?: number | null,
): Promise<CardDto & WriteResult<CardDto>> {
  const { data } = await httpClient.patch<{
    card: CardDto;
    revision: number;
  }>(`/boards/${boardId}/cards/${cardId}/members`, {
    userId,
    action,
    expectedRevision: expectedRevision ?? undefined,
  });
  return { ...data.card, revision: data.revision };
}

export async function deleteCardOnServer(
  boardId: string,
  cardId: string,
  expectedRevision?: number | null,
): Promise<number | undefined> {
  const { data } = await httpClient.delete<{ revision?: number }>(
    `/boards/${boardId}/cards/${cardId}`,
    {
      params:
        expectedRevision === undefined || expectedRevision === null
          ? undefined
          : { expectedRevision },
    },
  );
  return data?.revision;
}

export async function reorderCardsOnServer(
  boardId: string,
  listId: string,
  cardOrder: string[],
  expectedRevision?: number | null,
): Promise<{ cardOrder: string[]; revision: number }> {
  const { data } = await httpClient.patch<{
    cardOrder: string[];
    revision: number;
  }>(`/boards/${boardId}/lists/${listId}/card-order`, {
    cardOrder,
    expectedRevision: expectedRevision ?? undefined,
  });
  return data;
}

/**
 * Moves a card, optionally placing it at a specific position.
 *
 * `cardOrder` is the destination list's whole new order rather than an index,
 * because the source list has to be rewritten too and the two writes are only
 * consistent if the client states both sides. The moved card is allowed to
 * appear in it even though its `listId` still points at the source until the
 * server applies the move.
 */
export async function moveCardOnServer(
  boardId: string,
  cardId: string,
  input: {
    listId: string;
    beforeId?: string;
    afterId?: string;
    index?: number;
    cardOrder?: string[];
    /** Place the card at the end of the target list. */
    appendToEnd?: boolean;
    expectedRevision?: number | null;
  },
): Promise<{ card: CardDto; listId: string; revision: number }> {
  const { data } = await httpClient.post<{
    card: CardDto;
    listId: string;
    revision: number;
  }>(`/boards/${boardId}/cards/${cardId}/move`, {
    listId: input.listId,
    beforeId: input.beforeId,
    afterId: input.afterId,
    index: input.index,
    // `cardOrder` is still accepted for the legacy whole-list reorder path.
    cardOrder: input.cardOrder,
    appendToEnd: input.appendToEnd,
    expectedRevision: input.expectedRevision ?? undefined,
  });
  return data;
}
