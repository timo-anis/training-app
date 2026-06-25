/**
 * state-parser edge cases — null elements, unknown schema, malformed inputs.
 *
 * These complement the main state-parser.test.ts which covers the happy paths.
 * The invariant: parseAndMigrateState NEVER throws, always returns AppState|null.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseAndMigrateState } from '../services/state-parser';

afterEach(() => vi.restoreAllMocks());

describe('parseAndMigrateState — null/missing elements', () => {
  it('returns emptyAppState() when weeks is not an array (missing)', () => {
    const result = parseAndMigrateState({ schema: '4.1' });
    expect(result).not.toBeNull();
    expect(result!.weeks).toEqual([]);
    expect(result!.schema).toBe('4.1');
  });

  it('filters out null entries in weeks[]', () => {
    const state = {
      schema: '4.1',
      weeks: [
        null,
        { week: 1, day: 'Monday', date: '2026-02-16', exercises: [] },
        null,
      ],
    };
    const r = parseAndMigrateState(state)!;
    expect(r.weeks).toHaveLength(1);
    expect(r.weeks[0].week).toBe(1);
  });

  it('filters out null entries in exercises[]', () => {
    const state = {
      schema: '4.1',
      weeks: [
        {
          week: 1, day: 'Monday', date: '2026-02-16',
          exercises: [
            null,
            {
              id: 'sq', name: 'Squat', type: 'single', code: '',
              sets: [{ kg: '100', reps: '5', done: false, rpe: '' }],
              rest: '', note: '', recovery: false, recoveryDone: false,
              conditioning: false, conditioningNote: '', conditioningDone: false,
            },
          ],
        },
      ],
    };
    const r = parseAndMigrateState(state)!;
    expect(r.weeks[0].exercises).toHaveLength(1);
    expect(r.weeks[0].exercises[0].name).toBe('Squat');
  });

  it('filters out null entries in sets[]', () => {
    const state = {
      schema: '4.1',
      weeks: [
        {
          week: 1, day: 'Monday', date: '2026-02-16',
          exercises: [
            {
              id: 'sq', name: 'Squat', type: 'single', code: '',
              sets: [null, { kg: '100', reps: '5', done: false, rpe: '' }, null],
              rest: '', note: '', recovery: false, recoveryDone: false,
              conditioning: false, conditioningNote: '', conditioningDone: false,
            },
          ],
        },
      ],
    };
    const r = parseAndMigrateState(state)!;
    expect(r.weeks[0].exercises[0].sets).toHaveLength(1);
    expect(r.weeks[0].exercises[0].sets[0].kg).toBe('100');
  });

  it('handles exercises:null gracefully (treats as empty array)', () => {
    const state = {
      schema: '4.1',
      weeks: [{ week: 1, day: 'Monday', date: '2026-02-16', exercises: null }],
    };
    const r = parseAndMigrateState(state)!;
    expect(r.weeks[0].exercises).toEqual([]);
  });

  it('handles sets:null gracefully (treats as empty array)', () => {
    const state = {
      schema: '4.1',
      weeks: [
        {
          week: 1, day: 'Monday', date: '2026-02-16',
          exercises: [
            {
              id: 'sq', name: 'Squat', type: 'single', code: '',
              sets: null,
              rest: '', note: '', recovery: false, recoveryDone: false,
              conditioning: false, conditioningNote: '', conditioningDone: false,
            },
          ],
        },
      ],
    };
    const r = parseAndMigrateState(state)!;
    expect(r.weeks[0].exercises[0].sets).toEqual([]);
  });
});

describe('parseAndMigrateState — unknown future schema', () => {
  it('logs a warning but still returns parsed data for unknown schema "5.0"', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = {
      schema: '5.0',
      weeks: [
        {
          week: 1, day: 'Monday', date: '2026-02-16',
          exercises: [
            {
              id: 'b', name: 'Bench', type: 'single', code: '',
              sets: [{ kg: '80', reps: '8', done: false, rpe: '' }],
              rest: '', note: '', recovery: false, recoveryDone: false,
              conditioning: false, conditioningNote: '', conditioningDone: false,
              someNewField: 'preserved',  // future field — must survive
            },
          ],
        },
      ],
    };
    const r = parseAndMigrateState(state)!;
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('5.0');
    // Data survives despite unknown schema
    expect(r.weeks[0].exercises[0].name).toBe('Bench');
    // Future fields preserved by spread
    expect((r.weeks[0].exercises[0] as any).someNewField).toBe('preserved');
  });

  it('does NOT warn for known schemas 4.0 and 4.1', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = {
      weeks: [{ week: 1, day: 'Monday', date: '2026-02-16', exercises: [] }],
    };
    parseAndMigrateState({ ...base, schema: '4.0' });
    parseAndMigrateState({ ...base, schema: '4.1' });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('parseAndMigrateState — invalid inputs never throw', () => {
  // Note: [] is typeof 'object', so it goes through the AppState path and
  // returns emptyAppState() (not null). Only primitive non-objects → null.
  it.each([
    ['number', 42],
    ['boolean', true],
    ['empty string', ''],
    ['undefined', undefined],
    ['null', null],
  ])('returns null for %s input', (_label, input) => {
    expect(() => parseAndMigrateState(input)).not.toThrow();
    expect(parseAndMigrateState(input)).toBeNull();
  });

  it('returns emptyAppState() for an array (typeof object, but no .weeks)', () => {
    // [] is typeof 'object' so it passes the non-object guard;
    // Array.isArray([].weeks) is false → falls through to emptyAppState().
    const r = parseAndMigrateState([]);
    expect(r).not.toBeNull();
    expect(r!.weeks).toEqual([]);
  });
});
