import { describe, it, expect } from 'vitest';
import {
  sortMessages, mergeMessage, replaceMessage, isMine, unreadFromPeer, tallyUnreadByLink,
  type ChatMessage,
} from '../lib/messages';

const ME = 'me-uuid';
const PEER = 'peer-uuid';

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1', linkId: 'L1', senderId: ME, body: 'hi', createdAt: '2026-06-23T10:00:00.000Z', readAt: null, ...over,
});

describe('sortMessages — deterministic order', () => {
  it('orders ascending by createdAt then id', () => {
    const out = sortMessages([
      msg({ id: 'b', createdAt: '2026-06-23T10:00:02.000Z' }),
      msg({ id: 'a', createdAt: '2026-06-23T10:00:01.000Z' }),
      msg({ id: 'c', createdAt: '2026-06-23T10:00:02.000Z' }),
    ]);
    expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c']); // c tie-broken after b by id
  });

  it('does not mutate the input', () => {
    const input = [msg({ id: 'b', createdAt: '2026-06-23T10:00:02.000Z' }), msg({ id: 'a' })];
    const snap = JSON.stringify(input);
    sortMessages(input);
    expect(JSON.stringify(input)).toBe(snap);
  });
});

describe('mergeMessage — idempotent upsert', () => {
  it('inserts a new message in order', () => {
    const out = mergeMessage([msg({ id: 'a', createdAt: '2026-06-23T10:00:01.000Z' })],
                             msg({ id: 'b', createdAt: '2026-06-23T10:00:02.000Z' }));
    expect(out.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('replaces in place on a duplicate id (no doubling) — realtime re-delivery', () => {
    const out = mergeMessage([msg({ id: 'a', body: 'old' })], msg({ id: 'a', body: 'new' }));
    expect(out.length).toBe(1);
    expect(out[0].body).toBe('new');
  });
});

describe('replaceMessage — optimistic reconciliation', () => {
  it('swaps a temp id for the server row', () => {
    const out = replaceMessage([msg({ id: 'pending-1', body: 'sending' })], 'pending-1', msg({ id: 'srv-1', body: 'sending' }));
    expect(out.map((m) => m.id)).toEqual(['srv-1']);
  });

  it('de-dupes when the server row already arrived via realtime', () => {
    const list = [msg({ id: 'pending-1' }), msg({ id: 'srv-1', createdAt: '2026-06-23T10:00:05.000Z' })];
    const out = replaceMessage(list, 'pending-1', msg({ id: 'srv-1', createdAt: '2026-06-23T10:00:05.000Z' }));
    expect(out.filter((m) => m.id === 'srv-1').length).toBe(1);
    expect(out.find((m) => m.id === 'pending-1')).toBeUndefined();
  });
});

describe('isMine / unreadFromPeer', () => {
  it('isMine reflects sender', () => {
    expect(isMine(msg({ senderId: ME }), ME)).toBe(true);
    expect(isMine(msg({ senderId: PEER }), ME)).toBe(false);
  });

  it('counts only peer messages that are unread', () => {
    const list = [
      msg({ id: '1', senderId: PEER, readAt: null }),  // unread from peer -> counts
      msg({ id: '2', senderId: PEER, readAt: '2026-06-23T10:01:00.000Z' }), // read -> no
      msg({ id: '3', senderId: ME, readAt: null }),    // mine -> no
    ];
    expect(unreadFromPeer(list, ME)).toBe(1);
  });
});

describe('tallyUnreadByLink — dashboard badges', () => {
  it('groups unread-from-peer counts per link, ignoring my own and read rows', () => {
    const rows = [
      { linkId: 'L1', senderId: PEER, readAt: null },
      { linkId: 'L1', senderId: PEER, readAt: null },
      { linkId: 'L1', senderId: ME,   readAt: null },               // mine -> ignored
      { linkId: 'L2', senderId: PEER, readAt: '2026-06-23T...' },   // read -> ignored
      { linkId: 'L3', senderId: PEER, readAt: null },
    ];
    expect(tallyUnreadByLink(rows, ME)).toEqual({ L1: 2, L3: 1 });
  });

  it('empty rows yield empty map', () => {
    expect(tallyUnreadByLink([], ME)).toEqual({});
  });
});
