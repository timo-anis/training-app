/**
 * coach-service.test.ts — unit tests for services/coach.ts
 *
 * Mocks the supabase client so no network calls are made.
 * Covers: listIncomingInvites email filter, listUnreadCounts limit,
 *         sendMessage, markMessagesRead, inviteTrainee validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Build a chainable Supabase query mock ─────────────────────────────────────
function makeQuery(resolvedValue: any) {
  const chain: any = {};
  const methods = ['select','eq','is','in','order','limit','insert','upsert','delete','rpc','single','maybeSingle'];
  methods.forEach(m => { chain[m] = vi.fn().mockReturnValue(chain); });
  // Terminal: last await resolves to `resolvedValue`
  chain[Symbol.for('nodejs.util.inspect.custom')] = () => resolvedValue;
  // Make the chain itself thenable (awaitable)
  chain.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
}

const mockFrom = vi.fn();
const mockRpc  = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../services/supabase', () => ({
  supabase: {
    from:    (...a: any[]) => mockFrom(...a),
    rpc:     (...a: any[]) => mockRpc(...a),
    auth: { getUser: () => mockGetUser() },
  },
}));

import {
  listIncomingInvites,
  listUnreadCounts,
  sendMessage,
  inviteTrainee,
} from '../services/coach';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

// ── listIncomingInvites ───────────────────────────────────────────────────────
describe('listIncomingInvites', () => {
  it('adds an invited_email filter when the user has an email', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'alice@example.com' } } });

    // Build a chain where we can inspect the eq() calls
    const eqSpy = vi.fn().mockReturnThis();
    const orderSpy = vi.fn().mockReturnThis();
    const chainResult = { data: [], error: null };
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: eqSpy,
      order: orderSpy,
      then: (r: any) => Promise.resolve(chainResult).then(r),
    };
    mockFrom.mockReturnValue(chain);

    await listIncomingInvites();

    // Should have called .eq('status', 'pending') AND .eq('invited_email', ...)
    const eqCalls = eqSpy.mock.calls.map((call) => call[0] as string);
    expect(eqCalls).toContain('status');
    expect(eqCalls).toContain('invited_email');
    // Email should be lowercased
    const emailCall = eqSpy.mock.calls.find((call) => call[0] === 'invited_email');
    expect(emailCall![1]).toBe('alice@example.com');
  });

  it('skips the email filter when user has no email', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: '' } } });

    const eqSpy = vi.fn().mockReturnThis();
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: eqSpy,
      order: vi.fn().mockReturnThis(),
      then: (r: any) => Promise.resolve({ data: [], error: null }).then(r),
    };
    mockFrom.mockReturnValue(chain);

    await listIncomingInvites();

    const eqCalls = eqSpy.mock.calls.map((call) => call[0] as string);
    expect(eqCalls).not.toContain('invited_email');
  });
});

// ── listUnreadCounts ──────────────────────────────────────────────────────────
describe('listUnreadCounts', () => {
  it('applies .limit(500) to the unread query', async () => {
    const limitSpy = vi.fn().mockReturnThis();
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: limitSpy,
      then: (r: any) => Promise.resolve({ data: [], error: null }).then(r),
    };
    mockFrom.mockReturnValue(chain);

    await listUnreadCounts('my-user-id');

    expect(limitSpy).toHaveBeenCalledWith(500);
  });

  it('returns an empty record when there are no unread messages', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (r: any) => Promise.resolve({ data: [], error: null }).then(r),
    };
    mockFrom.mockReturnValue(chain);

    const result = await listUnreadCounts('uid');
    expect(result).toEqual({});
  });
});

// ── sendMessage ───────────────────────────────────────────────────────────────
describe('sendMessage', () => {
  it('throws on empty message body', async () => {
    await expect(sendMessage('link1', 'user1', '   ')).rejects.toThrow('Empty message');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('trims and truncates long bodies to 4000 chars', async () => {
    const longBody = 'x'.repeat(5000);
    const insertSpy = vi.fn().mockReturnThis();
    const selectSpy = vi.fn().mockReturnThis();
    const singleData = {
      id: 'msg1', link_id: 'link1', sender_id: 'user1',
      body: 'x'.repeat(4000), created_at: new Date().toISOString(), read_at: null,
    };
    const chain: any = {
      insert: insertSpy,
      select: selectSpy,
      single: vi.fn().mockResolvedValue({ data: singleData, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    await sendMessage('link1', 'user1', longBody);

    const insertedBody = insertSpy.mock.calls[0][0].body;
    expect(insertedBody.length).toBe(4000);
  });
});

// ── inviteTrainee ─────────────────────────────────────────────────────────────
describe('inviteTrainee', () => {
  it('throws when email is invalid', async () => {
    await expect(inviteTrainee('coach1', 'coach@x.com', 'notanemail'))
      .rejects.toThrow('valid email');
  });

  it('throws when coach tries to invite themselves', async () => {
    await expect(inviteTrainee('coach1', 'timo@x.com', 'Timo@X.COM'))
      .rejects.toThrow("can't invite yourself");
  });
});
