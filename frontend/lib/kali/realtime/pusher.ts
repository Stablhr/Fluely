import Pusher from "pusher-js";
import { httpClient } from "@/lib/api/httpClient";

/**
 * The app's single Pusher socket.
 *
 * Built lazily on first subscribe so a browser without credentials never pays
 * for the connection, and shared across boards so opening a second board reuses
 * the same socket. Authorization goes through `POST /realtime/auth` via the
 * shared `httpClient` — that keeps cookies, CSRF, and the refresh-on-401
 * interceptor working without reimplementing any of them here.
 *
 * When the env vars are absent the app degrades to refresh-to-see: every
 * caller checks `realtimeEnabled` (or simply gets `null` back) and falls back
 * to the existing pull-on-open behaviour.
 */

const KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

/** Whether realtime has been configured; false means pull-to-refresh only. */
export const realtimeEnabled = Boolean(KEY && CLUSTER);

let client: Pusher | null = null;

/**
 * pusher-js wants an `Error`, while the shared client rejects with its
 * normalized plain object — so anything else is wrapped rather than passed
 * through as a truthy non-Error the callback would treat as success.
 */
function toAuthError(err: unknown): Error {
  if (err instanceof Error) return err;
  const message =
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "Realtime authorization failed";
  return new Error(message);
}

export function getRealtimeClient(): Pusher | null {
  if (!KEY || !CLUSTER) return null;
  if (!client) {
    client = new Pusher(KEY, {
      cluster: CLUSTER,
      channelAuthorization: {
        customHandler: ({ socketId, channelName }, callback) => {
          httpClient
            .post<{ auth: string; channel_data?: string }>("/realtime/auth", {
              socket_id: socketId,
              channel_name: channelName,
            })
            .then(({ data }) => callback(null, data))
            .catch((err: unknown) => callback(toAuthError(err), null));
        },
      },
    });
  }
  return client;
}
