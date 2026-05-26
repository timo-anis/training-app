<script lang="ts">
  import { currentUser, uiState, appState, currentDayExercises, copyPreviousDay, hasMvp1Data, runMvp1Import } from '../stores/app';
  import { signOut } from '../services/auth';
  import Calendar from './Calendar.svelte';
  import MonthCalendar from './MonthCalendar.svelte';
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

  // Show MVP1 import banner when V2 has zero weeks and MVP1 data exists
  $: totalWeeks = $appState.weeks.filter(w => w.exercises.length > 0).length;
  $: showMigrateBanner = totalWeeks === 0 && $hasMvp1Data;

  let migrateStatus: 'idle' | 'done' | 'error' = 'idle';

  function handleMigrate() {
    const ok = runMvp1Import();
    migrateStatus = ok ? 'done' : 'error';
  }

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

  <!-- MVP1 migration banner -->
  {#if showMigrateBanner}
    <section class="section">
      <div class="migrate-banner">
        <span class="migrate-icon">📦</span>
        <div class="migrate-text">
          <span class="migrate-title">Import previous data</span>
          <span class="migrate-sub">Old app data found on this device</span>
        </div>
        {#if migrateStatus === 'done'}
          <span class="migrate-done">Imported ✓</span>
        {:else if migrateStatus === 'error'}
          <span class="migrate-err">Failed</span>
        {:else}
          <button class="migrate-btn" on:click={handleMigrate}>Import</button>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Monthly calendar -->
  <section class="section">
    <MonthCalendar />
  </section>

  <!-- Week strip + day picker -->
  <section class="section section-tight">
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
  </section>
</div>


<style>
  .main {
    min-height: 100%;
    background: #0c0c0e;
    color: #f0f0ee;
    padding: 0 0 32px;
    max-width: 640px;
    margin: 0 auto;
  }

  /* ---- Topbar ---- */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 14px;
    padding-top: calc(16px + env(safe-area-inset-top));
    border-bottom: 1px solid rgba(255,255,255,0.07);
    position: sticky;
    top: 0;
    background: #0c0c0e;
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
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.60);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .signout-btn:active { background: rgba(255,255,255,0.06); }

  /* ---- Sections ---- */
  .section {
    padding: 14px 14px 0;
  }

  .section-tight {
    padding-top: 8px;
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
    color: #f0f0ee;
    letter-spacing: -0.03em;
  }

  .day-sub {
    font-size: 13px;
    color: rgba(255,255,255,0.40);
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
    color: rgba(255,255,255,0.30);
    font-size: 14px;
    border: 1px dashed rgba(255,255,255,0.08);
    border-radius: 18px;
  }

  .empty-state p { margin: 0; }


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

  /* ---- Migration banner ---- */
  .migrate-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(255,194,71,0.22);
    background: rgba(255,194,71,0.07);
  }

  .migrate-icon { font-size: 20px; flex-shrink: 0; }

  .migrate-text {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .migrate-title {
    font-size: 13px;
    font-weight: 800;
    color: #ffc247;
    letter-spacing: -0.01em;
  }

  .migrate-sub {
    font-size: 11px;
    color: #7a6030;
  }

  .migrate-btn {
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid rgba(255,194,71,0.40);
    background: rgba(255,194,71,0.14);
    color: #ffc247;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .migrate-btn:active { background: rgba(255,194,71,0.24); }

  .migrate-done {
    font-size: 13px;
    font-weight: 700;
    color: #4fc08d;
    flex-shrink: 0;
  }

  .migrate-err {
    font-size: 13px;
    font-weight: 700;
    color: #ff6060;
    flex-shrink: 0;
  }
</style>
