"use client";

import {useEffect, useRef, useCallback} from "react";
import {useRouter} from "next/navigation";
import {fetchBoardPoll} from "@/lib/kali/api/boards";
import {useStore} from "@/lib/kali/store/useStore";

const POLL_INTERVAL_MS = 3500;
const DRAIN_MAX_ROUNDS = 3;

export function useBoardPoll(
  boardId: string,
  enabled: boolean,
  initialRevision: number
): void {
  const router = useRouter();
  const {
    applyBoardPoll,
    replacePresence
  } = useStore();

  const sinceRef = useRef(initialRevision);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drainingRef = useRef(false);
  /** The board whose cursor is seeded, so a revision bump does not re-seed it. */
  const cursorBoardRef = useRef<string | null>(null);
  const initialRevisionRef = useRef(initialRevision);

  // Kept in a ref rather than in the polling effect's dependency list. The
  // revision changes on every local write and every adopted remote change, and
  // re-running the effect for each would clear and rebuild the interval, drop
  // its cursor back to the current revision, and blink the presence roster off
  // and on. The cursor is seeded once per board instead.
  useEffect(() => {
    initialRevisionRef.current = initialRevision;
  }, [initialRevision]);

  const stopPolling = useCallback(() => {
    cancelledRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(async () => {
    if (cancelledRef.current || !boardId) return;
    try {
      const result = await fetchBoardPoll(boardId, sinceRef.current);
      if (cancelledRef.current) return;

      const kick = applyBoardPoll(boardId, result);
      sinceRef.current = Math.max(sinceRef.current, result.revision);

      if (kick === "removed") {
        router.push("/boards");
        return;
      }
      if (kick === "deleted") {
        router.push("/boards");
        return;
      }

      if (result.activity.length >= 50 && !drainingRef.current) {
        drainingRef.current = true;
        for (let i = 0; i < DRAIN_MAX_ROUNDS; i += 1) {
          if (cancelledRef.current) break;
          const next = await fetchBoardPoll(boardId, sinceRef.current);
          if (cancelledRef.current) break;
          const nextKick = applyBoardPoll(boardId, next);
          sinceRef.current = Math.max(sinceRef.current, next.revision);
          if (nextKick !== "ok" || next.activity.length < 50) break;
        }
        drainingRef.current = false;
      }
    } catch (error: unknown) {
      if (cancelledRef.current) return;
      const err = error as {status?: number; response?: {status?: number}};
      const status = err?.status ?? err?.response?.status;

      // The shared client refreshes an expired access token and replays the
      // request before an error reaches here, reusing the original query string
      // -- so a recovered expiry resumes on the same `since` cursor. A 401 that
      // survives that attempt means the refresh token is gone too: the session
      // is over, not merely stale. Stop, and send the user back to sign-in
      // rather than hammering a dead session every tick.
      if (status === 401) {
        stopPolling();
        router.replace("/sign-in");
        return;
      }

      // The board is gone or our access to it was revoked -- neither is
      // recoverable by retrying, so stop and leave the board.
      if (status === 403 || status === 404) {
        stopPolling();
        router.replace("/boards");
        return;
      }

      // 429 / network / 5xx: swallow, next tick retries
    }
  }, [boardId, applyBoardPoll, router, stopPolling]);

  useEffect(() => {
    if (!enabled || !boardId) return;
    cancelledRef.current = false;

    // Seed the cursor only when this board starts polling. Re-seeding on every
    // revision change would skip activity that landed between the last poll and
    // a local write's own revision bump.
    if (cursorBoardRef.current !== boardId) {
      cursorBoardRef.current = boardId;
      sinceRef.current = initialRevisionRef.current;
    }

    void pollOnce();

    timerRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) void pollOnce();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      replacePresence(boardId, []);
    };
  }, [enabled, boardId, pollOnce, replacePresence]);
}