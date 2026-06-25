/**
 * sync.test.ts — unit tests for stores/sync.ts
 *
 * Mocks: storage service (saveLocal/saveCloud), ui-state (showToast).
 * Tests the retry/backoff/pendingCloud lifecycle and online-flush behaviour.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks must be declared before importing the module under test ─────────────
const mockSaveLocal = vi.fn().mockReturnValue(true);
const mockSaveCloud = vi.fn().mockResolvedValue(true);
const mockShowToast = vi.fn();

vi.mock('../services/storage', () => ({
  saveLocal: (...a: any[]) => mockSaveLocal(...a),
  saveCloud: (...a: any[]) => mockSaveCloud(...a),
}));
vi.mock('./ui-state', () => ({
  showToast: (...a: any[]) => mockShowToast(...a),
}));

// The mock for ui-state must match the import path used inside sync.ts.
// sync.ts uses: import { showToast } from './ui-state';
// We need to mock the resolved path.
vi.mock('../stores/ui-state', () => ({
  showToast: (...a: any[]) => mockShowToast(...a),
}));

import { scheduleSave, setSyncStatus, syncStatus } from '../stores/sync';
import { get } from 'svelte/store';
import type { AppState } from '../types/workout';

function makeState(weeks = 1): AppState {
  return {
    schema: '4.1',
    weeks: Array.from({ length: weeks }, (_, i) => ({
      week: i + 1,
      day: 'Monday' as const,
      date: '2026-02-16',
      exercises: [
        {
          id: `ex_${i}`, name: 'Squat', type: 'single' as const, code: '',
          sets: [{ kg: '100', reps: '5', done: false, rpe: '' }],
          rest: '', note: '', recovery: false, recoveryDone: false,
          conditioning: false, conditioningNote: '', conditioningDone: false,
        },
      ],
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockSaveLocal.mockReturnValue(true);
  mockSaveCloud.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('scheduleSave', () => {
  it('saves locally synchronously on every call', () => {
    scheduleSave('uid1', makeState());
    expect(mockSaveLocal).toHaveBeenCalledOnce();
  });

  it('debounces cloud save by 3 seconds (non-immediate)', async () => {
    scheduleSave('uid1', makeState(), false);
    expect(mockSaveCloud).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(mockSaveCloud).toHaveBeenCalledOnce();
  });

  it('flushes cloud immediately when immediate=true', async () => {
    scheduleSave('uid1', makeState(), true);
    await vi.runAllTimersAsync();
    expect(mockSaveCloud).toHaveBeenCalledOnce();
  });

  it('sets syncStatus to "saving" then "saved" on success', async () => {
    scheduleSave('uid1', makeState(), true);
    expect(get(syncStatus)).toBe('saving');
    // Flush the cloud save promise but NOT the 2.5s auto-clear timer.
    await vi.advanceTimersByTimeAsync(100);
    expect(get(syncStatus)).toBe('saved');
  });

  it('sets syncStatus to "error" on cloud failure', async () => {
    mockSaveCloud.mockResolvedValue(false);
    // Don't runAllTimers — the retry loop is infinite while saveCloud keeps
    // failing. Advance just enough for the first attempt to resolve.
    scheduleSave('uid1', makeState(), true);
    await vi.advanceTimersByTimeAsync(100);
    expect(get(syncStatus)).toBe('error');
  });

  it('shows a toast on local save failure (quota exceeded)', () => {
    mockSaveLocal.mockReturnValue(false);
    scheduleSave('uid1', makeState());
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Storage full'),
      'error',
    );
  });

  it('deduplicates rapid saves — only one cloud call after debounce', async () => {
    const state = makeState();
    scheduleSave('uid1', state);
    scheduleSave('uid1', state);
    scheduleSave('uid1', state);
    await vi.runAllTimersAsync();
    expect(mockSaveCloud).toHaveBeenCalledOnce();
  });
});

describe('setSyncStatus', () => {
  it('auto-clears "saved" status after 2.5s', async () => {
    setSyncStatus('saved');
    expect(get(syncStatus)).toBe('saved');
    await vi.advanceTimersByTimeAsync(2500);
    expect(get(syncStatus)).toBe('idle');
  });

  it('does not auto-clear non-saved statuses', async () => {
    setSyncStatus('error');
    await vi.advanceTimersByTimeAsync(5000);
    expect(get(syncStatus)).toBe('error');
  });
});
