/**
 * Tests for src/services/migrator.ts
 *
 * Critical coverage:
 * - MVP1 format detection (isMvp1State)
 * - MVP1 → V2 migration (migrateMvp1ToV2): dates, exercise names, superset codes, sets, recovery
 * - V2 schema normalisation (parseAndMigrateState): missing conditioningDone backfill
 * - Edge cases: empty state, hidden exercises, multi-week
 */

import { describe, it, expect } from 'vitest';
import { isMvp1State, migrateMvp1ToV2, parseAndMigrateState } from '../services/migrator';

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildMvp1State(overrides: Record<string, unknown> = {}) {
  return {
    __meta: { version: 1 },
    // One exercise: Bench Press on Week 1 Monday
    'exname_w1_mon_bench_press': 'Bench Press',
    'sc_w1_mon_bench_press': 3,
    'w1_mon_bench_press_s0': { kg: '80', reps: '8', done: '1' },
    'w1_mon_bench_press_s1': { kg: '80', reps: '8', done: '0' },
    'w1_mon_bench_press_s2': { kg: '80', reps: '6', done: '0' },
    'rest_w1_mon_bench_press': '2:00',
    'note_w1_mon_bench_press': 'felt strong',
    ...overrides,
  };
}

// ── isMvp1State ──────────────────────────────────────────────────────────────

describe('isMvp1State', () => {
  it('returns true for object with __meta and no weeks', () => {
    expect(isMvp1State({ __meta: { version: 1 }, someKey: 'value' })).toBe(true);
  });

  it('returns false for V2 state (has weeks array)', () => {
    expect(isMvp1State({ weeks: [], schema: '4.0' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isMvp1State(null)).toBe(false);
  });

  it('returns false for array', () => {
    expect(isMvp1State([])).toBe(false);
  });

  it('returns false for plain string', () => {
    expect(isMvp1State('hello')).toBe(false);
  });
});

// ── migrateMvp1ToV2 ──────────────────────────────────────────────────────────

describe('migrateMvp1ToV2', () => {
  it('produces schema 4.0 output', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.schema).toBe('4.0');
  });

  it('creates one WorkoutDay for one day of data', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.weeks).toHaveLength(1);
  });

  it('assigns correct day (Monday)', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.weeks[0].day).toBe('Monday');
  });

  it('assigns week number 1', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.weeks[0].week).toBe(1);
  });

  it('derives correct date for Week 1 Monday (PROGRAM_START = 2026-02-16)', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.weeks[0].date).toBe('2026-02-16');
  });

  it('derives correct date for Week 1 Wednesday', () => {
    const state = {
      __meta: {},
      'exname_w1_wed_squat': 'Squat',
      'sc_w1_wed_squat': 1,
      'w1_wed_squat_s0': { kg: '100', reps: '5', done: '0' },
    };
    const result = migrateMvp1ToV2(state);
    expect(result.weeks[0].date).toBe('2026-02-18');
  });

  it('derives correct date for Week 2 Monday', () => {
    const state = {
      __meta: {},
      'exname_w2_mon_deadlift': 'Deadlift',
      'sc_w2_mon_deadlift': 2,
      'w2_mon_deadlift_s0': { kg: '140', reps: '5', done: '1' },
      'w2_mon_deadlift_s1': { kg: '140', reps: '5', done: '0' },
    };
    const result = migrateMvp1ToV2(state);
    expect(result.weeks[0].date).toBe('2026-02-23');
  });

  it('preserves exercise name', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.weeks[0].exercises[0].name).toBe('Bench Press');
  });

  it('maps 3 sets correctly', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    const sets = result.weeks[0].exercises[0].sets;
    expect(sets).toHaveLength(3);
    expect(sets[0]).toEqual({ kg: '80', reps: '8', done: true });
    expect(sets[1]).toEqual({ kg: '80', reps: '8', done: false });
    expect(sets[2]).toEqual({ kg: '80', reps: '6', done: false });
  });

  it('preserves rest time', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.weeks[0].exercises[0].rest).toBe('2:00');
  });

  it('single exercise → type = single', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.weeks[0].exercises[0].type).toBe('single');
  });

  it('superset exercise (excode A) → type = superset with code A', () => {
    const state = {
      __meta: {},
      'exname_w1_mon_pulldown': 'Lat Pulldown',
      'excode_w1_mon_pulldown': 'A',
      'sc_w1_mon_pulldown': 2,
      'w1_mon_pulldown_s0': { kg: '60', reps: '10', done: '0' },
      'w1_mon_pulldown_s1': { kg: '60', reps: '10', done: '0' },
    };
    const result = migrateMvp1ToV2(state);
    const ex = result.weeks[0].exercises[0];
    expect(ex.type).toBe('superset');
    expect(ex.code).toBe('A');
  });

  it('recovery exercise gets recovery=true and no sets', () => {
    const state = {
      __meta: {},
      'exname_w1_mon_foam_roll': 'Foam Roll',
      'sc_w1_mon_foam_roll': 1,
      'blockdone_w1_mon_foam_roll': '1',
    };
    const result = migrateMvp1ToV2(state);
    const ex = result.weeks[0].exercises[0];
    expect(ex.recovery).toBe(true);
    expect(ex.sets).toHaveLength(0);
    expect(ex.recoveryDone).toBe(true);
  });

  it('hidden exercises are excluded', () => {
    const state = {
      ...buildMvp1State(),
      'exname_w1_mon_hidden_ex': 'Hidden Exercise',
      'sc_w1_mon_hidden_ex': 1,
      'hidden_w1_mon_hidden_ex': true,
    };
    const result = migrateMvp1ToV2(state);
    const names = result.weeks[0].exercises.map(e => e.name);
    expect(names).not.toContain('Hidden Exercise');
  });

  it('multi-week: creates WorkoutDays for both weeks', () => {
    const state = {
      ...buildMvp1State(),
      'exname_w2_mon_squat': 'Squat',
      'sc_w2_mon_squat': 1,
      'w2_mon_squat_s0': { kg: '100', reps: '5', done: '0' },
    };
    const result = migrateMvp1ToV2(state);
    expect(result.weeks).toHaveLength(2);
    const weekNums = result.weeks.map(w => w.week).sort();
    expect(weekNums).toEqual([1, 2]);
  });

  it('backfills conditioningDone=false for normal exercises', () => {
    const result = migrateMvp1ToV2(buildMvp1State());
    expect(result.weeks[0].exercises[0].conditioningDone).toBe(false);
  });
});

