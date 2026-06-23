/**
 * Tests for src/lib/state-helpers.ts
 *
 * Critical coverage:
 * - toggleSetDoneInState: toggle on/off, correct index, other sets untouched
 * - deleteSetFromState: removes correct index, set count decrements
 * - insertSetInState: inserts at correct index (used for undo)
 * - addSetToState: copies last set values, done=false
 * - updateSetFieldInState: updates kg/reps at correct index
 * - deleteExerciseFromState: removes exercise, others untouched
 * - renameExerciseInState: renames, ignores empty string
 * - moveExerciseInState: up/down, boundary guards
 * - buildWorkoutBlocks: singles, supersets, mixed, empty
 */

import { describe, it, expect } from 'vitest';
import {
  toggleSetDoneInState,
  deleteSetFromState,
  insertSetInState,
  addSetToState,
  updateSetFieldInState,
  deleteExerciseFromState,
  renameExerciseInState,
  moveExerciseInState,
  buildWorkoutBlocks,
} from '../lib/state-helpers';
import type { AppState, Exercise } from '../types/workout';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeExercise(id: string, name = 'Bench Press', overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name,
    type: 'single',
    code: '',
    sets: [
      { kg: '80', reps: '8', done: false, rpe: '' },
      { kg: '80', reps: '8', done: false, rpe: '' },
      { kg: '75', reps: '10', done: false, rpe: '' },
    ],
    rest: '',
    note: '',
    recovery: false,
    recoveryDone: false,
    conditioning: false,
    conditioningNote: '',
    conditioningDone: false,
    ...overrides,
  };
}

function makeState(exercises: Exercise[] = [makeExercise('ex1')]): AppState {
  return {
    schema: '4.0',
    weeks: [
      { week: 1, day: 'Monday', date: '2026-02-16', exercises },
    ],
  };
}

// ── toggleSetDoneInState ─────────────────────────────────────────────────────

describe('toggleSetDoneInState', () => {
  it('toggles done=false → true', () => {
    const state = makeState();
    const next = toggleSetDoneInState(state, 1, 'Monday', 'ex1', 0);
    expect(next.weeks[0].exercises[0].sets[0].done).toBe(true);
  });

  it('toggles done=true → false', () => {
    const ex = makeExercise('ex1', 'Bench', { sets: [{ kg: '80', reps: '8', done: true, rpe: '' }] });
    const state = makeState([ex]);
    const next = toggleSetDoneInState(state, 1, 'Monday', 'ex1', 0);
    expect(next.weeks[0].exercises[0].sets[0].done).toBe(false);
  });

  it('only toggles the targeted set index', () => {
    const state = makeState();
    const next = toggleSetDoneInState(state, 1, 'Monday', 'ex1', 1);
    const sets = next.weeks[0].exercises[0].sets;
    expect(sets[0].done).toBe(false); // untouched
    expect(sets[1].done).toBe(true);  // toggled
    expect(sets[2].done).toBe(false); // untouched
  });

  it('does not mutate original state', () => {
    const state = makeState();
    toggleSetDoneInState(state, 1, 'Monday', 'ex1', 0);
    expect(state.weeks[0].exercises[0].sets[0].done).toBe(false);
  });

  it('leaves other exercises untouched', () => {
    const ex2 = makeExercise('ex2', 'Squat');
    const state = makeState([makeExercise('ex1'), ex2]);
    const next = toggleSetDoneInState(state, 1, 'Monday', 'ex1', 0);
    expect(next.weeks[0].exercises[1].sets[0].done).toBe(false);
  });
});

// ── deleteSetFromState ───────────────────────────────────────────────────────

describe('deleteSetFromState', () => {
  it('reduces set count by 1', () => {
    const state = makeState();
    const next = deleteSetFromState(state, 1, 'Monday', 'ex1', 0);
    expect(next.weeks[0].exercises[0].sets).toHaveLength(2);
  });

  it('removes the correct set (index 0)', () => {
    const state = makeState();
    const next = deleteSetFromState(state, 1, 'Monday', 'ex1', 0);
    // set at index 1 becomes index 0
    expect(next.weeks[0].exercises[0].sets[0].reps).toBe('8');
    expect(next.weeks[0].exercises[0].sets[1].reps).toBe('10');
  });

  it('removes the correct set (index 2, last)', () => {
    const state = makeState();
    const next = deleteSetFromState(state, 1, 'Monday', 'ex1', 2);
    expect(next.weeks[0].exercises[0].sets).toHaveLength(2);
    expect(next.weeks[0].exercises[0].sets[1].reps).toBe('8');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    deleteSetFromState(state, 1, 'Monday', 'ex1', 0);
    expect(state.weeks[0].exercises[0].sets).toHaveLength(3);
  });
});

