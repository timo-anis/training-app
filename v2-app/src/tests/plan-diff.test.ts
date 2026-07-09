/**
 * plan-diff.test.ts — plan vs actual diff (lib/plan-diff.ts, coach-UX Track 2).
 */
import { describe, it, expect } from 'vitest';
import { diffPlanVsActual, sameValue } from '../lib/plan-diff';
import type { Exercise, WorkoutSet } from '../types/workout';

function set(kg: string, reps: string, done = false, rpe = ''): WorkoutSet {
  return { kg, reps, done, rpe };
}

function ex(over: Partial<Exercise> & { id: string; name: string }): Exercise {
  return {
    type: 'single', code: '', sets: [], rest: '', note: '',
    recovery: false, recoveryDone: false,
    conditioning: false, conditioningNote: '', conditioningDone: false,
    ...over,
  };
}

describe('sameValue', () => {
  it('trims and compares numerically: 60 == 60.0 == " 60 "', () => {
    expect(sameValue('60', '60.0')).toBe(true);
    expect(sameValue(' 60 ', '60')).toBe(true);
    expect(sameValue('60', '62.5')).toBe(false);
  });
  it('empty never equals non-empty; non-numeric falls back to string equality', () => {
    expect(sameValue('', '60')).toBe(false);
    expect(sameValue('', '')).toBe(true);
    expect(sameValue('BW', 'bw ')).toBe(false);
    expect(sameValue('BW', 'BW')).toBe(true);
  });
});

describe('diffPlanVsActual — panel gating', () => {
  it('returns null for empty/absent plan (panel must not render)', () => {
    expect(diffPlanVsActual([], [ex({ id: 'a', name: 'Squat' })])).toBeNull();
    expect(diffPlanVsActual(null, [])).toBeNull();
    expect(diffPlanVsActual(undefined, [])).toBeNull();
  });

  it('plan exists but day empty: every exercise skipped, nothing unplanned', () => {
    const d = diffPlanVsActual([ex({ id: 'p1', name: 'Squat', sets: [set('60', '8')] })], [])!;
    expect(d.summary).toMatchObject({ planned: 1, matched: 0, skipped: 1, unplanned: 0 });
    expect(d.exercises[0].status).toBe('skipped');
  });
});

describe('diffPlanVsActual — matching', () => {
  it('exact match by id: as-prescribed sets, no deviations', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8'), set('60', '8')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8', true, '8'), set('60', '8', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ status: 'matched', matchedBy: 'id', deviations: 0 });
    expect(d.summary).toMatchObject({ setsAsPrescribed: 2, setsChanged: 0, setsDone: 2 });
  });

  it('falls back to normalized-name match when ids differ (manual day build)', () => {
    const plan = [ex({ id: 'plan_1', name: 'Bench press', sets: [set('80', '5')] })];
    const act = [ex({ id: 'log_9', name: '  bench PRESS ', sets: [set('80', '5', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ status: 'matched', matchedBy: 'name' });
  });

  it('duplicate names pair positionally, never double-match one actual', () => {
    const plan = [
      ex({ id: 'p1', name: 'Squat', sets: [set('60', '8')] }),
      ex({ id: 'p2', name: 'Squat', sets: [set('80', '5')] }),
    ];
    const act = [ex({ id: 'a1', name: 'Squat', sets: [set('60', '8')] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises.filter((e) => e.status === 'matched')).toHaveLength(1);
    expect(d.exercises.filter((e) => e.status === 'skipped')).toHaveLength(1);
    expect(d.summary).toMatchObject({ matched: 1, skipped: 1, unplanned: 0 });
  });

  it('id match wins over name match and consumes the actual', () => {
    const plan = [
      ex({ id: 'e1', name: 'Row', sets: [set('50', '10')] }),
      ex({ id: 'p2', name: 'Row', sets: [set('55', '8')] }),
    ];
    const act = [ex({ id: 'e1', name: 'Row', sets: [set('50', '10')] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ matchedBy: 'id', status: 'matched' });
    expect(d.exercises[1].status).toBe('skipped');
  });
});

describe('diffPlanVsActual — set-level diff', () => {
  it('kg/reps deviation marks the set changed and counts a deviation', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8'), set('60', '8')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('62.5', '8', true), set('60', '6', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0].sets.map((s) => s.status)).toEqual(['changed', 'changed']);
    expect(d.exercises[0].deviations).toBe(2);
    expect(d.summary.setsChanged).toBe(2);
  });

  it('trainee did fewer sets: trailing prescribed sets are missing', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8'), set('60', '8'), set('60', '8')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0].sets.map((s) => s.status)).toEqual(['as-prescribed', 'missing', 'missing']);
    expect(d.summary.setsMissing).toBe(2);
  });

  it('trainee did extra sets: surplus actual sets are extra', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8', true), set('65', '5', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0].sets.map((s) => s.status)).toEqual(['as-prescribed', 'extra']);
    expect(d.summary.setsExtra).toBe(1);
  });

  it('numeric equivalence: 60 vs 60.0 is as-prescribed, not changed', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('60.0', '8')] })];
    expect(diffPlanVsActual(plan, act)!.exercises[0].deviations).toBe(0);
  });

  it('carries actual done + rpe through for display', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8', true, '7.5')] })];
    const s = diffPlanVsActual(plan, act)!.exercises[0].sets[0];
    expect(s.actual).toMatchObject({ done: true, rpe: '7.5' });
    expect(s.prescribed).toMatchObject({ kg: '60', reps: '8' });
  });
});

