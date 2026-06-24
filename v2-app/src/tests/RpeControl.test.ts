/**
 * Component tests for RpeControl.svelte
 *
 * RpeControl is ideal for component testing:
 * - No Svelte store imports (only RPE_OPTIONS constant)
 * - Communicates via props + callback props (onPick, onClear)
 * - Contains meaningful conditional rendering and user interactions
 */
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import RpeControl from '../components/RpeControl.svelte';

/** Find an RPE option button by its value (e.g. "8" matches "8 2 reps left"). */
function getRpeOption(value: string) {
  // RPE option buttons render "{value}\n{rir}" — use startsWith match.
  return screen.getByRole('button', { name: new RegExp(`^${value} `) });
}

describe('RpeControl', () => {
  describe('chip display states', () => {
    it('shows "RPE" label when no value and no suggestion', () => {
      render(RpeControl, { props: { value: '', suggestion: null } });
      expect(screen.getByRole('button', { name: /set rpe/i })).toBeInTheDocument();
      expect(screen.getByText('RPE')).toBeInTheDocument();
    });

    it('shows the rated value when value is set', () => {
      render(RpeControl, { props: { value: '8', suggestion: null } });
      expect(screen.getByRole('button', { name: /rpe 8/i })).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('shows suggestion with ≈ prefix when unrated but suggestion provided', () => {
      render(RpeControl, { props: { value: '', suggestion: 7 } });
      expect(screen.getByText('≈7')).toBeInTheDocument();
    });

    it('rated value takes priority over suggestion', () => {
      render(RpeControl, { props: { value: '9', suggestion: 7 } });
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.queryByText('≈7')).not.toBeInTheDocument();
    });
  });

  describe('picker interaction', () => {
    it('opens the picker sheet on chip click', async () => {
      render(RpeControl, { props: { value: '', suggestion: null } });
      await fireEvent.click(screen.getByRole('button', { name: /set rpe/i }));
      expect(screen.getByRole('dialog', { name: /rate of perceived exertion/i })).toBeInTheDocument();
      expect(screen.getByText('How hard did it feel?')).toBeInTheDocument();
    });

    it('calls onPick with the selected value and closes picker', async () => {
      const onPick = vi.fn();
      render(RpeControl, { props: { value: '', suggestion: null, onPick } });
      await fireEvent.click(screen.getByRole('button', { name: /set rpe/i }));
      await fireEvent.click(getRpeOption('8'));
      expect(onPick).toHaveBeenCalledWith('8');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onClear and closes picker when Clear is clicked (rated state)', async () => {
      const onClear = vi.fn();
      render(RpeControl, { props: { value: '7', suggestion: null, onClear } });
      await fireEvent.click(screen.getByRole('button', { name: /rpe 7/i }));
      const clearBtn = screen.getByRole('button', { name: /clear rating/i });
      expect(clearBtn).not.toBeDisabled();
      await fireEvent.click(clearBtn);
      expect(onClear).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Clear button is disabled when nothing is rated', async () => {
      render(RpeControl, { props: { value: '', suggestion: null } });
      await fireEvent.click(screen.getByRole('button', { name: /set rpe/i }));
      expect(screen.getByRole('button', { name: /clear rating/i })).toBeDisabled();
    });

    it('closes picker on backdrop click', async () => {
      render(RpeControl, { props: { value: '', suggestion: null } });
      await fireEvent.click(screen.getByRole('button', { name: /set rpe/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await fireEvent.click(document.querySelector('.rpe-backdrop')!);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders all 9 RPE options in the picker', async () => {
      render(RpeControl, { props: { value: '', suggestion: null } });
      await fireEvent.click(screen.getByRole('button', { name: /set rpe/i }));
      // Options: 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6
      const opts = document.querySelectorAll('.rpe-opt');
      expect(opts.length).toBe(9);
    });
  });

  describe('readonly mode', () => {
    it('chip button is disabled in readonly mode', () => {
      render(RpeControl, { props: { value: '8', suggestion: null, readonly: true } });
      expect(screen.getByRole('button', { name: /rpe 8/i })).toBeDisabled();
    });

    it('does not open picker when readonly', async () => {
      render(RpeControl, { props: { value: '', suggestion: null, readonly: true } });
      await fireEvent.click(screen.getByRole('button', { name: /set rpe/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
