/**
 * Component tests for WmSetRow — the per-set editor in WorkoutMode.
 * This is the most critical UI component: used on every set during a workout.
 * Tests cover: rendering, done state, callbacks, stepper buttons.
 *
 * Aria labels from component:
 *   done btn  → aria-label="Mark set done" / "Undo set"
 *   delete btn → aria-label="Delete set"
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import WmSetRow from '../components/WmSetRow.svelte';
import type { WorkoutSet } from '../types/workout';

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return { kg: '80', reps: '8', done: false, ...overrides };
}

function props(set: WorkoutSet, overrides = {}) {
  return {
    props: {
      set,
      index:        0,
      idBase:       'test-0',
      kg:           set.kg,
      reps:         set.reps,
      flash:        false,
      onCommitKg:   vi.fn(),
      onCommitReps: vi.fn(),
      onAdjustKg:   vi.fn(),
      onAdjustReps: vi.fn(),
      onDone:       vi.fn(),
      onDelete:     vi.fn(),
      ...overrides,
    },
  };
}

describe('WmSetRow', () => {
  it('renders kg and reps input values', () => {
    const set = makeSet({ kg: '100', reps: '5' });
    render(WmSetRow, props(set));

    expect((screen.getByLabelText('kg') as HTMLInputElement).value).toBe('100');
    expect((screen.getByLabelText('reps') as HTMLInputElement).value).toBe('5');
  });

  it('shows set number as 1-based index', () => {
    render(WmSetRow, props(makeSet(), { index: 2 }));
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('applies done class when set.done is true', () => {
    const { container } = render(WmSetRow, props(makeSet({ done: true })));
    expect(container.querySelector('.set-row')).toHaveClass('done');
  });

  it('does not apply done class when set.done is false', () => {
    const { container } = render(WmSetRow, props(makeSet({ done: false })));
    expect(container.querySelector('.set-row')).not.toHaveClass('done');
  });

  it('calls onDone when done button is clicked', async () => {
    const onDone = vi.fn();
    render(WmSetRow, props(makeSet(), { onDone }));
    await fireEvent.click(screen.getByRole('button', { name: 'Mark set done' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('shows Undo set label when already done', () => {
    render(WmSetRow, props(makeSet({ done: true })));
    expect(screen.getByRole('button', { name: 'Undo set' })).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(WmSetRow, props(makeSet(), { onDelete }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete set' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('calls onAdjustKg(+2.5) when kg + is clicked', async () => {
    const onAdjustKg = vi.fn();
    render(WmSetRow, props(makeSet(), { onAdjustKg }));
    const plusBtns = screen.getAllByRole('button').filter(b => b.textContent === '+');
    await fireEvent.click(plusBtns[0]); // first + is kg column
    expect(onAdjustKg).toHaveBeenCalledWith(2.5);
  });

  it('calls onAdjustKg(-2.5) when kg − is clicked', async () => {
    const onAdjustKg = vi.fn();
    render(WmSetRow, props(makeSet(), { onAdjustKg }));
    const minusBtns = screen.getAllByRole('button').filter(b => b.textContent === '−');
    await fireEvent.click(minusBtns[0]); // first − is kg column
    expect(onAdjustKg).toHaveBeenCalledWith(-2.5);
  });

  it('calls onCommitKg on kg input blur', async () => {
    const onCommitKg = vi.fn();
    render(WmSetRow, props(makeSet(), { onCommitKg }));
    await fireEvent.blur(screen.getByLabelText('kg'));
    expect(onCommitKg).toHaveBeenCalledOnce();
  });

  it('calls onCommitReps on reps input blur', async () => {
    const onCommitReps = vi.fn();
    render(WmSetRow, props(makeSet(), { onCommitReps }));
    await fireEvent.blur(screen.getByLabelText('reps'));
    expect(onCommitReps).toHaveBeenCalledOnce();
  });
});
