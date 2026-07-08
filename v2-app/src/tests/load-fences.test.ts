/**
 * load-fences.test.ts — stale-load fences on the three coach-layer stores.
 * A load dispatched for trainee/link A that resolves AFTER the view switched
 * to B (or closed) must never land in the new view's store, and loadChat must
 * not attach a realtime subscription for the abandoned link.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const listAssignments = vi.fn();
const listCoachNotes = vi.fn();
const listMessages = vi.fn();
const subscribeToMessages = vi.fn((..._a: unknown[]) => () => {});

vi.mock('../services/coach', () => ({
  listAssignments: (...a: unknown[]) => listAssignments(...a),
  saveAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
  listCoachNotes: (...a: unknown[]) => listCoachNotes(...a),
  saveCoachNote: vi.fn(),
  deleteCoachNote: vi.fn(),
  listMessages: (...a: unknown[]) => listMessages(...a),
  sendMessage: vi.fn(),
  markMessagesRead: vi.fn(),
  subscribeToMessages: (...a: unknown[]) => subscribeToMessages(...a) as () => void,
  listUnreadCounts: vi.fn(async () => ({})),
  getMyCoach: vi.fn(async () => null),
}));

import { get } from 'svelte/store';
import {
  assignments, setAssignmentContext, clearAssignments, loadAssignmentsFor,
} from '../stores/assignments';
import {
  coachNotes, setCoachNotesContext, clearCoachNotes, loadCoachNotesFor,
} from '../stores/coachNotes';
import {
  chatMessages, setChatContext, clearChat, loadChat,
} from '../stores/messages';

const asg = (id: string) => ({ id, week: 1, day: 'Monday', exercises: [], updatedAt: '2026-07-08T00:00:00Z' });
const note = (id: string) => ({ id, coachId: 'coach', traineeId: 'tr-A', week: 1, day: 'Monday', exerciseId: null, body: 'n', updatedAt: '2026-07-08T00:00:00Z' });
const msg = (id: string) => ({ id, linkId: 'link-A', senderId: 'coach', body: 'hi', createdAt: '2026-07-08T00:00:00Z', readAt: null });

beforeEach(() => {
  clearAssignments(); clearCoachNotes(); clearChat();
  vi.clearAllMocks();
});

describe('loadAssignmentsFor fence', () => {
  it('discards a stale load that resolves after a trainee switch', async () => {
    const slow = deferred<unknown[]>();
    listAssignments.mockReturnValueOnce(slow.promise); // A (slow)
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    const inflight = loadAssignmentsFor('tr-A');

    // switch to B while A is in flight; B's load resolves first
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-B', canEdit: true });
    listAssignments.mockResolvedValueOnce([asg('b1')]);
    await loadAssignmentsFor('tr-B');
    expect(Object.keys(get(assignments))).toHaveLength(1);

    slow.resolve([asg('a1'), asg('a2')]); // A lands late
    await inflight;
    const map = get(assignments);
    expect(Object.values(map).map((a) => a.id)).toEqual(['b1']); // B untouched
  });

  it('discards a stale load after the view closed (clearAssignments)', async () => {
    const slow = deferred<unknown[]>();
    listAssignments.mockReturnValueOnce(slow.promise);
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    const inflight = loadAssignmentsFor('tr-A');
    clearAssignments();
    slow.resolve([asg('a1')]);
    await inflight;
    expect(get(assignments)).toEqual({});
  });

  it('lands normally when the context is unchanged', async () => {
    listAssignments.mockResolvedValueOnce([asg('a1')]);
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    await loadAssignmentsFor('tr-A');
    expect(Object.keys(get(assignments))).toHaveLength(1);
  });
});

describe('loadCoachNotesFor fence', () => {
  it('discards a stale load that resolves after a trainee switch', async () => {
    const slow = deferred<unknown[]>();
    listCoachNotes.mockReturnValueOnce(slow.promise);
    setCoachNotesContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    const inflight = loadCoachNotesFor('tr-A');

    setCoachNotesContext({ coachId: 'coach', traineeId: 'tr-B', canEdit: true });
    listCoachNotes.mockResolvedValueOnce([]);
    await loadCoachNotesFor('tr-B');

    slow.resolve([note('n1')]);
    await inflight;
    expect(get(coachNotes)).toEqual({}); // A's notes never land in B's view
  });

  it('lands normally when the context is unchanged', async () => {
    listCoachNotes.mockResolvedValueOnce([note('n1')]);
    setCoachNotesContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    await loadCoachNotesFor('tr-A');
    expect(Object.keys(get(coachNotes))).toHaveLength(1);
  });
});

describe('loadChat fence', () => {
  it('a stale load neither seeds the new thread nor subscribes to the old link', async () => {
    const slow = deferred<unknown[]>();
    listMessages.mockReturnValueOnce(slow.promise);
    setChatContext({ linkId: 'link-A', myUserId: 'coach' });
    const inflight = loadChat();

    // view moved on to link B before A resolved
    setChatContext({ linkId: 'link-B', myUserId: 'coach' });
    slow.resolve([msg('m1')]);
    await inflight;

    expect(get(chatMessages)).toEqual([]);
    expect(subscribeToMessages).not.toHaveBeenCalled();
  });

  it('subscribes with the link pinned at entry when the context is unchanged', async () => {
    listMessages.mockResolvedValueOnce([msg('m1')]);
    setChatContext({ linkId: 'link-A', myUserId: 'coach' });
    await loadChat();
    expect(get(chatMessages)).toHaveLength(1);
    expect(subscribeToMessages).toHaveBeenCalledTimes(1);
    expect(vi.mocked(subscribeToMessages).mock.calls[0][0]).toBe('link-A');
  });
});
