/**
 * Tests for day-type marking: setDayKind + addExercise auto-kind.
 * stores/app.ts imports supabase which needs env vars — mock it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

import { appState, currentUser, setDayKind, addExercise } from '../stores/app';
import { emptyAppState } from '../types/workout';
import type { DayOfWeek } from '../types/workout';

const WEEK = 1;
const DAY: DayOfWeek = 'Wednesday';

function findDay() {
  return get(appState).weeks.find(w => w.week === WEEK && w.day === DAY);
}

describe('setDayKind', () => {
  beforeEach(() => {
    currentUser.set(null); // no save side-effects
    appState.set(emptyAppState());
  });

  it('creates an empty day with the given kind when none exists', () => {
    setDayKind(WEEK, DAY, 'rest');
    const d = findDay();
    expect(d).toBeDefined();
    expect(d!.kind).toBe('rest');
    expect(d!.exercises).toEqual([]);
  });

  it('changes the kind on an existing day', () => {
    setDayKind(WEEK, DAY, 'rest');
    setDayKind(WEEK, DAY, 'recovery');
    expect(findDay()!.kind).toBe('recovery');
  });

  it('clears the kind when passed null', () => {
    setDayKind(WEEK, DAY, 'recovery');
    setDayKind(WEEK, DAY, null);
    expect(findDay()!.kind).toBeUndefined();
  });

  it('does nothing when clearing a non-existent day', () => {
    setDayKind(WEEK, DAY, null);
    expect(findDay()).toBeUndefined();
  });
});

describe('addExercise auto day-kind', () => {
  beforeEach(() => {
    currentUser.set(null);
    appState.set(emptyAppState());
  });

  it('marks a new day as workout when the first exercise is added', () => {
    addExercise(WEEK, DAY, 'Bench Press');
    const d = findDay();
    expect(d!.kind).toBe('workout');
    expect(d!.exercises.length).toBe(1);
  });

  it('keeps an existing recovery mark when an exercise is added', () => {
    setDayKind(WEEK, DAY, 'recovery');
    addExercise(WEEK, DAY, 'Foam Rolling');
    const d = findDay();
    expect(d!.kind).toBe('recovery');
    expect(d!.exercises.length).toBe(1);
  });
});
