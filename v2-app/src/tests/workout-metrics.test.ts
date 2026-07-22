import { describe, it, expect } from 'vitest';
import { formatElapsed, parseRestToSeconds, secsToRest, fmtVolume, dayVolume } from '../lib/workout-metrics';
import { emptyExercise } from '../types/workout';
import type { WorkoutDay, Exercise } from '../types/workout';

describe('formatElapsed', () => {
  it('formats sub-hour as M:SS', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9)).toBe('0:09');
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(600)).toBe('10:00');
  });
  it('formats past an hour as H:MM:SS', () => {
    expect(formatElapsed(3600)).toBe('1:00:00');
    expect(formatElapsed(3661)).toBe('1:01:01');
    expect(formatElapsed(3600 + 12 * 60 + 5)).toBe('1:12:05');
  });
});

describe('parseRestToSeconds', () => {
  it('parses M:SS', () => {
    expect(parseRestToSeconds('1:30')).toBe(90);
    expect(parseRestToSeconds('0:45')).toBe(45);
    expect(parseRestToSeconds('2:00')).toBe(120);
  });
  it('parses minutes (min / m, integer + decimal)', () => {
    expect(parseRestToSeconds('2min')).toBe(120);
    expect(parseRestToSeconds('2 min')).toBe(120);
    expect(parseRestToSeconds('1.5min')).toBe(90);
    expect(parseRestToSeconds('3min')).toBe(180);
  });
  it('treats a bare "m" (no "in") as seconds, not minutes — documented quirk', () => {
    expect(parseRestToSeconds('3m')).toBe(3);
  });
  it('parses a bare number as seconds', () => {
    expect(parseRestToSeconds('90')).toBe(90);
    expect(parseRestToSeconds('45s')).toBe(45);
  });
  it('is case/whitespace insensitive', () => {
    expect(parseRestToSeconds('  2MIN ')).toBe(120);
  });
  it('returns 0 for empty / unparseable', () => {
    expect(parseRestToSeconds('')).toBe(0);
    expect(parseRestToSeconds('   ')).toBe(0);
    expect(parseRestToSeconds('rest')).toBe(0);
  });
  it('round-trips with secsToRest for M:SS values', () => {
    for (const secs of [0, 30, 45, 90, 120, 185]) {
      const label = secsToRest(secs);
      if (label) expect(parseRestToSeconds(label)).toBe(secs);
    }
  });
});

describe('secsToRest', () => {
  it('formats seconds to M:SS', () => {
    expect(secsToRest(90)).toBe('1:30');
    expect(secsToRest(5)).toBe('0:05');
    expect(secsToRest(600)).toBe('10:00');
  });
  it('returns empty string for zero/negative (no rest)', () => {
    expect(secsToRest(0)).toBe('');
    expect(secsToRest(-5)).toBe('');
  });
});

describe('fmtVolume', () => {
  it('formats kg under 1000', () => {
    expect(fmtVolume(0)).toBe('0kg');
    expect(fmtVolume(999)).toBe('999kg');
    expect(fmtVolume(450.6)).toBe('451kg');
  });
  it('formats tonnes at/over 1000 to one decimal', () => {
    expect(fmtVolume(1000)).toBe('1.0t');
    expect(fmtVolume(1500)).toBe('1.5t');
    expect(fmtVolume(12345)).toBe('12.3t');
  });
});

describe('dayVolume', () => {
  function day(exercises: Exercise[]): WorkoutDay {
    return { week: 1, day: 'Monday', date: '2026-01-05', exercises };
  }
  function strength(id: string, sets: { kg: string; reps: string; done: boolean }[]): Exercise {
    return { ...emptyExercise(id, id), sets: sets.map(s => ({ ...s, rpe: '' })) };
  }

  it('sums kg×reps over DONE sets only', () => {
    const wd = day([strength('a', [
      { kg: '100', reps: '5', done: true },   // 500
      { kg: '100', reps: '5', done: false },  // ignored (not done)
      { kg: '50', reps: '10', done: true },   // 500
    ])]);
    expect(dayVolume(wd)).toBe(1000);
  });
  it('ignores recovery and conditioning blocks', () => {
    const rec = { ...emptyExercise('r', 'r'), recovery: true, recoveryDone: true };
    const cond = { ...emptyExercise('c', 'c'), conditioning: true, conditioningDone: true };
    const wd = day([rec, cond, strength('a', [{ kg: '80', reps: '5', done: true }])]);
    expect(dayVolume(wd)).toBe(400);
  });
  it('ignores non-numeric kg/reps', () => {
    const wd = day([strength('a', [
      { kg: '', reps: '5', done: true },
      { kg: '60', reps: '', done: true },
      { kg: '60', reps: '5', done: true }, // 300
    ])]);
    expect(dayVolume(wd)).toBe(300);
  });
  it('empty day is zero', () => {
    expect(dayVolume(day([]))).toBe(0);
  });
});