describe('diffPlanVsActual — skipped / unplanned', () => {
  it('planned exercise absent from the log is skipped; unmatched actual is unplanned', () => {
    const plan = [ex({ id: 'p1', name: 'Deadlift', sets: [set('100', '5')] })];
    const act = [ex({ id: 'a1', name: 'Leg press', sets: [set('120', '10', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.summary).toMatchObject({ skipped: 1, unplanned: 1, matched: 0 });
    expect(d.exercises.map((e) => e.status)).toEqual(['skipped', 'unplanned']);
    expect(d.exercises[1].sets[0].status).toBe('extra');
  });

  it('plan order preserved; unplanned appended after, in actual order', () => {
    const plan = [
      ex({ id: 'p1', name: 'A1', code: 'A1', type: 'superset', sets: [set('10', '10')] }),
      ex({ id: 'p2', name: 'A2', code: 'A2', type: 'superset', sets: [set('20', '10')] }),
      ex({ id: 'p3', name: 'B', sets: [set('30', '10')] }),
    ];
    const act = [
      ex({ id: 'x1', name: 'Extra one', sets: [set('5', '5')] }),
      ex({ id: 'p2', name: 'A2', code: 'A2', type: 'superset', sets: [set('20', '10')] }),
      ex({ id: 'p1', name: 'A1', code: 'A1', type: 'superset', sets: [set('10', '10')] }),
      ex({ id: 'x2', name: 'Extra two', sets: [set('6', '6')] }),
    ];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises.map((e) => e.name)).toEqual(['A1', 'A2', 'B', 'Extra one', 'Extra two']);
    expect(d.exercises.map((e) => e.status)).toEqual(['matched', 'matched', 'skipped', 'unplanned', 'unplanned']);
  });
});

describe('diffPlanVsActual — recovery / conditioning', () => {
  it('recovery exercise compares by done flag, no set rows', () => {
    const plan = [ex({ id: 'r1', name: 'Stretching', recovery: true })];
    const act = [ex({ id: 'r1', name: 'Stretching', recovery: true, recoveryDone: true })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ flagOnly: true, flagDone: true, sets: [] });
  });

  it('conditioning exercise compares by done flag', () => {
    const plan = [ex({ id: 'c1', name: 'Bike', conditioning: true })];
    const act = [ex({ id: 'c1', name: 'Bike', conditioning: true, conditioningDone: false })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ flagOnly: true, flagDone: false });
  });

  it('unplanned recovery entry reports flagOnly with no extra set noise', () => {
    const d = diffPlanVsActual(
      [ex({ id: 'p1', name: 'Squat', sets: [set('60', '8')] })],
      [
        ex({ id: 'p1', name: 'Squat', sets: [set('60', '8', true)] }),
        ex({ id: 'r9', name: 'Foam roll', recovery: true, recoveryDone: true }),
      ]
    )!;
    const un = d.exercises.find((e) => e.status === 'unplanned')!;
    expect(un).toMatchObject({ flagOnly: true, flagDone: true, sets: [] });
    expect(d.summary.setsExtra).toBe(0);
  });
});

describe('diffPlanVsActual — honest completion (adversarial F1)', () => {
  it('materialized-but-abandoned day: matched but NOT done', () => {
    // Start plan -> materialize (ids preserved, done=false everywhere) -> abandon.
    const plan = [
      ex({ id: 'e1', name: 'Squat', sets: [set('60', '8'), set('60', '8')] }),
      ex({ id: 'e2', name: 'Row', sets: [set('50', '10')] }),
    ];
    const act = [
      ex({ id: 'e1', name: 'Squat', sets: [set('60', '8'), set('60', '8')] }),
      ex({ id: 'e2', name: 'Row', sets: [set('50', '10')] }),
    ];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.summary.matched).toBe(2);
    expect(d.summary.exercisesDone).toBe(0); // nothing was actually trained
    expect(d.exercises.map((e) => e.complete)).toEqual([false, false]);
    expect(d.exercises[0]).toMatchObject({ setsPlanned: 2, setsDoneCount: 0 });
  });

  it('all prescribed sets done with changed weight: complete=true, deviations kept', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('62.5', '8', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ complete: true, deviations: 1 });
    expect(d.summary.exercisesDone).toBe(1);
  });

  it('extra done sets never count against the prescribed denominator', () => {
    // Trainee skips both prescribed rows, appends 2 extra done sets:
    // badge must read 0/2, not 2/2 (adversarial loop-2 finding).
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('100', '5'), set('100', '5')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('100', '5'), set('100', '5'), set('60', '10', true), set('60', '10', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ setsPlanned: 2, setsDoneCount: 0, complete: false });
    expect(d.summary.setsDone).toBe(2); // summary still counts all done work
    expect(d.summary.exercisesDone).toBe(0);
  });

  it('partially done: complete=false with honest counts', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8'), set('60', '8'), set('60', '8')] })];
    const act = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8', true), set('60', '8', true), set('60', '8')] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ complete: false, setsPlanned: 3, setsDoneCount: 2 });
    expect(d.summary.exercisesDone).toBe(0);
  });
});

