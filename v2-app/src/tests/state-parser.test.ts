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
    expect(result!.schema).toBe('4.0');
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
