<script lang="ts">
  import type { WorkoutSet, DayOfWeek } from '../types/workout';
  import { toggleSetDone } from '../stores/app';

  export let set: WorkoutSet;
  export let index: number;
  export let week: number;
  export let day: DayOfWeek;
  export let exId: string;

  $: displayIndex = index + 1;
</script>

<div class="setrow" class:is-done={set.done} data-done={set.done ? '1' : ''}>
  <span class="setn">{displayIndex}</span>

  <div class="setcol">
    <span class="k">kg</span>
    <span class="v">{set.kg || '—'}</span>
  </div>

  <div class="setcol">
    <span class="k">reps</span>
    <span class="v">{set.reps || '—'}</span>
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
    padding: 8px 4px;
    border-radius: 10px;
    transition: background 0.15s;
  }

  .setrow.is-done {
    background: rgba(79,192,141,0.05);
  }

  .setn {
    font-size: 12px;
    font-weight: 700;
    color: #4a6a8a;
    text-align: center;
  }

  .setrow.is-done .setn { color: rgba(79,192,141,0.6); }

  .setcol {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 6px 10px;
  }

  .setrow.is-done .setcol {
    border-color: rgba(79,192,141,0.15);
    background: rgba(79,192,141,0.05);
  }

  .k {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #4a6a8a;
  }

  .v {
    font-size: 15px;
    font-weight: 700;
    color: #d8eafc;
    letter-spacing: -0.01em;
  }

  .setrow.is-done .v { color: rgba(79,192,141,0.85); }

  .donebtn {
    height: 36px;
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
  }

  .donebtn.on {
    background: rgba(79,192,141,0.13);
    border-color: rgba(79,192,141,0.45);
    color: #4fc08d;
    font-weight: 700;
  }
</style>