describe('diffPlanVsActual — mixed flag/plain pairs (adversarial F2)', () => {
  it('plan recovery + plain actual with done sets: counts as done', () => {
    const plan = [ex({ id: 'p1', name: 'Stretching', recovery: true })];
    const act = [ex({ id: 'a1', name: 'Stretching', sets: [set('0', '10', true)] })];
    const d = diffPlanVsActual(plan, act)!;
    expect(d.exercises[0]).toMatchObject({ flagOnly: true, flagDone: true, complete: true, status: 'matched' });
    expect(d.summary.exercisesDone).toBe(1);
  });

  it('plan sets + flag-only actual: prescribed sets still displayed as missing', () => {
    const plan = [ex({ id: 'p1', name: 'Squat', sets: [set('100', '5'), set('100', '5')] })];
    const act = [ex({ id: 'p1', name: 'Squat', recovery: true, recoveryDone: true })];
    const d = diffPlanVsActual(plan, act)!;
    const e = d.exercises[0];
    expect(e.flagOnly).toBe(false); // plan side decides the kind
    expect(e.sets.map((x) => x.status)).toEqual(['missing', 'missing']);
    expect(e.sets[0].prescribed).toMatchObject({ kg: '100', reps: '5' });
    expect(e.complete).toBe(false);
  });
});

describe('diffPlanVsActual — render keys', () => {
  it('keys are unique even when names, codes and statuses all repeat', () => {
    const plan = [
      ex({ id: 'p1', name: 'Squat', sets: [set('60', '8')] }),
      ex({ id: 'p2', name: 'Squat', sets: [set('80', '5')] }),
    ];
    const act = [
      ex({ id: 'x1', name: 'Curl', sets: [set('10', '12')] }),
      ex({ id: 'x2', name: 'Curl', sets: [set('10', '12')] }),
    ];
    const d = diffPlanVsActual(plan, act)!;
    // 2× skipped 'Squat' + 2× unplanned 'Curl' — the exact duplicate-key input class
    const keys = d.exercises.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(['p0', 'p1', 'a0', 'a1']);
  });
});

describe('diffPlanVsActual — purity', () => {
  it('does not mutate its inputs', () => {
    const plan = [ex({ id: 'e1', name: 'Squat', sets: [set('60', '8')] })];
    const act = [ex({ id: 'e2', name: 'Row', sets: [set('50', '10', true)] })];
    const planSnap = JSON.stringify(plan);
    const actSnap = JSON.stringify(act);
    diffPlanVsActual(plan, act);
    expect(JSON.stringify(plan)).toBe(planSnap);
    expect(JSON.stringify(act)).toBe(actSnap);
  });
});
