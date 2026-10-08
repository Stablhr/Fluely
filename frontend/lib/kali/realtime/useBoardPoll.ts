"use client";

import {useEffect, useRef, useCallback} from "react";
import {useRouter} from "next/navigation";
import {fetchBoardPoll, type BoardPollResponse} from "@/lib/kali/api/boards";
import {useStore} from "@/lib/kali/store/useStore";

const POLL_INTERVAL_MS = 3500;
const DRAIN_MAX_ROUNDS = 3;

type KickSignal = "ok" | "removed" | "deleted";

export function useBoardPoll(
  boardId: string,
  enabled: boolean,
  initialRevision: number
): void {
  const router = useRouter();
  const {
    applyBoardPoll,
    replacePresence,
    currentUserId
  } = useStore();

  const sinceRef = useRef(initialRevision);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drainingRef = useRef(false);

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
      if (status === 403 || status === 404) {
        router.push("/boards");
      }
      // 429 / network / 5xx: swallow, next tick retries
    }
  }, [boardId, applyBoardPoll, router]);

  useEffect(() => {
    if (!enabled || !boardId) return;
    cancelledRef.current = false;
    sinceRef.current = initialRevision;

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
  }, [enabled, boardId, initialRevision, pollOnce, replacePresence]);
}