import { httpClient } from "@/lib/api/httpClient";
import type {
  Board,
  BoardAccessLevel,
  Collaborator,
  CollaboratorRole,
  CollaboratorStatus,
  Label,
  Visibility,
} from "@/lib/kali/store/schema";

/**
 * Board and collaboration calls.
 *
 * Goes through `httpClient` rather than the hand-rolled fetch in
 * `lib/kali/api/client.ts`: that one sends no cookies, never refreshes a token,
 * and expects an `{ok, data, error}` envelope the backend never sends. Going
 * through the shared client means CSRF, the refresh-on-401 interceptor, and
 * error normalization all keep working.
 *
 * The response types below are the server's own serializers, restated here as
 * interfaces so a change on either side fails at compile time instead of
 * producing `undefined` deep in a component.
 */

export type BoardScope = "accessible" | "discoverable";

/** Mirrors `serializeBoard` in `backend/api/services/board.service.ts`. */
export interface BoardDto {
  id: string;
  name: string;
  description: string;
  visibility: Visibility;
  publicSlug: string | null;
  background: string;
  backgroundMediaId: string | null;
  /** An array on the wire, a keyed record in the store — see `toLabels`. */
  labels: Label[];
  template: string;
  settings: { commentPermission: CommentPermission; selfJoin: boolean };
  listOrder: string[];
  revision: number;
  ownerId: string;
  workspaceId: string | null;
  access: BoardAccessLevel;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The server's own three-tier vocabulary, kept verbatim on read so nothing is
 * lost. `toCommentPermission` narrows it to the two the UI can currently set.
 */
export type CommentPermission = "everyone" | "members" | "editors";

/** Mirrors `serializeCollaborator` in `boardCollaborator.service.ts`. */
export interface CollaboratorDto {
  id: string;
  userId: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  invitedBy: string;
  invitedAt: string;
  respondedAt: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
}

/**
 * A pending invitation, as returned by `GET /boards/invitations`.
 *
 * Deliberately not modelled as a `Collaborator`: this row has no status, no
 * email, and no user id, because it is a summary assembled per invitee rather
 * than a stored collaborator record.
 */
export interface PendingInvitationDto {
  id: string;
  boardId: string;
  boardName: string;
  role: CollaboratorRole;
  invitedAt: string;
  invitedByName: string;
}

/**
 * The collaborator rows carry a split first/last name and no display name, so
 * one is assembled here. Falls back to the email, then the username, because an
 * invite is still legible with only one of those and a blank chip helps nobody.
 */
function displayName(dto: CollaboratorDto): string {
  const full = `${dto.firstName ?? ""} ${dto.lastName ?? ""}`.trim();
  if (full) return full;
  if (dto.email) return dto.email;
  return dto.username ?? "Unknown";
}

export function toCollaborator(dto: CollaboratorDto): Collaborator {
  return {
    id: dto.id,
    userId: dto.userId,
    name: displayName(dto),
    email: dto.email ?? "",
    role: dto.role,
    status: dto.status,
    invitedByName: "",
    invitedAt: dto.invitedAt,
    respondedAt: dto.respondedAt,
  };
}

/**
 * The store keys labels by id (`board.labels[labelId]`) and looks them up from
 * card renderers and filter panels throughout the app, while the wire format is
 * a plain array. Re-keying here means those call sites keep working unchanged;
 * converting them to array iteration would touch most of the board UI.
 */
export function toLabels(labels: Label[] | undefined): Record<string, Label> {
  if (!Array.isArray(labels)) return {};
  const keyed: Record<string, Label> = {};
  for (const label of labels) {
    if (label?.id) keyed[label.id] = label;
  }
  return keyed;
}

/**
 * The server has three tiers; the settings modal offers two. `editors` is
 * narrowed to `members`, which is the closest tier the UI can express, rather
 * than silently widening the writer's choice to everyone.
 */
function toCommentPermission(
  value: CommentPermission | undefined,
): "members" | "anyone" {
  return value === "everyone" ? "anyone" : "members";
}

/**
 * Applies a server board onto an existing store board.
 *
 * Only the fields the server owns are taken. Lists, cards, activity, and
 * archived lists are deliberately left alone: they are still local-only until
 * the child-resource work lands, and overwriting them from a board payload that
 * carries empty arrays would delete everything the user has built.
 */
export function mergeServerBoard(
  existing: Board | undefined,
  dto: BoardDto,
): Pick<
  Board,
  | "id"
  | "name"
  | "description"
  | "visibility"
  | "background"
  | "access"
  | "ownerId"
  | "workspaceId"
  | "publicSlug"
  | "revision"
  | "createdAt"
  | "updatedAt"
  | "labels"
  | "settings"
> {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? existing?.description ?? "",
    visibility: dto.visibility,
    background: dto.background || existing?.background || "",
    access: dto.access,
    ownerId: dto.ownerId,
    workspaceId: dto.workspaceId,
    // The server withholds the slug while a board is not public; keeping the
    // local copy would let a revoked board keep resolving an old link.
    publicSlug: dto.publicSlug,
    revision: dto.revision,
    createdAt: existing?.createdAt ?? dto.createdAt,
    updatedAt: existing?.updatedAt ?? dto.updatedAt,
    labels: toLabels(dto.labels),
    settings: {
      commentPermission: toCommentPermission(dto.settings?.commentPermission),
      selfJoin: dto.settings?.selfJoin ?? existing?.settings.selfJoin ?? false,
    },
  };
}

