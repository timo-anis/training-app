import { describe, it, expect } from 'vitest';
import { computeDayStatus } from '../lib/day-status';
import { emptyDay, emptyExercise } from '../types/workout';
import type { WorkoutDay, Exercise } from '../types/workout';

function ex(id: string, doneFlags: boolean[]): Exercise {
  return { ...emptyExercise(id, id), sets: doneFlags.map(d => ({ kg: '50', reps: '5', done: d, rpe: '' })) };
}
function day(opts: Partial<WorkoutDay>): WorkoutDay {
  return { ...emptyDay(1, 'Monday', '2026-02-16'), ...opts };
}

describe('computeDayStatus', () => {
  it('undefined / no exercises / no kind -> neutral', () => {
    expect(computeDayStatus(undefined)).toBe('neutral');
    expect(computeDayStatus(day({ exercises: [] }))).toBe('neutral');
  });

  it('completed + real done work -> done', () => {
    expect(computeDayStatus(day({ completed: true, exercises: [ex('a', [true, true])] }))).toBe('done');
  });

  it('completed:true but NO done work -> NOT done (Bug 2 rule); falls to has-data', () => {
    expect(computeDayStatus(day({ completed: true, exercises: [ex('a', [false, false])] }))).toBe('has-data');
  });

  it('all sets done (not explicitly completed) -> done', () => {
    expect(computeDayStatus(day({ exercises: [ex('a', [true, true])] }))).toBe('done');
  });

  it('some sets done -> partial', () => {
    expect(computeDayStatus(day({ exercises: [ex('a', [true, false])] }))).toBe('partial');
  });

  it('recovery block done -> active-recovery', () => {
    const r: Exercise = { ...emptyExercise('r', 'Mobility'), recovery: true, recoveryDone: true, sets: [] };
    expect(computeDayStatus(day({ exercises: [r] }))).toBe('active-recovery');
  });

  it('no exercises but kind set -> mapped status', () => {
    expect(computeDayStatus(day({ exercises: [], kind: 'rest' }))).toBe('rest');
    expect(computeDayStatus(day({ exercises: [], kind: 'recovery' }))).toBe('active-recovery');
    expect(computeDayStatus(day({ exercises: [], kind: 'workout' }))).toBe('neutral'); // 'workout' kind removed from UI; legacy data → neutral
  });
});
