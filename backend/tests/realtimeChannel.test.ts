import {Types} from 'mongoose';

// `realtime.service` reads `env.PUSHER_*` at call time; supplying fakes keeps
// these tests hermetic — no `.env`, no credentials, no network.
jest.mock('../api/config/env', () => ({
  env: {
    PUSHER_APP_ID: 'app-1',
    PUSHER_KEY: 'key-1',
    PUSHER_SECRET: 'secret-1',
    PUSHER_CLUSTER: 'mt1'
  }
}));

// The Pusher client is faked so `authorize`/`broadcast` can be asserted
// without signing anything real. The client methods hang off the constructor
// itself because the real one is built lazily on first use.
jest.mock('pusher', () => {
  const authorizeChannel = jest.fn(
    (socketId: string, channel: string, presence?: {user_id: string}) => ({
      auth: `signed:${socketId}:${channel}`,
      ...(presence ? {channel_data: JSON.stringify(presence)} : {})
    })
  );
  const trigger = jest.fn(async () => undefined);
  const ctor = jest.fn().mockImplementation(() => ({authorizeChannel, trigger}));
  return Object.assign(ctor, {authorizeChannel, trigger});
});

import Pusher from 'pusher';
import {parseChannel, realtimeService} from '../api/services/realtime.service';

const BOARD = new Types.ObjectId('ccccccccccccccccccccccc1').toString();

const pusher = Pusher as unknown as jest.Mock & {
  authorizeChannel: jest.Mock;
  trigger: jest.Mock;
};

beforeEach(() => {
  // Keep call history from leaking between cases; implementations survive.
  jest.clearAllMocks();
});

describe('channel names', () => {
  it('accepts the private data channel for a board', () => {
    expect(parseChannel(`private-board-${BOARD}`)).toEqual({
      kind: 'private',
      boardId: BOARD
    });
  });

  it('accepts the presence channel for the same board', () => {
    expect(parseChannel(`presence-board-${BOARD}`)).toEqual({
      kind: 'presence',
      boardId: BOARD
    });
  });

  it('normalises an uppercase id so the lookup key is stable', () => {
    expect(parseChannel(`PRIVATE-BOARD-${BOARD.toUpperCase()}`)).toEqual({
      kind: 'private',
      boardId: BOARD
    });
  });

  it.each([
    ['a channel for another resource', 'private-list-0123456789abcdef01234567'],
    ['a board id that is not an ObjectId', 'private-board-zzzzzzzzzzzzzzzzzzzzzzzz'],
    ['a board id of the wrong length', 'private-board-0123456789abcdef'],
    ['a public channel', `board-${BOARD}`],
    ['the wildcard channel', '*'],
    ['an empty name', '']
  ])('refuses %s', (_label, channel) => {
    expect(parseChannel(channel)).toBeNull();
  });

  it('refuses a board id carrying path characters', () => {
    // The id is interpolated into a Pusher channel name; anything outside
    // 24-hex must never reach the signing step.
    expect(parseChannel('private-board-../../../secret')).toBeNull();
    expect(parseChannel('private-board-0123456789abcdef012345g')).toBeNull();
  });
});

describe('authorization', () => {
  it('signs a private channel without presence data', () => {
    const result = realtimeService.authorize('123.456', `private-board-${BOARD}`);

    expect(result?.auth).toBe(`signed:123.456:private-board-${BOARD}`);
    expect(pusher.authorizeChannel).toHaveBeenCalledWith(
      '123.456',
      `private-board-${BOARD}`
    );
  });

  it('signs a presence channel with the subscribing user', () => {
    const result = realtimeService.authorize('123.456', `presence-board-${BOARD}`, {
      userId: 'user-1',
      name: 'Ada Lovelace'
    });

    expect(result?.channel_data).toBe(
      JSON.stringify({user_id: 'user-1', user_info: {name: 'Ada Lovelace'}})
    );
  });

  it('refuses a channel that is not a board channel', () => {
    expect(
      realtimeService.authorize('123.456', 'private-list-0123456789abcdef01234567')
    ).toBeNull();
    expect(pusher.authorizeChannel).not.toHaveBeenCalled();
  });

  it('falls back to an empty identity rather than signing without one', () => {
    const result = realtimeService.authorize('123.456', `presence-board-${BOARD}`);

    expect(result?.channel_data).toBe(JSON.stringify({user_id: '', user_info: {}}));
  });
});

describe('broadcast', () => {
  const event = {
    boardId: BOARD,
    revision: 5,
    type: 'card.moved',
    payload: {cardId: 'card-1'}
  };

  it('fires a single named event on the board data channel', async () => {
    await realtimeService.broadcast(event);

    expect(pusher.trigger).toHaveBeenCalledWith(
      `private-board-${BOARD}`,
      'board.event',
      event
    );
  });

  it('never lets a transport failure escape to the caller', async () => {
    // The mutation has already committed; a Pusher outage must not turn it
    // into a 500 for the person who made the change.
    pusher.trigger.mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(realtimeService.broadcast(event)).resolves.toBeUndefined();
  });
});