/**
 * The UI's template ids and the server's enum do not line up: `simple-project`
 * vs `simple`, `social-content` vs `social_content`. Translated here so the
 * template picker keeps its own stable ids.
 */
const TEMPLATE_TO_SERVER: Record<
  string,
  "blank" | "simple" | "social_content"
> = {
  blank: "blank",
  "simple-project": "simple",
  "social-content": "social_content",
};

export interface CreateBoardInput {
  name: string;
  description?: string;
  visibility?: Visibility;
  background?: string;
  templateId?: string;
  labels?: Label[];
}

export async function createBoardOnServer(
  input: CreateBoardInput,
): Promise<BoardDto> {
  const { data } = await httpClient.post<{ board: BoardDto }>("/boards", {
    name: input.name,
    description: input.description ?? "",
    visibility: input.visibility ?? "private",
    background: input.background ?? "default",
    template: TEMPLATE_TO_SERVER[input.templateId ?? "blank"] ?? "blank",
    labels: input.labels ?? [],
  });
  return data.board;
}

export async function fetchBoards(scope: BoardScope): Promise<BoardDto[]> {
  const { data } = await httpClient.get<{ boards: BoardDto[] }>("/boards", {
    params: { scope },
  });
  return data.boards;
}

export async function fetchBoard(boardId: string): Promise<BoardDto> {
  const { data } = await httpClient.get<{ board: BoardDto }>(
    `/boards/${boardId}`,
  );
  return data.board;
}

export async function fetchPublicBoard(slug: string): Promise<BoardDto> {
  const { data } = await httpClient.get<{ board: BoardDto }>(
    `/boards/public/${slug}`,
  );
  return data.board;
}

export async function setBoardVisibilityOnServer(
  boardId: string,
  visibility: Visibility,
  expectedRevision?: number | null,
): Promise<BoardDto> {
  const { data } = await httpClient.patch<{ board: BoardDto }>(
    `/boards/${boardId}/visibility`,
    { visibility, expectedRevision: expectedRevision ?? undefined },
  );
  return data.board;
}
export async function fetchCollaborators(
  boardId: string,
): Promise<Collaborator[]> {
  const { data } = await httpClient.get<{ collaborators: CollaboratorDto[] }>(
    `/boards/${boardId}/collaborators`,
  );
  return data.collaborators.map(toCollaborator);
}

/**
 * Invites are addressed by email address only — the server's
 * `collaboratorInviteSchema` validates it as one, so the UI must not offer a
 * name or a bare username.
 */
export async function inviteCollaborator(
  boardId: string,
  email: string,
  role: CollaboratorRole,
): Promise<Collaborator> {
  const { data } = await httpClient.post<{ collaborator: CollaboratorDto }>(
    `/boards/${boardId}/collaborators`,
    { email, role },
  );
  return toCollaborator(data.collaborator);
}

export async function setCollaboratorRoleOnServer(
  boardId: string,
  collaboratorId: string,
  role: CollaboratorRole,
): Promise<void> {
  await httpClient.patch(`/boards/${boardId}/collaborators/${collaboratorId}`, {
    role,
  });
}

export async function removeCollaboratorOnServer(
  boardId: string,
  collaboratorId: string,
): Promise<void> {
  await httpClient.delete(`/boards/${boardId}/collaborators/${collaboratorId}`);
}

export async function fetchPendingInvitations(): Promise<
  PendingInvitationDto[]
> {
  const { data } = await httpClient.get<{
    invitations: PendingInvitationDto[];
  }>("/boards/invitations");
  return data.invitations;
}

export async function respondToInvitation(
  invitationId: string,
  decision: Extract<CollaboratorStatus, "accepted" | "declined">,
): Promise<void> {
  await httpClient.post(`/boards/invitations/${invitationId}`, { decision });
}

/**
 * Board activity — the server-backed audit feed.
 *
 * Mirrors `ActivityActionTypes` / `ActivityTargetTypes` in
 * `backend/api/constants/product.ts` and `SerializedActivity` in
 * `activity.service.ts`, restated as unions so a new action on the backend
 * fails at compile time wherever the wording switch is exhaustive.
 */
export type ActivityActionType =
  | "board.updated"
  | "board.visibility_changed"
  | "board.deleted"
  | "list.created"
  | "list.updated"
  | "list.archived"
  | "list.deleted"
  | "card.created"
  | "card.updated"
  | "card.status_changed"
  | "card.assigned"
  | "card.moved"
  | "card.archived"
  | "card.deleted"
  | "collaborator.invited"
  | "collaborator.role_changed"
  | "collaborator.removed"
  | "collaborator.accepted";

export type ActivityTargetType = "board" | "list" | "card" | "collaborator";

export interface BoardActivityDto {
  id: string;
  boardId: string;
  userId: string;
  actionType: ActivityActionType;
  targetType: ActivityTargetType;
  targetId: string | null;
  metadata: Record<string, unknown>;
  actor: { id: string; name: string };
  createdAt: string;
}

/** First page of a board's audit feed, newest first. */
export async function fetchBoardActivity(
  boardId: string,
  page = 1,
  limit = 30,
): Promise<BoardActivityDto[]> {
  const { data } = await httpClient.get<{ activity: BoardActivityDto[] }>(
    `/boards/${boardId}/activity`,
    { params: { page, limit } },
  );
  return data.activity;
}