// ── insertSetInState ─────────────────────────────────────────────────────────

describe('insertSetInState', () => {
  it('inserts at index 0 (prepend)', () => {
    const state = makeState();
    const newSet = { kg: '90', reps: '5', done: true, rpe: '' };
    const next = insertSetInState(state, 1, 'Monday', 'ex1', 0, newSet);
    const sets = next.weeks[0].exercises[0].sets;
    expect(sets).toHaveLength(4);
    expect(sets[0]).toEqual({ kg: '90', reps: '5', done: true, rpe: '' });
    expect(sets[1].kg).toBe('80'); // original first
  });

  it('inserts at index 1 (middle)', () => {
    const state = makeState();
    const newSet = { kg: '70', reps: '12', done: false, rpe: '' };
    const next = insertSetInState(state, 1, 'Monday', 'ex1', 1, newSet);
    const sets = next.weeks[0].exercises[0].sets;
    expect(sets).toHaveLength(4);
    expect(sets[1]).toEqual({ kg: '70', reps: '12', done: false, rpe: '' });
  });

  it('round-trips with deleteSetFromState (undo scenario)', () => {
    const state = makeState();
    const originalSet = { ...state.weeks[0].exercises[0].sets[1] };
    const afterDelete = deleteSetFromState(state, 1, 'Monday', 'ex1', 1);
    const afterUndo = insertSetInState(afterDelete, 1, 'Monday', 'ex1', 1, originalSet);
    expect(afterUndo.weeks[0].exercises[0].sets).toHaveLength(3);
    expect(afterUndo.weeks[0].exercises[0].sets[1]).toEqual(originalSet);
  });
});

// ── addSetToState ────────────────────────────────────────────────────────────

describe('addSetToState', () => {
  it('increases set count by 1', () => {
    const state = makeState();
    const next = addSetToState(state, 1, 'Monday', 'ex1');
    expect(next.weeks[0].exercises[0].sets).toHaveLength(4);
  });

  it('copies kg and reps from last set', () => {
    const state = makeState();
    const next = addSetToState(state, 1, 'Monday', 'ex1');
    const added = next.weeks[0].exercises[0].sets[3];
    expect(added.kg).toBe('75');  // from set[2]
    expect(added.reps).toBe('10');
  });

  it('new set is always done=false', () => {
    const ex = makeExercise('ex1', 'Bench', {
      sets: [{ kg: '80', reps: '8', done: true, rpe: '' }],
    });
    const state = makeState([ex]);
    const next = addSetToState(state, 1, 'Monday', 'ex1');
    expect(next.weeks[0].exercises[0].sets[1].done).toBe(false);
  });

  it('on empty exercise, adds a blank set', () => {
    const ex = makeExercise('ex1', 'Bench', { sets: [] });
    const state = makeState([ex]);
    const next = addSetToState(state, 1, 'Monday', 'ex1');
    const sets = next.weeks[0].exercises[0].sets;
    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual({ kg: '', reps: '', done: false, rpe: '' });
  });
});

// ── updateSetFieldInState ────────────────────────────────────────────────────

describe('updateSetFieldInState', () => {
  it('updates kg at correct index', () => {
    const state = makeState();
    const next = updateSetFieldInState(state, 1, 'Monday', 'ex1', 0, 'kg', '85');
    expect(next.weeks[0].exercises[0].sets[0].kg).toBe('85');
    expect(next.weeks[0].exercises[0].sets[1].kg).toBe('80'); // untouched
  });

  it('updates reps at correct index', () => {
    const state = makeState();
    const next = updateSetFieldInState(state, 1, 'Monday', 'ex1', 2, 'reps', '12');
    expect(next.weeks[0].exercises[0].sets[2].reps).toBe('12');
    expect(next.weeks[0].exercises[0].sets[0].reps).toBe('8'); // untouched
  });
});

