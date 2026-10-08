import type { BoardActivityDto } from "@/lib/kali/api/boards";

/**
 * The wire vocabulary of live board sync.
 *
 * One event name carries every board mutation: the backend's
 * `realtimeService.broadcast` sends `BoardEvent` on `board.event`, and this
 * file restates that shape for the client plus the small narrowing helpers
 * that make `payload: unknown` safe to read.
 */

/** The single Pusher event every board mutation is broadcast on. */
export const BOARD_EVENT = "board.event";

/** The board's private data channel — events only, no membership. */
export function privateBoardChannel(boardId: string): string {
  return `private-board-${boardId}`;
}

/** The board's presence channel — who is looking at it right now. */
export function presenceBoardChannel(boardId: string): string {
  return `presence-board-${boardId}`;
}

/** Mirrors `BoardEvent` in `backend/api/services/realtime.service.ts`. */
export interface RemoteBoardEvent {
  boardId: string;
  /** The board's revision after the write, for reconciliation. */
  revision?: number;
  /** The action that happened — the same vocabulary as ActivityLog. */
  type: string;
  /** The serialized response body for that mutation; shape varies by type. */
  payload: unknown;
  /** The audit entry, already serialized, so the feed can advance inline. */
  activity?: BoardActivityDto | null;
}

/** Rejects anything that is not a board event before it reaches the store. */
export function isRemoteBoardEvent(value: unknown): value is RemoteBoardEvent {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.boardId === "string" && typeof rec.type === "string";
}

/**
 * Narrowing helpers for `payload: unknown`.
 *
 * Events are cross-origin input: every field is checked before use so a
 * malformed payload degrades to a structure re-pull instead of a crash.
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === "string")
    ? (value as string[])
    : null;
}
