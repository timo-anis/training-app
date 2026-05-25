<script lang="ts">
  import type { Exercise, DayOfWeek } from '../types/workout';
  import SetRow from './SetRow.svelte';

  export let exercise: Exercise;
  export let week: number;
  export let day: DayOfWeek;

  $: doneCount = exercise.sets.filter(s => s.done).length;
  $: totalCount = exercise.sets.length;
  $: allDone = doneCount === totalCount && totalCount > 0;
  $: supersetLabel = exercise.type === 'superset' ? exercise.code : '';
</script>

<div class="exercise-card" class:all-done={allDone}>
  <div class="exercise-header">
    {#if supersetLabel}
      <span class="superset-badge">{supersetLabel}</span>
    {/if}
    <div class="exercise-meta">
      <span class="exercise-name">{exercise.name}</span>
      <span class="exercise-type">{exercise.type === 'superset' ? 'Superset' : 'Weighted'}</span>
    </div>
    {#if totalCount > 0}
      <span class="progress-chip" class:complete={allDone}>
        {doneCount}/{totalCount}
      </span>
    {/if}
  </div>

  {#if !exercise.recovery}
    <div class="sets-list">
      {#each exercise.sets as set, i}
        <SetRow {set} index={i} {week} {day} exId={exercise.id} />
      {/each}
    </div>
  {:else}
    <div class="recovery-row">
      <span class="recovery-label">Recovery block</span>
      <span class="recovery-status">{exercise.recoveryDone ? 'Done ✓' : 'Not done'}</span>
    </div>
  {/if}

  {#if exercise.rest}
    <div class="meta-row">
      <span class="meta-label">Rest</span>
      <span class="meta-value">{exercise.rest}</span>
    </div>
  {/if}

  {#if exercise.note}
    <div class="meta-row note">
      <span class="meta-label">Note</span>
      <span class="meta-value">{exercise.note}</span>
    </div>
  {/if}
</div>

<style>
  .exercise-card {
    background: linear-gradient(180deg, #0f1c30, #0b1726);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 16px 14px;
    display: grid;
    gap: 12px;
    transition: border-color 0.2s;
  }

  .exercise-card.all-done {
    border-color: rgba(79,192,141,0.25);
  }

  .exercise-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .superset-badge {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(127,178,255,0.12);
    border: 1px solid rgba(127,178,255,0.25);
    color: #7fb2ff;
    font-size: 12px;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0;
  }

  .exercise-meta {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .exercise-name {
    font-size: 15px;
    font-weight: 800;
    color: #e8f2ff;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .exercise-type {
    font-size: 11px;
    font-weight: 600;
    color: #4a6a8a;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .progress-chip {
    flex: 0 0 auto;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    color: #7fa8d4;
  }

  .progress-chip.complete {
    background: rgba(79,192,141,0.12);
    border-color: rgba(79,192,141,0.30);
    color: #4fc08d;
  }

  .sets-list {
    display: grid;
    gap: 4px;
  }

  .meta-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .meta-row.note { align-items: flex-start; }

  .meta-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #3a5a7a;
    flex: 0 0 38px;
  }

  .meta-value {
    font-size: 13px;
    font-weight: 600;
    color: #7fa8d4;
  }

  .recovery-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .recovery-label { font-size: 13px; color: #7fa8d4; }
  .recovery-status { font-size: 13px; font-weight: 700; color: #4fc08d; }
</style>
