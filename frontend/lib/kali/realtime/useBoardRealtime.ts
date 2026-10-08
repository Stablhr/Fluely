"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Channel, PresenceChannel } from "pusher-js";
import { getRealtimeClient } from "./pusher";
import {
  BOARD_EVENT,
  asRecord,
  asString,
  isRemoteBoardEvent,
  presenceBoardChannel,
  privateBoardChannel,
} from "./events";
import { useStore } from "@/lib/kali/store/useStore";
import type { PresenceMember } from "@/lib/kali/store/useStore";

/**
 * Subscribes one board to live sync for as long as it is on screen.
 *
 * Two channels per board: the private one carries the `board.event` stream,
 * the presence one carries the roster shown in the top bar. Both are gated on
 * read access server-side at subscribe time, so a revoked viewer is refused
 * on their next join — and if the revocation arrives as an event while they
 * are already joined, `applyRemoteBoardEvent` drops the board locally and the
 * navigation below takes them off the route.
 *
 * A silent failure of the socket itself needs no handler here: the connection
 * resubscribes what it was subscribed to, and the state-change listener below
 * re-pulls the structure on the way back up so the offline window is closed.
 */
export function useBoardRealtime(boardId: string, enabled: boolean): void {
  const router = useRouter();
  const store = useStore();
  const {
    applyRemoteBoardEvent,
    replacePresence,
    syncBoardStructure,
    currentUserId,
  } = store;

  useEffect(() => {
    if (!enabled || !boardId) return;
    const pusher = getRealtimeClient();
    if (!pusher) return;

    const privateName = privateBoardChannel(boardId);
    const presenceName = presenceBoardChannel(boardId);
    const dataChannel: Channel = pusher.subscribe(privateName);
    const presenceChannel = pusher.subscribe(presenceName) as PresenceChannel;

    // The roster lives on the channel: pusher-js updates `members` before it
    // emits each membership event, so every change is read back whole rather
    // than applied incrementally — no ordering surprises, no drift.
    const readRoster = (): PresenceMember[] => {
      const hash = presenceChannel.members?.members as
        | Record<string, { name?: string } | undefined>
        | undefined;
      if (!hash || typeof hash !== "object") return [];
      return Object.entries(hash).map(([id, info]) => ({
        id,
        name: info?.name || "Guest",
      }));
    };

    const onBoardEvent = (raw: unknown) => {
      if (!isRemoteBoardEvent(raw)) return;
      applyRemoteBoardEvent(boardId, raw);

      // The store has already dropped the board and set the banner; leave the
      // route before its "doesn't exist" placeholder can flicker up.
      if (raw.type === "board.deleted") {
        router.push("/boards");
        return;
      }
      if (raw.type === "collaborator.removed") {
        const target = asString(asRecord(raw.payload)?.userId);
        if (target && target === currentUserId) router.push("/boards");
      }
    };

    const onMembersChanged = () => replacePresence(boardId, readRoster());

    dataChannel.bind(BOARD_EVENT, onBoardEvent);
    presenceChannel.bind("pusher:subscription_succeeded", onMembersChanged);
    presenceChannel.bind("pusher:member_added", onMembersChanged);
    presenceChannel.bind("pusher:member_removed", onMembersChanged);

    // After any drop, catch up on whatever the offline window hid. The first
    // connect is skipped: BoardView has already pulled the structure by then.
    let everConnected = false;
    let dropped = false;
    const onStateChange = (state: { current?: unknown }) => {
      if (state.current !== "connected") {
        if (everConnected) dropped = true;
        return;
      }
      if (dropped) {
        dropped = false;
        void syncBoardStructure(boardId);
      }
      everConnected = true;
    };
    pusher.connection.bind("state_change", onStateChange);

    return () => {
      dataChannel.unbind(BOARD_EVENT, onBoardEvent);
      presenceChannel.unbind("pusher:subscription_succeeded", onMembersChanged);
      presenceChannel.unbind("pusher:member_added", onMembersChanged);
      presenceChannel.unbind("pusher:member_removed", onMembersChanged);
      pusher.connection.unbind("state_change", onStateChange);
      pusher.unsubscribe(privateName);
      pusher.unsubscribe(presenceName);
      // Whoever is left on this board is no longer this view's business.
      replacePresence(boardId, []);
    };
  }, [
    applyRemoteBoardEvent,
    boardId,
    currentUserId,
    enabled,
    replacePresence,
    router,
    syncBoardStructure,
  ]);
}
