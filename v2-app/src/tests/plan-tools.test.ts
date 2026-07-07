/**
 * plan-tools.test.ts — coach planning helpers added from trainer feedback
 * 2026-07-06: week day-strip states, cleanForPlan, whole-week copy.
 */
import { describe, it, expect } from 'vitest';
import {
  weekDayStates, cleanForPlan, listWeekCopySources, buildWeekCopyPlan,
  type Assignment,
} from '../lib/assignments';
import { DAY_ORDER, type Exercise, type WorkoutDay, type DayOfWeek } from '../types/workout';

const ex = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'e1', name: 'Squat', type: 'single', code: '', rest: '90', note: 'n',
  recovery: false, recoveryDone: false, conditioning: false, conditioningNote: '', conditioningDone: false,
  sets: [{ kg: '100', reps: '5', done: true, rpe: '8' }],
  ...over,
});

const day = (week: number, d: DayOfWeek, exercises: Exercise[] = [ex()]): WorkoutDay =>
  ({ week, day: d, date: '2026-07-06', exercises });

const asg = (week: number, d: DayOfWeek, exercises: Exercise[] = [ex()]): Assignment =>
  ({ id: `a-${week}-${d}`, week, day: d, exercises, updatedAt: null });

const amap = (...list: Assignment[]): Record<string, Assignment> =>
  Object.fromEntries(list.map((a) => [`${a.week}|${a.day}`, a]));

describe('weekDayStates', () => {
  it('marks actual, planned and empty days for the requested week only', () => {
    const weeks = [day(3, 'Monday'), day(2, 'Wednesday')];
    const assignments = amap(asg(3, 'Tuesday'), asg(2, 'Friday'));
    const st = weekDayStates(weeks, assignments, 3, DAY_ORDER);
    expect(st.Monday).toBe('actual');
    expect(st.Tuesday).toBe('planned');
    expect(st.Wednesday).toBe('empty');   // week 2 data must not bleed in
    expect(st.Friday).toBe('empty');
    expect(st.Sunday).toBe('empty');
  });

  it('actual wins over planned on the same day', () => {
    const st = weekDayStates([day(1, 'Monday')], amap(asg(1, 'Monday')), 1, DAY_ORDER);
    expect(st.Monday).toBe('actual');
  });

  it('a logged day with zero exercises counts as empty', () => {
    const st = weekDayStates([day(1, 'Monday', [])], {}, 1, DAY_ORDER);
    expect(st.Monday).toBe('empty');
  });
});

describe('cleanForPlan', () => {
  it('preserves structure: name, type, code, rest, note, set count, kg/reps', () => {
    const src = ex({ type: 'superset', code: 'A2', sets: [
      { kg: '60', reps: '8', done: true, rpe: '9' },
      { kg: '65', reps: '6', done: true, rpe: '8' },
    ] });
    const out = cleanForPlan(src);
    expect(out.name).toBe('Squat');
    expect(out.type).toBe('superset');
    expect(out.code).toBe('A2');            // superset pairing preserved
    expect(out.rest).toBe('90');
    expect(out.note).toBe('n');
    expect(out.sets.map((s) => `${s.kg}x${s.reps}`)).toEqual(['60x8', '65x6']);
  });

  it('resets completion: done=false, rpe="", recovery/conditioning done flags', () => {
    const out = cleanForPlan(ex({ recoveryDone: true, conditioningDone: true }));
    expect(out.sets.every((s) => !s.done && s.rpe === '')).toBe(true);
    expect(out.recoveryDone).toBe(false);
    expect(out.conditioningDone).toBe(false);
  });

  it('generates a fresh id and does not mutate the source', () => {
    const src = ex();
    const out = cleanForPlan(src);
    expect(out.id).not.toBe(src.id);
    expect(src.sets[0].done).toBe(true);    // source untouched
  });

  it('an exercise with no sets gets one empty set', () => {
    const out = cleanForPlan(ex({ sets: [] }));
    expect(out.sets).toEqual([{ kg: '', reps: '', done: false, rpe: '' }]);
  });
});

describe('listWeekCopySources', () => {
  it('unions plan weeks and log weeks, newest first, excluding the target week', () => {
    const weeks = [day(5, 'Monday'), day(3, 'Tuesday')];
    const assignments = amap(asg(6, 'Friday'), asg(3, 'Thursday'));
    const out = listWeekCopySources(weeks, assignments, 5, DAY_ORDER);
    expect(out.map((s) => s.week)).toEqual([6, 3]); // 5 excluded, desc order
  });

  it('per day the coach plan wins over the trainee log', () => {
    const planEx = [ex({ name: 'Planned Bench' })];
    const weeks = [day(2, 'Monday')];
    const assignments = amap(asg(2, 'Monday', planEx));
    const [src] = listWeekCopySources(weeks, assignments, 9, DAY_ORDER);
    expect(src.days).toHaveLength(1);
    expect(src.days[0].from).toBe('plan');
    expect(src.days[0].exercises[0].name).toBe('Planned Bench');
  });

  it('days come out in weekday order', () => {
    const weeks = [day(2, 'Friday'), day(2, 'Monday')];
    const [src] = listWeekCopySources(weeks, {}, 9, DAY_ORDER);
    expect(src.days.map((d) => d.day)).toEqual(['Monday', 'Friday']);
  });

  it('empty-exercise days never produce a source', () => {
    expect(listWeekCopySources([day(2, 'Monday', [])], {}, 9, DAY_ORDER)).toEqual([]);
  });
});

describe('buildWeekCopyPlan', () => {
  const days = (...ds: DayOfWeek[]) => ds.map((d) => ({ day: d, exercises: [ex()], from: 'log' as const }));

  it('writes to free days, skips trainee-owned actual days', () => {
    const plan = buildWeekCopyPlan(days('Monday', 'Wednesday', 'Friday'), new Set(['Wednesday']));
    expect(plan.writes.map((w) => w.day)).toEqual(['Monday', 'Friday']);
    expect(plan.skippedActual).toEqual(['Wednesday']);
  });

  it('never lands source completion state in the writes', () => {
    const plan = buildWeekCopyPlan(days('Monday'), new Set());
    expect(plan.writes[0].exercises[0].sets.every((s) => !s.done && s.rpe === '')).toBe(true);
  });

  it('gives every copied day fresh exercise ids (no cross-day id sharing)', () => {
    const shared = [ex({ id: 'same' })];
    const plan = buildWeekCopyPlan(
      [{ day: 'Monday', exercises: shared, from: 'plan' }, { day: 'Tuesday', exercises: shared, from: 'plan' }],
      new Set()
    );
    const [a] = plan.writes[0].exercises;
    const [b] = plan.writes[1].exercises;
    expect(a.id).not.toBe('same');
    expect(a.id).not.toBe(b.id);
  });

  it('copying everything into a fully-logged week writes nothing', () => {
    const plan = buildWeekCopyPlan(days('Monday', 'Tuesday'), new Set(['Monday', 'Tuesday']));
    expect(plan.writes).toEqual([]);
    expect(plan.skippedActual).toEqual(['Monday', 'Tuesday']);
  });
});
