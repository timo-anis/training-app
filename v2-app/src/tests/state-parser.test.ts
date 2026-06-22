/**
 * Tests for src/services/state-parser.ts
 *
 * Coverage:
 * - V2 schema normalisation (parseAndMigrateState): pass-through, missing
 *   conditioningDone backfill, invalid input.
 */

import { describe, it, expect } from 'vitest';
import { parseAndMigrateState } from '../services/state-parser';

describe('parseAndMigrateState', () => {
  it('preserves all data and upgrades the schema tag to 4.1', () => {
    const v2: import('../types/workout').AppState = {
      schema: '4.0',
      weeks: [
        {
          week: 1, day: 'Monday', date: '2026-02-16',
          exercises: [
            {
              id: 'bench_1', name: 'Bench Press', type: 'single', code: '',
              sets: [{ kg: '80', reps: '8', done: true, rpe: '' }],
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
    expect(result!.schema).toBe('4.1');
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

  it('backfills rpe:"" on every set in old 4.0 blobs and preserves everything else', () => {
    const old40 = {
      schema: '4.0' as const,
      weeks: [
        {
          week: 1, day: 'Monday' as const, date: '2026-02-16',
          exercises: [
            {
              id: 'sq', name: 'Squat', type: 'superset' as const, code: 'A',
              sets: [
                { kg: '100', reps: '5', done: true },   // no rpe (pre-4.1)
                { kg: '100', reps: '5', done: false },
              ],
              rest: '2:00', note: 'keep',
              recovery: false, recoveryDone: false,
              conditioning: false, conditioningNote: '', conditioningDone: false,
            },
          ],
        },
      ],
    };
    const r = parseAndMigrateState(old40)!;
    expect(r.schema).toBe('4.1');
    const ex = r.weeks[0].exercises[0];
    // rpe backfilled, nothing else touched
    expect(ex.sets.map(x => x.rpe)).toEqual(['', '']);
    expect(ex.sets[0].done).toBe(true);
    expect(ex.sets[1].done).toBe(false);
    expect(ex.sets[0].kg).toBe('100');
    expect(ex.type).toBe('superset');
    expect(ex.code).toBe('A');
    expect(ex.note).toBe('keep');
  });

  it('does not overwrite an existing rpe value', () => {
    const blob = {
      schema: '4.1' as const,
      weeks: [
        {
          week: 1, day: 'Monday' as const, date: '2026-02-16',
          exercises: [
            {
              id: 'b', name: 'Bench', type: 'single' as const, code: '',
              sets: [{ kg: '80', reps: '8', done: true, rpe: '8.5' }],
              rest: '', note: '',
              recovery: false, recoveryDone: false,
              conditioning: false, conditioningNote: '', conditioningDone: false,
            },
          ],
        },
      ],
    };
    const r = parseAndMigrateState(blob)!;
    expect(r.weeks[0].exercises[0].sets[0].rpe).toBe('8.5');
  });

  it('returns null for null input', () => {
    expect(parseAndMigrateState(null)).toBeNull();
  });

  it('returns null for string input', () => {
    expect(parseAndMigrateState('not an object')).toBeNull();
  });
});
