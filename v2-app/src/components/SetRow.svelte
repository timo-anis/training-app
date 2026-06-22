<script lang="ts">
  import type { WorkoutSet, DayOfWeek } from '../types/workout';
  import { toggleSetDone, updateSetField, updateSetRpe, deleteSet, suggestRpeForSet, appState } from '../stores/app';
  import RpeControl from './RpeControl.svelte';

  export let set: WorkoutSet;
  export let index: number;
  export let week: number;
  export let day: DayOfWeek;
  export let exId: string;
  export let exName: string = '';
  /** Coach read-only view: show values, disable all editing. */
  export let readonly = false;

  $: displayIndex = index + 1;

  // Faint RPE pre-fill from this exercise's history (null = no suggestion).
  $: rpeSuggestion = suggestRpeForSet($appState, exName, week, day, set.kg, set.reps);

  // Local input values — sync from prop, commit on blur
  let kgLocal = set.kg;
  let repsLocal = set.reps;
  let flashing = false;

  $: kgLocal = set.kg;
  $: repsLocal = set.reps;

  function flashCommit() {
    flashing = true;
    setTimeout(() => { flashing = false; }, 160);
  }

  function onKgBlur() {
    if (readonly) return;
    const normalised = kgLocal.replace(',', '.').trim();
    kgLocal = normalised;
    updateSetField(week, day, exId, index, 'kg', normalised);
    flashCommit();
  }

  function onRepsBlur() {
    if (readonly) return;
    const normalised = repsLocal.trim();
    repsLocal = normalised;
    updateSetField(week, day, exId, index, 'reps', normalised);
    flashCommit();
  }

  function onKgKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLElement).blur();
  }

  function onRepsKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLElement).blur();
  }
</script>

<div class="setrow" class:is-done={set.done}>
  <span class="setn">{displayIndex}</span>

  <div class="setcol" class:flash={flashing}>
    <label class="k" for="kg-{exId}-{index}">kg</label>
    <input
      id="kg-{exId}-{index}"
      class="setinput"
      type="text"
      inputmode="decimal"
      bind:value={kgLocal}
      on:blur={onKgBlur}
      on:keydown={onKgKeydown}
      placeholder="—"
      autocomplete="off"
      readonly={readonly}
    />
  </div>

  <div class="setcol" class:flash={flashing}>
    <label class="k" for="reps-{exId}-{index}">reps</label>
    <input
      id="reps-{exId}-{index}"
      class="setinput"
      type="text"
      inputmode="numeric"
      bind:value={repsLocal}
      on:blur={onRepsBlur}
      on:keydown={onRepsKeydown}
      placeholder="—"
      autocomplete="off"
      readonly={readonly}
    />
  </div>

  <div class="donecell">
    <button
      class="donebtn"
      class:on={set.done}
      on:click={() => toggleSetDone(week, day, exId, index)}
      disabled={readonly}
      aria-label={set.done ? 'Mark set undone' : 'Mark set done'}
      aria-pressed={set.done}
    >
      {set.done ? '✓' : '○'}
    </button>
    <RpeControl
      value={set.rpe}
      suggestion={rpeSuggestion}
      onPick={(v) => updateSetRpe(week, day, exId, index, v)}
      onClear={() => updateSetRpe(week, day, exId, index, '')}
      {readonly}
    />
  </div>

  {#if !readonly}
    <button
      class="delbtn"
      on:click={() => deleteSet(week, day, exId, index)}
      aria-label="Delete set"
    >
      ×
    </button>
  {/if}
</div>

<style>
  .setrow {
    display: grid;
    grid-template-columns: 30px 1fr 1fr 46px 30px;
    align-items: center;
    gap: 7px;
    padding: 4px 0;
    border-radius: 11px;
    transition: background 0.15s;
  }

  .setrow.is-done { background: rgba(var(--c-fg), 0.03); border-radius: 10px; }

  .setn {
    font-size: 14px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.35);
    text-align: center;
    user-select: none;
  }

  .setrow.is-done .setn { color: rgba(var(--c-fg), 0.55); }

  .setcol {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: var(--c-14-26-55-0_70);
    border: 1px solid rgba(var(--c-edge-d), 0.20);
    border-radius: 11px;
    padding: 8px 12px;
  }

  .setrow.is-done .setcol {
    border-color: rgba(var(--c-fg), 0.14);
    background: rgba(var(--c-fg), 0.05);
  }

  .setcol.flash {
    border-color: rgba(var(--c-fg), 0.45);
    transition: border-color 0.05s ease;
  }

  .k {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(var(--c-fg), 0.35);
    cursor: default;
    user-select: none;
  }

  .setinput {
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    font-size: 19px;
    font-weight: 700;
    color: var(--h-d8eafc);
    letter-spacing: -0.02em;
    width: 100%;
    min-width: 0;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .setrow.is-done .setinput { color: rgba(var(--c-fg), 0.90); }

  .setinput::placeholder { color: rgba(var(--c-fg), 0.20); }

  .setinput:focus { color: var(--h-ffffff); }

  .donecell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: stretch;
  }

  .donebtn {
    height: 46px;
    border-radius: 11px;
    border: 1px solid rgba(var(--c-fg), 0.14);
    background: var(--c-12-22-48-0_55);
    color: rgba(var(--c-fg), 0.45);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .donebtn.on {
    background: rgba(var(--c-fg), 0.10);
    border-color: rgba(var(--c-fg), 0.30);
    color: rgba(var(--c-fg), 0.92);
    font-weight: 700;
  }

  .donebtn:active { transform: scale(0.96); }

  .delbtn {
    height: 30px;
    width: 30px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(var(--c-fg), 0.22);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .delbtn:active {
    background: var(--c-255-80-80-0_12);
    color: var(--h-ff6060);
  }
</style>