// ── parseAndMigrateState ─────────────────────────────────────────────────────

describe('parseAndMigrateState', () => {
  it('detects MVP1 and migrates', () => {
    const result = parseAndMigrateState(buildMvp1State());
    expect(result).not.toBeNull();
    expect(result!.schema).toBe('4.0');
    expect(result!.weeks[0].exercises[0].name).toBe('Bench Press');
  });

  it('passes through valid V2 state unchanged (schema preserved)', () => {
    const v2: import('../types/workout').AppState = {
      schema: '4.0',
      weeks: [
        {
          week: 1, day: 'Monday', date: '2026-02-16',
          exercises: [
            {
              id: 'bench_1', name: 'Bench Press', type: 'single', code: '',
              sets: [{ kg: '80', reps: '8', done: true }],
              rest: '', note: '',
              recovery: false, recoveryDone: false,
              conditioning: false, conditioningNote: '', conditioningDone: false,
            },
          ],
        },
      ],
    };
    const result = parseAndMigrateState(v2);
    expect(result).not.toBeNull();
    expect(result!.weeks[0].exercises[0].name).toBe('Bench Press');
    expect(result!.weeks[0].exercises[0].sets[0].done).toBe(true);
  });

  it('backfills missing conditioningDone field in V2 state', () => {
    // Simulate old V2 state without conditioningDone
    const oldV2 = {
      schema: '4.0' as const,
      weeks: [
        {
          week: 1, day: 'Monday' as const, date: '2026-02-16',
          exercises: [
            {
              id: 'ex1', name: 'Bike', type: 'single' as const, code: '',
              sets: [], rest: '', note: '',
              recovery: false, recoveryDone: false,
              conditioning: true, conditioningNote: '20 min',
              // conditioningDone intentionally missing
            },
          ],
        },
      ],
    };
    const result = parseAndMigrateState(oldV2);
    expect(result!.weeks[0].exercises[0].conditioningDone).toBe(false);
  });

  it('returns null for null input', () => {
    expect(parseAndMigrateState(null)).toBeNull();
  });

  it('returns null for string input', () => {
    expect(parseAndMigrateState('not an object')).toBeNull();
  });
});