// ── deleteExerciseFromState ──────────────────────────────────────────────────

describe('deleteExerciseFromState', () => {
  it('removes the targeted exercise', () => {
    const state = makeState([makeExercise('ex1'), makeExercise('ex2', 'Squat')]);
    const next = deleteExerciseFromState(state, 1, 'Monday', 'ex1');
    expect(next.weeks[0].exercises).toHaveLength(1);
    expect(next.weeks[0].exercises[0].id).toBe('ex2');
  });

  it('leaves other exercises untouched', () => {
    const state = makeState([makeExercise('ex1'), makeExercise('ex2', 'Squat'), makeExercise('ex3', 'Row')]);
    const next = deleteExerciseFromState(state, 1, 'Monday', 'ex2');
    expect(next.weeks[0].exercises.map(e => e.id)).toEqual(['ex1', 'ex3']);
  });

  it('unknown id leaves state unchanged', () => {
    const state = makeState();
    const next = deleteExerciseFromState(state, 1, 'Monday', 'not_exists');
    expect(next.weeks[0].exercises).toHaveLength(1);
  });
});

// ── renameExerciseInState ────────────────────────────────────────────────────

describe('renameExerciseInState', () => {
  it('renames the exercise', () => {
    const state = makeState();
    const next = renameExerciseInState(state, 1, 'Monday', 'ex1', 'Incline Press');
    expect(next.weeks[0].exercises[0].name).toBe('Incline Press');
  });

  it('trims whitespace', () => {
    const state = makeState();
    const next = renameExerciseInState(state, 1, 'Monday', 'ex1', '  Pull-Up  ');
    expect(next.weeks[0].exercises[0].name).toBe('Pull-Up');
  });

  it('empty string → no change', () => {
    const state = makeState();
    const next = renameExerciseInState(state, 1, 'Monday', 'ex1', '');
    expect(next.weeks[0].exercises[0].name).toBe('Bench Press');
  });

  it('whitespace-only string → no change', () => {
    const state = makeState();
    const next = renameExerciseInState(state, 1, 'Monday', 'ex1', '   ');
    expect(next.weeks[0].exercises[0].name).toBe('Bench Press');
  });
});

// ── moveExerciseInState ──────────────────────────────────────────────────────

describe('moveExerciseInState', () => {
  function makeThreeExState() {
    return makeState([
      makeExercise('ex1', 'A'),
      makeExercise('ex2', 'B'),
      makeExercise('ex3', 'C'),
    ]);
  }

  it('moves exercise down', () => {
    const next = moveExerciseInState(makeThreeExState(), 1, 'Monday', 'ex1', 'down');
    expect(next.weeks[0].exercises.map(e => e.id)).toEqual(['ex2', 'ex1', 'ex3']);
  });

  it('moves exercise up', () => {
    const next = moveExerciseInState(makeThreeExState(), 1, 'Monday', 'ex3', 'up');
    expect(next.weeks[0].exercises.map(e => e.id)).toEqual(['ex1', 'ex3', 'ex2']);
  });

  it('moving first exercise up does nothing', () => {
    const state = makeThreeExState();
    const next = moveExerciseInState(state, 1, 'Monday', 'ex1', 'up');
    expect(next.weeks[0].exercises.map(e => e.id)).toEqual(['ex1', 'ex2', 'ex3']);
  });

  it('moving last exercise down does nothing', () => {
    const state = makeThreeExState();
    const next = moveExerciseInState(state, 1, 'Monday', 'ex3', 'down');
    expect(next.weeks[0].exercises.map(e => e.id)).toEqual(['ex1', 'ex2', 'ex3']);
  });
});

// ── buildWorkoutBlocks ───────────────────────────────────────────────────────

