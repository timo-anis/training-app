<script lang="ts">
  import type { WorkoutSet } from '../types/workout';
  // Presentational set-row editor (kg / reps inputs + step buttons, done toggle,
  // delete). The parent owns the kg/reps values (bound) and all actions.
  export let set: WorkoutSet;
  export let index: number;        // 0-based set index
  export let idBase: string;       // unique id base for input ids, e.g. `${exId}-${i}`
  export let kg: string;           // two-way bound to parent's local kg map
  export let reps: string;         // two-way bound to parent's local reps map
  export let flash = false;        // done-button flash highlight
  export let onCommitKg: () => void;
  export let onCommitReps: () => void;
  export let onAdjustKg: (delta: number) => void;
  export let onAdjustReps: (delta: number) => void;
  export let onDone: () => void;
  export let onDelete: () => void;
</script>

<div class="set-row" class:done={set.done}>
  <span class="set-n">{index + 1}</span>

  <div class="set-col">
    <label class="set-lbl" for="wm-kg-{idBase}">kg</label>
    <input
      id="wm-kg-{idBase}"
      class="set-inp"
      type="text"
      inputmode="decimal"
      bind:value={kg}
      on:blur={onCommitKg}
      on:keydown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}
      placeholder="—"
      autocomplete="off"
    />
    <div class="kg-adj">
      <button class="kg-adj-btn" on:click|stopPropagation={() => onAdjustKg(-2.5)}>−</button>
      <button class="kg-adj-btn" on:click|stopPropagation={() => onAdjustKg(2.5)}>+</button>
    </div>
  </div>

  <div class="set-col">
    <label class="set-lbl" for="wm-reps-{idBase}">reps</label>
    <input
      id="wm-reps-{idBase}"
      class="set-inp"
      type="text"
      inputmode="numeric"
      bind:value={reps}
      on:blur={onCommitReps}
      on:keydown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}
      placeholder="—"
      autocomplete="off"
    />
    <div class="kg-adj">
      <button class="kg-adj-btn" on:click|stopPropagation={() => onAdjustReps(-1)}>−</button>
      <button class="kg-adj-btn" on:click|stopPropagation={() => onAdjustReps(1)}>+</button>
    </div>
  </div>

  <button
    class="done-btn"
    class:on={set.done}
    class:flash={flash}
    on:click={onDone}
    aria-pressed={set.done}
    aria-label={set.done ? 'Undo set' : 'Mark set done'}
  >
    {set.done ? '✓' : '○'}
  </button>

  <button class="del-btn" on:click={onDelete} aria-label="Delete set">×</button>
</div>

<style>
.set-row {
  display: grid;
  grid-template-columns: 32px 1fr 1fr 62px 34px;
  align-items: center;
  gap: 7px;
  padding: 2px 0;
  border-radius: 14px;
  transition: background 0.15s;
}

.set-row.done { background: rgba(var(--c-fg), 0.03); }

.set-n {
  font-size: 16px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.35);
  text-align: center;
  user-select: none;
}

.set-row.done .set-n { color: rgba(var(--c-fg), 0.55); }

.set-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(var(--c-surface-b), 0.85);
  border: 1px solid rgba(var(--c-edge-e), 0.22);
  border-radius: 13px;
  padding: 11px 14px;
  min-height: 68px;
  justify-content: center;
}

.set-row.done .set-col {
  border-color: rgba(var(--c-fg), 0.14);
  background: rgba(var(--c-fg), 0.05);
}

.set-lbl {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(var(--c-fg), 0.38);
  user-select: none;
}

.set-inp {
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  font-size: 26px;
  font-weight: 800;
  color: var(--h-ffffff);
  letter-spacing: -0.02em;
  width: 100%;
  min-width: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.set-row.done .set-inp { color: rgba(var(--c-fg), 0.90); }
.set-inp::placeholder { color: rgba(var(--c-fg), 0.18); }
.set-inp:focus { color: var(--h-ffffff); }

.done-btn {
  height: 68px;
  border-radius: 13px;
  border: 1px solid var(--c-80-120-200-0_30);
  background: rgba(var(--c-surface-c), 0.65);
  color: rgba(var(--c-fg), 0.55);
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  -webkit-tap-highlight-color: transparent;
}

.done-btn.on {
  background: rgba(var(--c-fg), 0.10);
  border-color: rgba(var(--c-fg), 0.30);
  color: rgba(var(--c-fg), 0.92);
  font-weight: 700;
}

.done-btn:active { transform: scale(0.94); }

.done-btn.flash {
  background: rgba(var(--c-fg), 0.22) !important;
  border-color: rgba(var(--c-fg), 0.55) !important;
  transform: scale(0.93);
  transition: background 0.05s, transform 0.05s;
}

.del-btn {
  height: 32px;
  width: 32px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: rgba(var(--c-fg), 0.22);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}

.del-btn:active { background: var(--c-255-80-80-0_14); color: var(--h-ff6060); }

.kg-adj {
  display: flex;
  gap: 4px;
  margin-top: 5px;
}

.kg-adj-btn {
  flex: 1;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(var(--c-fg), 0.10);
  background: rgba(var(--c-fg), 0.04);
  color: rgba(var(--c-fg), 0.45);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s, color 0.1s;
  line-height: 1;
}

.kg-adj-btn:active { background: rgba(var(--c-accent), 0.18); color: var(--c-accent-solid); }
</style>
