import Pusher from 'pusher';
import {env} from '../config/env';
import {logger} from '../logging/logger';
import {SerializedActivity} from './activity.service';

/**
 * Board ids are always the 24-hex signature of a Mongo ObjectId, so a channel
 * name carries no user-controlled characters beyond them.
 */
const CHANNEL_PATTERN = /^(private|presence)-board-([a-f\d]{24})$/i;

export type ParsedChannel = {
  kind: 'private' | 'presence';
  boardId: string;
};

/** The single shape broadcast on every board mutation. */
export type BoardEvent = {
  boardId: string;
  /** The board's revision after the write, for ordering and reconciliation. */
  revision?: number;
  /** The action that happened — the same vocabulary as ActivityLog. */
  type: string;
  /** The normal serialized response body for that mutation. */
  payload: unknown;
  /** The audit entry, already serialised, so clients can append the feed. */
  activity?: SerializedActivity | null;
};

const BOARD_EVENT = 'board.event';

let client: Pusher | null | undefined;

function isConnected(): boolean {
  return Boolean(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER);
}

/**
 * Built once per process. Returns null when the app is not configured for
 * realtime, which turns every broadcast into a no-op and makes channel auth
 * report realtime as unavailable instead of crashing.
 */
function getClient(): Pusher | null {
  if (client === undefined) {
    client = isConnected()
      ? new Pusher({
          appId: env.PUSHER_APP_ID!,
          key: env.PUSHER_KEY!,
          secret: env.PUSHER_SECRET!,
          cluster: env.PUSHER_CLUSTER!,
          useTLS: true
        })
      : null;
    if (!client) {
      logger.warn('PUSHER_* env not set — realtime board sync is disabled');
    }
  }
  return client;
}

export function parseChannel(channelName: string): ParsedChannel | null {
  const match = CHANNEL_PATTERN.exec(channelName);
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as 'private' | 'presence',
    boardId: match[2].toLowerCase()
  };
}

export const realtimeService = {
  get enabled() {
    return isConnected();
  },

  /**
   * Authorises one subscription. The channel name decides which access rule
   * runs: both private and presence board channels require read access to the
   * board, so a revoked collaborator fails the next subscribe exactly as they
   * would fail the next REST read.
   *
   * Returns the `{auth, channel_data}` body pusher-js expects, or null when
   * realtime is not configured.
   */
  authorize(
    socketId: string,
    channelName: string,
    presence?: {userId: string; name: string}
  ): {auth: string; channel_data?: string} | null {
    const pusher = getClient();
    if (!pusher) return null;

    const parsed = parseChannel(channelName);
    if (!parsed) return null;

    if (parsed.kind === 'presence') {
      return pusher.authorizeChannel(socketId, channelName, {
        user_id: presence?.userId ?? '',
        user_info: presence ? {name: presence.name} : {}
      });
    }

    return pusher.authorizeChannel(socketId, channelName);
  },

  /**
   * Fire-and-forget. A broadcast failure must never fail the mutation that
   * already committed — the client reconciles on reconnect — so errors are
   * logged, not thrown.
   */
  async broadcast(event: BoardEvent): Promise<void> {
    const pusher = getClient();
    if (!pusher) return;
    const channel = `private-board-${event.boardId}`;
    try {
      await pusher.trigger(channel, BOARD_EVENT, event);
    } catch (error) {
      logger.warn({err: error, boardId: event.boardId, type: event.type}, 'Realtime broadcast failed');
    }
  }
};
