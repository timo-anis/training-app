import { describe, it, expect } from 'vitest';
import {
  isPersonalRecord, sessionStreak, prevSessionVolume, volumeDelta,
  bestSet, sessionPRs, nextPlannedSession,
} from '../lib/workout-summary';
import { emptyExercise } from '../types/workout';
import type { WorkoutDay, Exercise, DayOfWeek } from '../types/workout';

// ---- factories ----
function strength(id: string, name: string, sets: { kg: string; reps: string; done: boolean }[]): Exercise {
  return { ...emptyExercise(id, name), sets: sets.map(s => ({ ...s, rpe: '' })) };
}
function day(week: number, d: DayOfWeek, exercises: Exercise[]): WorkoutDay {
  return { week, day: d, date: '2026-01-01', exercises };
}

describe('isPersonalRecord', () => {
  const weeks = [
    day(1, 'Monday', [strength('a', 'Squat', [{ kg: '100', reps: '5', done: true }])]),
    day(1, 'Wednesday', [strength('b', 'Squat', [{ kg: '110', reps: '3', done: true }])]),
  ];
  it('true when current kg beats all prior DONE sets (excluding current day)', () => {
    expect(isPersonalRecord(weeks, 2, 'Monday', 'Squat', '120')).toBe(true);
  });
  it('false when current kg does not beat prior max', () => {
    expect(isPersonalRecord(weeks, 2, 'Monday', 'Squat', '110')).toBe(false); // tie is not a PR
    expect(isPersonalRecord(weeks, 2, 'Monday', 'Squat', '105')).toBe(false);
  });
  it('excludes the current (week, day) from the prior max', () => {
    // Only prior entry is the current day itself -> prevMax stays 0 -> no PR
    const w = [day(3, 'Monday', [strength('a', 'Squat', [{ kg: '200', reps: '1', done: true }])])];
    expect(isPersonalRecord(w, 3, 'Monday', 'Squat', '150')).toBe(false);
  });
  it('prevMax = 0 (no prior done sets) is NOT a PR — first-ever lift is not flagged', () => {
    const w = [day(1, 'Monday', [strength('a', 'Squat', [{ kg: '80', reps: '5', done: false }])])];
    expect(isPersonalRecord(w, 2, 'Monday', 'Squat', '100')).toBe(false);
  });
  it('ignores non-done prior sets (a heavy un-done set does not set the prior max)', () => {
    // The 200kg set is not done -> prevMax stays 0 -> prevMax=0 rule: not a PR.
    const w = [day(1, 'Monday', [strength('a', 'Squat', [{ kg: '200', reps: '1', done: false }])])];
    expect(isPersonalRecord(w, 2, 'Monday', 'Squat', '100')).toBe(false);
    // But a real done set at 90 IS beaten by 100.
    const w2 = [day(1, 'Monday', [strength('a', 'Squat', [
      { kg: '200', reps: '1', done: false },
      { kg: '90', reps: '5', done: true },
    ])])];
    expect(isPersonalRecord(w2, 2, 'Monday', 'Squat', '100')).toBe(true);
  });
  it('matches name variants through normalizeExerciseName (casing + alias)', () => {
    const w = [day(1, 'Monday', [strength('a', 'kettlebell swing', [{ kg: '32', reps: '10', done: true }])])];
    // 'KB Swing' is the canonical for alias 'kettlebell swing'
    expect(isPersonalRecord(w, 2, 'Monday', 'KB Swing', '40')).toBe(true);
    expect(isPersonalRecord(w, 2, 'Monday', 'KB Swing', '30')).toBe(false);
  });
  it('rejects invalid / non-positive current kg (comma decimal accepted)', () => {
    const w = [day(1, 'Monday', [strength('a', 'Squat', [{ kg: '50', reps: '5', done: true }])])];
    expect(isPersonalRecord(w, 2, 'Monday', 'Squat', '')).toBe(false);
    expect(isPersonalRecord(w, 2, 'Monday', 'Squat', '0')).toBe(false);
    expect(isPersonalRecord(w, 2, 'Monday', 'Squat', '60,5')).toBe(true); // 60.5 > 50
  });
});

describe('sessionStreak', () => {
  it('counts consecutive weeks back from current, including current session', () => {
    const weeks = [
      day(1, 'Monday', [strength('a', 'Squat', [{ kg: '50', reps: '5', done: true }])]),
      day(2, 'Monday', [strength('a', 'Squat', [{ kg: '50', reps: '5', done: true }])]),
      day(3, 'Monday', [strength('a', 'Squat', [{ kg: '50', reps: '5', done: false }])]),
    ];
    // current week 3 always counts; weeks 2 and 1 active -> 3
    expect(sessionStreak(weeks, 3)).toBe(3);
  });
  it('breaks the streak on a gap week', () => {
    const weeks = [
      day(1, 'Monday', [strength('a', 'Squat', [{ kg: '50', reps: '5', done: true }])]),
      day(3, 'Monday', [strength('a', 'Squat', [{ kg: '50', reps: '5', done: true }])]),
    ];
    // current 3 counts, 2 missing -> streak stops at 1
    expect(sessionStreak(weeks, 3)).toBe(1);
  });
  it('current session counts even with no logged activity anywhere', () => {
    expect(sessionStreak([], 5)).toBe(1);
  });
  it('recovery-done and conditioning-done count as activity', () => {
    const rec = { ...emptyExercise('r', 'Mobility'), recovery: true, recoveryDone: true, sets: [] };
    const weeks = [day(1, 'Monday', [rec]), day(2, 'Monday', [rec])];
    expect(sessionStreak(weeks, 2)).toBe(2);
  });
});

