<script lang="ts">
  import { currentUser, uiState, appState, currentDayExercises, startWorkout, copyPreviousDay } from '../stores/app';
  import { signOut } from '../services/auth';
  import Calendar from './Calendar.svelte';
  import ExerciseCard from './ExerciseCard.svelte';
  import AddExercise from './AddExercise.svelte';

  const DAY_SHORT: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };

  // Show copy button when current day is empty but prev week has same day
  $: hasPrevDay = $appState.weeks.some(
    w => w.week === $uiState.week - 1 && w.day === $uiState.day && w.exercises.length > 0
  );
  $: canCopyDay = $currentDayExercises.length === 0 && hasPrevDay;
</script>

<div class="main">
  <!-- Header -->
  <header class="topbar">
    <div class="topbar-title">
      <span class="title-text">Timo Training</span>
      <span class="v2-badge">V2</span>
    </div>
    <button class="signout-btn" on:click={signOut}>Sign out</button>
  </header>

  <!-- Calendar -->
  <section class="section">
    <Calendar />
  </section>

  <!-- Exercise list -->
  <section class="section">
    <div class="day-heading">
      <span class="day-label">{DAY_SHORT[$uiState.day] ?? $uiState.day}</span>
      <span class="day-sub">Week {$uiState.week}</span>
    </div>

    {#if $currentDayExercises.length === 0}
      <div class="empty-state">
        <p>No exercises logged for this day.</p>
        {#if canCopyDay}
          <button class="copy-day-btn" on:click={() => copyPreviousDay($uiState.week, $uiState.day)}>
            Copy from Week {$uiState.week - 1}
          </button>
        {/if}
      </div>
    {:else}
      <div class="exercise-list">
        {#each $currentDayExercises as exercise, i (exercise.id)}
          <ExerciseCard
            {exercise}
            week={$uiState.week}
            day={$uiState.day}
            index={i}
            total={$currentDayExercises.length}
          />
        {/each}
      </div>
    {/if}

    <div class="add-ex-wrap">
      <AddExercise week={$uiState.week} day={$uiState.day} />
    </div>

    {#if $currentDayExercises.length > 0}
      <button class="start-workout-btn" on:click={startWorkout}>
        Start Workout
      </button>
    {/if}
  </section>
</div>

<style>
  .main {
    min-height: 100dvh;
    background: #08172d;
    color: #f0f6ff;
    padding: 0 0 80px;
    max-width: 640px;
    margin: 0 auto;
  }

  /* ---- Topbar ---- */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: sticky;
    top: 0;
    background: #08172d;
    z-index: 10;
  }

  .topbar-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-text {
    font-size: 18px;
    font-weight: 900;
    color: #f0f6ff;
    letter-spacing: -0.03em;
  }

  .v2-badge {
    font-size: 10px;
    font-weight: 900;
    color: #ffc247;
    background: rgba(255,194,71,0.12);
    border: 1px solid rgba(255,194,71,0.28);
    border-radius: 6px;
    padding: 2px 7px;
    letter-spacing: 0.06em;
  }

  .signout-btn {
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: transparent;
    color: #7fa8d4;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .signout-btn:active { background: rgba(255,255,255,0.06); }

  /* ---- Sections ---- */
  .section {
    padding: 14px 14px 0;
  }

  /* ---- Day heading ---- */
  .day-heading {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 12px;
  }

  .day-label {
    font-size: 20px;
    font-weight: 900;
    color: #e8f2ff;
    letter-spacing: -0.03em;
  }

  .day-sub {
    font-size: 13px;
    color: #4a6a8a;
    font-weight: 600;
  }

  /* ---- Exercise list ---- */
  .exercise-list {
    display: grid;
    gap: 10px;
  }

  /* ---- Add exercise wrapper ---- */
  .add-ex-wrap {
    margin-top: 10px;
  }

  /* ---- Empty state ---- */
  .empty-state {
    padding: 32px 20px;
    text-align: center;
    color: #3a5a7a;
    font-size: 14px;
    border: 1px dashed rgba(255,255,255,0.07);
    border-radius: 18px;
  }

  .empty-state p { margin: 0; }

  /* ---- Start workout button ---- */
  .start-workout-btn {
    width: 100%;
    margin-top: 14px;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid rgba(255,194,71,0.35);
    background: rgba(255,194,71,0.12);
    color: #ffc247;
    font-size: 16px;
    font-weight: 900;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .start-workout-btn:active { background: rgba(255,194,71,0.22); }

  .copy-day-btn {
    margin-top: 12px;
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(127,178,255,0.22);
    background: rgba(127,178,255,0.07);
    color: #7fb2ff;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .copy-day-btn:active { background: rgba(127,178,255,0.15); }
</style>
