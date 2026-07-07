/**
 * assignments-store-guard.test.ts — copy-week safety contract on the
 * assignments store (loop-4 hardening): a write without an editable context
 * is a REPORTED no-op (false), and assignmentCtxId() exposes the identity a
 * long-running flow must pin so a mid-flight trainee switch aborts the loop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/coach', () => ({
  listAssignments: vi.fn(async () => []),
  saveAssignment: vi.fn(async (_c: string, _t: string, week: number, day: string, exercises: unknown[]) =>
    ({ id: 'srv', week, day, exercises, updatedAt: '2026-07-07T00:00:00Z' })),
  deleteAssignment: vi.fn(async () => undefined),
}));

import { get } from 'svelte/store';
import {
  assignments, setAssignmentContext, clearAssignments, writeAssignment, assignmentCtxId,
} from '../stores/assignments';
import { saveAssignment } from '../services/coach';
import type { Exercise } from '../types/workout';

const ex: Exercise = {
  id: 'e1', name: 'Squat', type: 'single', code: '', rest: '', note: '',
  recovery: false, recoveryDone: false, conditioning: false, conditioningNote: '', conditioningDone: false,
  sets: [{ kg: '100', reps: '5', done: false, rpe: '' }],
};

beforeEach(() => {
  clearAssignments();
  vi.mocked(saveAssignment).mockClear();
});

describe('assignmentCtxId', () => {
  it('is null without an editable context and identifies coach|trainee with one', () => {
    expect(assignmentCtxId()).toBeNull();
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    expect(assignmentCtxId()).toBe('coach|tr-A');
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: false }); // trainee view
    expect(assignmentCtxId()).toBeNull();
    clearAssignments();
    expect(assignmentCtxId()).toBeNull();
  });

  it('changes when the open trainee changes — the pin a copy loop compares against', () => {
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    const pin = assignmentCtxId();
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-B', canEdit: true });
    expect(assignmentCtxId()).not.toBe(pin);
  });
});

describe('writeAssignment result contract', () => {
  it('returns false and writes nothing without an editable context', async () => {
    expect(await writeAssignment(1, 'Monday', [ex])).toBe(false);
    expect(saveAssignment).not.toHaveBeenCalled();
  });

  it('returns true on a successful coach write', async () => {
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    expect(await writeAssignment(1, 'Monday', [ex])).toBe(true);
    expect(saveAssignment).toHaveBeenCalledWith('coach', 'tr-A', 1, 'Monday', [ex]);
  });

  it('returns false after the context is cleared mid-flow (view closed)', async () => {
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    clearAssignments(); // coach navigated away before the write fired
    expect(await writeAssignment(1, 'Monday', [ex])).toBe(false);
    expect(saveAssignment).not.toHaveBeenCalled();
  });
});

describe('straddling-write fence (mid-flight trainee switch)', () => {
  it('a write resolving AFTER a trainee switch never lands in the new map', async () => {
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    let release!: (v: unknown) => void;
    vi.mocked(saveAssignment).mockImplementationOnce(
      () => new Promise((res) => { release = res; }) as never
    );
    const pending = writeAssignment(2, 'Monday', [ex]);
    // coach switches to trainee B while A's write is in flight
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-B', canEdit: true });
    assignments.set({}); // B's freshly loaded (empty) view
    release({ id: 'srv', week: 2, day: 'Monday', exercises: [ex], updatedAt: 'x' });
    expect(await pending).toBe(false);          // reported as not-landed
    expect(get(assignments)).toEqual({});       // B's map untouched
  });

  it("a write FAILING after a trainee switch never restores A's snapshot over B's map", async () => {
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-A', canEdit: true });
    assignments.set({ '1|Friday': { id: 'old-A', week: 1, day: 'Friday', exercises: [ex], updatedAt: null } });
    let reject!: (e: unknown) => void;
    vi.mocked(saveAssignment).mockImplementationOnce(
      () => new Promise((_res, rej) => { reject = rej; }) as never
    );
    const pending = writeAssignment(2, 'Monday', [ex]);
    setAssignmentContext({ coachId: 'coach', traineeId: 'tr-B', canEdit: true });
    const bMap = { '9|Monday': { id: 'b-row', week: 9, day: 'Monday' as const, exercises: [ex], updatedAt: null } };
    assignments.set(bMap); // B's loaded view
    reject(new Error('server down'));
    await expect(pending).rejects.toThrow('server down');
    expect(get(assignments)).toEqual(bMap);     // B's map intact, no A snapshot
  });
});
