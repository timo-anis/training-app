import { describe, it, expect } from 'vitest';
import {
  sortMessages, mergeMessage, replaceMessage, isMine, unreadFromPeer, tallyUnreadByLink,
  dayLabel, groupMessagesByDay,
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

describe('dayLabel — friendly date separators', () => {
  const now = Date.parse('2026-06-23T12:00:00');
  it('labels same calendar day as Today', () => {
    expect(dayLabel('2026-06-23T08:00:00', now)).toBe('Today');
  });
  it('labels the previous day as Yesterday', () => {
    expect(dayLabel('2026-06-22T23:00:00', now)).toBe('Yesterday');
  });
  it('labels older days with a weekday+date string (not Today/Yesterday)', () => {
    const l = dayLabel('2026-06-20T10:00:00', now);
    expect(l).not.toBe('Today');
    expect(l).not.toBe('Yesterday');
    expect(l.length).toBeGreaterThan(0);
  });
  it('returns empty string for an invalid date', () => {
    expect(dayLabel('nope', now)).toBe('');
  });
});

describe('groupMessagesByDay — buckets for separators', () => {
  const now = Date.parse('2026-06-23T12:00:00');
  it('groups consecutive same-day messages and splits across days, preserving order', () => {
    const groups = groupMessagesByDay([
      msg({ id: 'a', createdAt: '2026-06-22T09:00:00' }),
      msg({ id: 'b', createdAt: '2026-06-22T10:00:00' }),
      msg({ id: 'c', createdAt: '2026-06-23T09:00:00' }),
    ], now);
    expect(groups.map((g) => g.label)).toEqual(['Yesterday', 'Today']);
    expect(groups[0].items.map((m) => m.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map((m) => m.id)).toEqual(['c']);
  });
  it('empty list yields no groups', () => {
    expect(groupMessagesByDay([], now)).toEqual([]);
  });
});