describe('prevSessionVolume', () => {
  const weeks = [
    day(1, 'Monday', [strength('a', 'Squat', [{ kg: '100', reps: '5', done: true }])]),   // 500
    day(1, 'Wednesday', [strength('b', 'Bench', [{ kg: '80', reps: '5', done: true }])]), // 400
    day(2, 'Monday', [strength('c', 'Squat', [{ kg: '110', reps: '5', done: true }])]),   // current
  ];
  it('returns the most recent prior session volume (latest before current)', () => {
    expect(prevSessionVolume(weeks, 2, 'Monday')).toBe(400); // Wed wk1 is latest before Mon wk2
  });
  it('returns null when the current (week, day) has no entry', () => {
    expect(prevSessionVolume(weeks, 2, 'Friday')).toBeNull();
  });
  it('skips prior sessions with zero volume', () => {
    const w = [
      day(1, 'Monday', [strength('a', 'Squat', [{ kg: '', reps: '', done: false }])]), // 0 vol
      day(2, 'Monday', [strength('c', 'Squat', [{ kg: '90', reps: '5', done: true }])]),
    ];
    expect(prevSessionVolume(w, 2, 'Monday')).toBeNull();
  });
});

describe('volumeDelta', () => {
  it('returns null when there is no prior volume', () => {
    expect(volumeDelta(500, null)).toBeNull();
    expect(volumeDelta(500, 0)).toBeNull();
  });
  it('returns null when the rounded delta is zero', () => {
    expect(volumeDelta(500, 500)).toBeNull();
  });
  it('computes an upward delta with pct and label', () => {
    expect(volumeDelta(600, 500)).toEqual({ pct: 20, dir: 'up', label: '+100kg' });
  });
  it('computes a downward delta', () => {
    expect(volumeDelta(400, 500)).toEqual({ pct: -20, dir: 'down', label: '-100kg' });
  });
  it('uses tonne formatting past 1000kg', () => {
    expect(volumeDelta(2500, 1000)).toEqual({ pct: 150, dir: 'up', label: '+1.5t' });
  });
});

describe('bestSet', () => {
  it('returns null for undefined or empty day', () => {
    expect(bestSet(undefined)).toBeNull();
    expect(bestSet(day(1, 'Monday', []))).toBeNull();
  });
  it('picks heaviest DONE set, tie broken by reps', () => {
    const wd = day(1, 'Monday', [strength('a', 'Squat', [
      { kg: '100', reps: '5', done: true },
      { kg: '100', reps: '8', done: true }, // same kg, more reps -> wins
      { kg: '120', reps: '1', done: false }, // heavier but not done -> ignored
    ])]);
    expect(bestSet(wd)).toBe('Squat 100 × 8');
  });
  it('ignores recovery/conditioning and non-positive kg', () => {
    const rec = { ...emptyExercise('r', 'Mob'), recovery: true, recoveryDone: true, sets: [] };
    const wd = day(1, 'Monday', [rec, strength('a', 'Row', [{ kg: '0', reps: '5', done: true }])]);
    expect(bestSet(wd)).toBeNull();
  });
});

describe('sessionPRs', () => {
  it('returns [] when the current day has no entry', () => {
    expect(sessionPRs([], 1, 'Monday')).toEqual([]);
  });
  it('flags an exercise whose top done kg beats its prior all-time max', () => {
    const weeks = [
      day(1, 'Monday', [strength('a', 'Squat', [{ kg: '100', reps: '5', done: true }])]),
      day(2, 'Monday', [strength('b', 'Squat', [{ kg: '120', reps: '3', done: true }])]),
    ];
    expect(sessionPRs(weeks, 2, 'Monday')).toEqual([{ name: 'Squat', oldKg: 100, newKg: 120 }]);
  });
  it('no PR when prevMax = 0 (first-ever session)', () => {
    const weeks = [day(1, 'Monday', [strength('a', 'Squat', [{ kg: '100', reps: '5', done: true }])])];
    expect(sessionPRs(weeks, 1, 'Monday')).toEqual([]);
  });
  it('no PR when not beating prior max (tie)', () => {
    const weeks = [
      day(1, 'Monday', [strength('a', 'Squat', [{ kg: '120', reps: '5', done: true }])]),
      day(2, 'Monday', [strength('b', 'Squat', [{ kg: '120', reps: '5', done: true }])]),
    ];
    expect(sessionPRs(weeks, 2, 'Monday')).toEqual([]);
  });
});

describe('nextPlannedSession', () => {
  const weeks = [
    day(1, 'Monday', [strength('a', 'Squat', [{ kg: '100', reps: '5', done: true }])]),
    day(1, 'Friday', [strength('b', 'Bench', [{ kg: '80', reps: '5', done: false }]), strength('c', 'Row', [{ kg: '60', reps: '8', done: false }])]),
    day(2, 'Monday', [strength('d', 'Squat', [{ kg: '110', reps: '5', done: false }])]),
  ];
  it('finds the soonest planned session strictly after current', () => {
    expect(nextPlannedSession(weeks, 1, 'Monday')).toEqual({ day: 'Friday', count: 2, nextWeek: false });
  });
  it('rolls to next week when nothing later this week', () => {
    expect(nextPlannedSession(weeks, 1, 'Friday')).toEqual({ day: 'Monday', count: 1, nextWeek: true });
  });
  it('returns null when nothing planned after current', () => {
    expect(nextPlannedSession(weeks, 2, 'Monday')).toBeNull();
  });
  it('skips recovery-only days (count of non-recovery exercises = 0)', () => {
    const rec = { ...emptyExercise('r', 'Mob'), recovery: true, recoveryDone: false, sets: [] };
    const w = [day(1, 'Monday', []), day(1, 'Tuesday', [rec])];
    expect(nextPlannedSession(w, 1, 'Monday')).toBeNull();
  });
});
