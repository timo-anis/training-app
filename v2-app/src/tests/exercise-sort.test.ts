import { describe, it, expect } from 'vitest';
import { sortByExerciseCode, compareByExerciseCode } from '../lib/exercise-sort';
import { emptyExercise } from '../types/workout';
import type { Exercise } from '../types/workout';

/** Build a minimal Exercise with a given code + recovery flag. */
function ex(id: string, code: string, recovery = false): Exercise {
  return { ...emptyExercise(id, id), code, type: code ? 'superset' : 'single', recovery };
}

const codes = (list: Exercise[]) => list.map(e => e.code || e.id);

describe('sortByExerciseCode — canonical superset order', () => {
  it('orders A1 < A2 < B1 < B2 regardless of input order', () => {
    const input = [ex('b2', 'B2'), ex('a2', 'A2'), ex('b1', 'B1'), ex('a1', 'A1')];
    expect(codes(sortByExerciseCode(input))).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('sorts by numeric suffix within a group (A1 < A2 < A3, A10 after A2)', () => {
    const input = [ex('a10', 'A10'), ex('a2', 'A2'), ex('a1', 'A1'), ex('a3', 'A3')];
    expect(codes(sortByExerciseCode(input))).toEqual(['A1', 'A2', 'A3', 'A10']);
  });

  it('places recovery blocks last even if their code sorts earlier', () => {
    const input = [ex('rec', 'A1', true), ex('b1', 'B1'), ex('a1', 'A2')];
    const out = sortByExerciseCode(input);
    expect(out[out.length - 1].id).toBe('rec');
    expect(codes(out)).toEqual(['A2', 'B1', 'A1']);
  });

  it('coded exercises come before non-coded (singles) ones', () => {
    const input = [ex('single', ''), ex('a1', 'A1')];
    expect(codes(sortByExerciseCode(input))).toEqual(['A1', 'single']);
  });

  it('is non-mutating — returns a new array, leaves input untouched', () => {
    const input = [ex('b1', 'B1'), ex('a1', 'A1')];
    const snapshot = codes(input);
    const out = sortByExerciseCode(input);
    expect(out).not.toBe(input);
    expect(codes(input)).toEqual(snapshot); // input order preserved
  });

  it('handles empty and single-element lists', () => {
    expect(sortByExerciseCode([])).toEqual([]);
    expect(codes(sortByExerciseCode([ex('only', 'A1')]))).toEqual(['A1']);
  });

  it('comparator is stable/consistent for equal keys (two singles keep order)', () => {
    expect(compareByExerciseCode(ex('x', ''), ex('y', ''))).toBe(0);
  });
});
