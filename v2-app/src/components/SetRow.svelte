<script lang="ts">
  import type { WorkoutSet, DayOfWeek } from '../types/workout';
  import { toggleSetDone, updateSetField } from '../stores/app';

  export let set: WorkoutSet;
  export let index: number;
  export let week: number;
  export let day: DayOfWeek;
  export let exId: string;

  $: displayIndex = index + 1;

  // Local input values — sync from prop, commit on blur
  let kgLocal = set.kg;
  let repsLocal = set.reps;

  $: kgLocal = set.kg;
  $: repsLocal = set.reps;

  function onKgBlur() {
    const normalised = kgLocal.replace(',', '.').trim();
    kgLocal = normalised;
    updateSetField(week, day, exId, index, 'kg', normalised);
  }

  function onRepsBlur() {
    const normalised = repsLocal.trim();
    repsLocal = normalised;
    updateSetField(week, day, exId, index, 'reps', normalised);
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

  <div class="setcol">
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
    />
  </div>

  <div class="setcol">
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
    />
  </div>

  <button
    class="donebtn"
    class:on={set.done}
    on:click={() => toggleSetDone(week, day, exId, index)}
    aria-label={set.done ? 'Mark set undone' : 'Mark set done'}
    aria-pressed={set.done}
  >
    {set.done ? '✓' : '○'}
  </button>
</div>

<style>
  .setrow {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 44px;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    border-radius: 10px;
    transition: background 0.15s;
  }

  .setrow.is-done { background: rgba(79,192,141,0.04); border-radius: 10px; }

  .setn {
    font-size: 12px;
    font-weight: 700;
    color: #4a6a8a;
    text-align: center;
    user-select: none;
  }

  .setrow.is-done .setn { color: rgba(79,192,141,0.55); }

  .setcol {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 6px 10px;
  }

  .setrow.is-done .setcol {
    border-color: rgba(79,192,141,0.15);
    background: rgba(79,192,141,0.05);
  }

  .k {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #3a5a7a;
    cursor: default;
    user-select: none;
  }

  .setinput {
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    font-size: 16px;
    font-weight: 700;
    color: #d8eafc;
    letter-spacing: -0.01em;
    width: 100%;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  .setrow.is-done .setinput { color: rgba(79,192,141,0.85); }

  .setinput::placeholder { color: #2a4a6a; }

  .setinput:focus { color: #ffffff; }

  .donebtn {
    height: 40px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.03);
    color: #4a6a8a;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .donebtn.on {
    background: rgba(79,192,141,0.13);
    border-color: rgba(79,192,141,0.45);
    color: #4fc08d;
    font-weight: 700;
  }

  .donebtn:active { transform: scale(0.96); }
</style>
