<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { DAY_ORDER, emptyAppState, type AppState } from '../../types/workout';
  import {
    appState, uiState, currentDayExercises, weekOffset,
    goToAdjacentDay, updateUI, showToast, currentUser,
  } from '../../stores/app';
  import { loadTraineeState, relativeAge, type TraineeRow } from '../../services/coach';
  import MonthCalendar from '../MonthCalendar.svelte';
  import ExerciseCard from '../ExerciseCard.svelte';
  import CoachNote from '../CoachNote.svelte';
  import { setCoachNotesContext, clearCoachNotes, loadCoachNotesFor } from '../../stores/coachNotes';

  export let trainee: TraineeRow;

  let loading = true;
  let updatedAt: string | null = null;
  let now = Date.now();

  // Block index map — groups supersets as one block (A, B, C…). Same rule as MainView.
  $: blockIndices = (() => {
    const result: Record<string, number> = {};
    let blockIdx = -1;
    let lastGroupKey = '';
    for (const ex of $currentDayExercises) {
      const groupKey = (ex.type === 'superset' && ex.code) ? ex.code[0] : ex.id;
      if (groupKey !== lastGroupKey) { blockIdx++; lastGroupKey = groupKey; }
      result[ex.id] = blockIdx;
    }
    return result;
  })();

  function pickInitialDay(state: AppState) {
    const populated = state.weeks.filter((w) => w.exercises.length > 0);
    if (populated.length === 0) return;
    const weeks = [...new Set(populated.map((w) => w.week))].sort((a, b) => a - b);
    const wk = weeks[weeks.length - 1];
    const days = DAY_ORDER.filter((d) => populated.some((w) => w.week === wk && w.day === d));
    const day = days[days.length - 1] ?? $uiState.day;
    updateUI((u) => ({ ...u, week: wk, day }));
  }

  async function load() {
    loading = true;
    try {
      const res = await loadTraineeState(trainee.traineeId);
      const state = res.state ?? emptyAppState();
      appState.set(state);
      updatedAt = res.updatedAt;
      now = Date.now();
      pickInitialDay(state);
      const coachId = $currentUser?.id ?? null;
      setCoachNotesContext({ coachId, traineeId: trainee.traineeId, canEdit: !!coachId });
      try { await loadCoachNotesFor(trainee.traineeId); } catch { /* notes are optional */ }
    } catch {
      showToast('Could not load trainee data', 'error');
      appState.set(emptyAppState());
    } finally {
      loading = false;
    }
  }

  onMount(load);

  // Leave the shared store clean when the coach navigates away.
  onDestroy(() => { appState.set(emptyAppState()); clearCoachNotes(); });
</script>

<div class="trainee-view">
  <div class="tv-head">
    <div class="tv-id">
      <span class="tv-name">{trainee.email}</span>
      <span class="tv-fresh">
        {#if loading}Loading…{:else if updatedAt}Updated {relativeAge(updatedAt, now)} · read-only{:else}No cloud data yet{/if}
      </span>
    </div>
    <button class="tv-refresh" on:click={load} disabled={loading} aria-label="Refresh">↻</button>
  </div>

  {#if !loading}
    <section class="section">
      <MonthCalendar />
    </section>

    <section class="section">
      <div class="day-heading-row">
        <button class="day-nav-arrow" on:click={() => goToAdjacentDay(-1)} aria-label="Previous day">‹</button>
        <div class="day-heading">
          <span class="day-label">{$uiState.day}</span>
          <span class="day-week-num">Week {$uiState.week - $weekOffset}</span>
        </div>
        <button class="day-nav-arrow" on:click={() => goToAdjacentDay(1)} aria-label="Next day">›</button>
      </div>

      <CoachNote week={$uiState.week} day={$uiState.day} exerciseId={null} authoring={true} />

      {#if $currentDayExercises.length === 0}
        <div class="empty-state">
          <span class="empty-title">Nothing logged this day</span>
          <span class="empty-sub">Pick another day in the calendar above.</span>
        </div>
      {:else}
        <div class="exercise-list">
          {#each $currentDayExercises as exercise, i (exercise.id)}
            <ExerciseCard
              {exercise}
              week={$uiState.week}
              day={$uiState.day}
              index={i}
              blockIndex={blockIndices[exercise.id] ?? i}
              total={$currentDayExercises.length}
              readonly={true}
              coachAuthoring={true}
            />
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .trainee-view { padding-bottom: 24px; }

  .tv-head {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 14px 4px;
  }
  .tv-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 auto; }
  .tv-name {
    font-size: 18px; font-weight: 900; color: var(--c-text); letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .tv-fresh { font-size: 12px; color: rgba(var(--c-fg), 0.45); font-weight: 600; }
  .tv-refresh {
    flex: 0 0 auto; width: 34px; height: 34px; border-radius: 9px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: rgba(var(--c-surface-b), 0.55);
    color: rgba(var(--c-fg), 0.55); font-size: 16px; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .tv-refresh:disabled { opacity: 0.5; }

  .section { padding: 12px 14px 0; }

  .day-heading-row { display: flex; align-items: stretch; gap: 8px; }
  .day-nav-arrow {
    flex: 0 0 auto; width: 44px; border-radius: 14px;
    border: 1px solid rgba(var(--c-fg), 0.07);
    background: rgba(var(--c-surface-b), 0.50);
    color: var(--c-232-240-255-0_65, rgba(232,240,255,0.65));
    font-size: 20px; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .day-nav-arrow:active { background: rgba(var(--c-surface-b), 0.85); }
  .day-heading {
    flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    padding: 10px 12px; border-radius: 14px;
    border: 1px solid rgba(var(--c-fg), 0.07);
    background: rgba(var(--c-surface-b), 0.50);
  }
  .day-label { font-size: 20px; font-weight: 900; color: var(--c-text); letter-spacing: -0.03em; line-height: 1; }
  .day-week-num { font-size: 11px; font-weight: 600; color: rgba(var(--c-fg), 0.35); }

  .exercise-list { display: grid; gap: 10px; margin-top: 10px; }

  .empty-state {
    margin-top: 10px; padding: 32px 20px; text-align: center;
    border: 1px dashed rgba(var(--c-fg), 0.08); border-radius: 18px;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
  }
  .empty-title { font-size: 16px; font-weight: 700; color: rgba(var(--c-fg), 0.30); }
  .empty-sub { font-size: 13px; color: rgba(var(--c-fg), 0.45); }
</style>