describe('buildWorkoutBlocks', () => {
  it('empty list → no blocks', () => {
    expect(buildWorkoutBlocks([])).toHaveLength(0);
  });

  it('single exercise → one block, isSuperset=false', () => {
    const blocks = buildWorkoutBlocks([makeExercise('ex1')]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].isSuperset).toBe(false);
    expect(blocks[0].exercises).toHaveLength(1);
  });

  it('two singles → two blocks', () => {
    const blocks = buildWorkoutBlocks([makeExercise('ex1'), makeExercise('ex2', 'Squat')]);
    expect(blocks).toHaveLength(2);
  });

  it('two superset exercises (same code) → one superset block', () => {
    const a = makeExercise('ex1', 'Pull-down', { type: 'superset', code: 'A' });
    const b = makeExercise('ex2', 'Row', { type: 'superset', code: 'A' });
    const blocks = buildWorkoutBlocks([a, b]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].isSuperset).toBe(true);
    expect(blocks[0].code).toBe('A');
    expect(blocks[0].exercises).toHaveLength(2);
  });

  it('superset + single → two blocks in correct order', () => {
    const a = makeExercise('ex1', 'Pull-down', { type: 'superset', code: 'A' });
    const b = makeExercise('ex2', 'Row', { type: 'superset', code: 'A' });
    const c = makeExercise('ex3', 'Squat');
    const blocks = buildWorkoutBlocks([a, b, c]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].isSuperset).toBe(true);
    expect(blocks[1].isSuperset).toBe(false);
    expect(blocks[1].exercises[0].id).toBe('ex3');
  });

  it('superset members coded A1/A2 (shared first letter) → ONE block, order preserved', () => {
    // Real data codes superset pairs A1, A2 (not a shared exact code). They must
    // group into one "Superset A" block so the user does not page next/back.
    const a1 = makeExercise('a1', 'Strict Press', { type: 'superset', code: 'A1' });
    const a2 = makeExercise('a2', 'Pull-Up', { type: 'superset', code: 'A2' });
    const blocks = buildWorkoutBlocks([a1, a2]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].isSuperset).toBe(true);
    expect(blocks[0].code).toBe('A');
    expect(blocks[0].exercises.map(e => e.id)).toEqual(['a1', 'a2']); // order preserved
  });

  it('three-exercise superset B1/B2/B3 → one block of three', () => {
    const b1 = makeExercise('b1', 'Bench', { type: 'superset', code: 'B1' });
    const b2 = makeExercise('b2', 'Row', { type: 'superset', code: 'B2' });
    const b3 = makeExercise('b3', 'Ab Wheel', { type: 'superset', code: 'B3' });
    const blocks = buildWorkoutBlocks([b1, b2, b3]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].exercises).toHaveLength(3);
    expect(blocks[0].code).toBe('B');
  });

  it('standalone lettered lift (A) + a B1/B2 superset → two blocks in order', () => {
    const a = makeExercise('a', 'Back Squat', { type: 'superset', code: 'A' });
    const b1 = makeExercise('b1', 'Lunge', { type: 'superset', code: 'B1' });
    const b2 = makeExercise('b2', 'Ab Wheel', { type: 'superset', code: 'B2' });
    const blocks = buildWorkoutBlocks([a, b1, b2]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].code).toBe('A');
    expect(blocks[0].exercises).toHaveLength(1);
    expect(blocks[1].code).toBe('B');
    expect(blocks[1].exercises.map(e => e.id)).toEqual(['b1', 'b2']);
  });

  it('two separate supersets (A and B) → two superset blocks', () => {
    const a1 = makeExercise('a1', 'Ex A1', { type: 'superset', code: 'A' });
    const a2 = makeExercise('a2', 'Ex A2', { type: 'superset', code: 'A' });
    const b1 = makeExercise('b1', 'Ex B1', { type: 'superset', code: 'B' });
    const b2 = makeExercise('b2', 'Ex B2', { type: 'superset', code: 'B' });
    const blocks = buildWorkoutBlocks([a1, a2, b1, b2]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].code).toBe('A');
    expect(blocks[1].code).toBe('B');
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[1].exercises).toHaveLength(2);
  });

  it('superset with type=single but non-empty code → treated as single (type wins)', () => {
    // type='single' always produces a non-superset block regardless of code
    const ex = makeExercise('ex1', 'Test', { type: 'single', code: 'A' });
    const blocks = buildWorkoutBlocks([ex]);
    expect(blocks[0].isSuperset).toBe(false);
  });
});
