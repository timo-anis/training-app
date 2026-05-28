<script lang="ts">
  import { currentUser, uiState, appState, currentDayExercises, copyPreviousDay, hasMvp1Data, runMvp1Import, searchOpen } from '../stores/app';
  import Calendar from './Calendar.svelte';
  import MonthCalendar from './MonthCalendar.svelte';
  import ExerciseCard from './ExerciseCard.svelte';
  import AddExercise from './AddExercise.svelte';
  import StatsView from './StatsView.svelte';
  import AccountSheet from './AccountSheet.svelte';

  let accountOpen = false;

  const DAY_SHORT: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };

  // Day progress — X/Y exercises done
  $: dayExDone = $currentDayExercises.filter(ex => {
    if (ex.recovery)     return ex.recoveryDone;
    if (ex.conditioning) return ex.conditioningDone === true;
    return ex.sets.length > 0 && ex.sets.every(s => s.done);
  }).length;
  $: dayExTotal = $currentDayExercises.length;
  $: dayAllDone = dayExTotal > 0 && dayExDone === dayExTotal;

  // Show copy button when current day is empty but prev week has same day
  $: hasPrevDay = $appState.weeks.some(
    w => w.week === $uiState.week - 1 && w.day === $uiState.day && w.exercises.length > 0
  );
  $: canCopyDay = $currentDayExercises.length === 0 && hasPrevDay;

  // Show MVP1 import banner when V2 has zero weeks and MVP1 data exists
  $: totalWeeks = $appState.weeks.filter(w => w.exercises.length > 0).length;
  $: showMigrateBanner = totalWeeks === 0 && $hasMvp1Data;

  let migrateStatus: 'idle' | 'done' | 'error' = 'idle';
  let statsOpen = false;

  const REST_DAYS = new Set(['Saturday', 'Sunday']);
  const RECOVERY_DAYS = new Set(['Wednesday']);

  $: emptyLabel = (() => {
    if (REST_DAYS.has($uiState.day)) return { title: 'Rest day', sub: 'Recover and recharge.' };
    if (RECOVERY_DAYS.has($uiState.day)) return { title: 'Active recovery', sub: 'Mobility, foam rolling, light movement.' };
    return { title: 'No training logged', sub: null };
  })();

  function handleMigrate() {
    const ok = runMvp1Import();
    migrateStatus = ok ? 'done' : 'error';
  }

</script>

<div class="main">
  <!-- Header -->
  <header class="topbar">
    <span class="title-text">Timo Training</span>
    <div class="topbar-actions">
      <button class="icon-btn" on:click={() => $searchOpen = true} title="Search exercises" aria-label="Search exercises">
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="9" cy="9" r="6"/>
          <line x1="14.2" y1="14.2" x2="18" y2="18"/>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => accountOpen = true} title="Account" aria-label="Account">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      </button>
    </div>
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

  <!-- Stats toggle -->
  <section class="section section-tight">
    <button class="stats-toggle" on:click={() => statsOpen = !statsOpen}>
      <span class="stats-toggle-label">Stats</span>
      <span class="stats-chevron" class:open={statsOpen}>›</span>
    </button>
  </section>
  {#if statsOpen}
    <StatsView />
  {/if}

  <!-- Exercise list -->
  <section class="section">
    <div class="day-heading">
      <span class="day-label">{$uiState.day}</span>
      <span class="day-sub">Week {$uiState.week}</span>
      {#if dayExTotal > 0}
        <span class="day-progress" class:all-done={dayAllDone}>
          {dayExDone}/{dayExTotal}
        </span>
      {/if}
    </div>

    {#if $currentDayExercises.length === 0}
      <div class="empty-state">
        <span class="empty-title">{emptyLabel.title}</span>
        {#if emptyLabel.sub}
          <span class="empty-sub">{emptyLabel.sub}</span>
        {/if}
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

{#if accountOpen}
  <AccountSheet on:close={() => accountOpen = false} />
{/if}

<style>
  .main {
    min-height: 100%;
    background: transparent;
    color: #e8f0ff;
    padding: 0 0 32px;
    max-width: 640px;
    margin: 0 auto;
  }

  /* ---- Topbar ---- */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 18px;
    padding-top: calc(11px + env(safe-area-inset-top));
    border-bottom: 1px solid rgba(60,90,165,0.16);
    position: sticky;
    top: 0;
    background: rgba(7,9,18,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 10;
    overflow: hidden;
  }

  .topbar::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, rgba(196,148,46,0.45) 15%, #c49230 50%, rgba(196,148,46,0.45) 85%, transparent 100%);
  }

  .title-text {
    font-size: 17px;
    font-weight: 900;
    color: #d4a038;
    letter-spacing: -0.03em;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .icon-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    border: 1px solid rgba(65,100,170,0.20);
    background: transparent;
    color: rgba(255,255,255,0.30);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .icon-btn:active {
    background: rgba(14,26,55,0.70);
    color: rgba(255,255,255,0.65);
  }

  /* ---- Sections ---- */
  .section {
    padding: 14px 14px 0;
  }

  .section-tight {
    padding-top: 8px;
  }

  /* ---- Stats toggle ---- */
  .stats-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 14px 12px 16px;
    border-radius: 14px;
    border: 1px solid rgba(196,148,46,0.28);
    background: rgba(13,24,52,0.70);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
    position: relative;
    overflow: hidden;
  }

  .stats-toggle::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: #c49230;
    border-radius: 3px 0 0 3px;
  }

  .stats-toggle:active { background: rgba(13,24,52,0.90); }

  .stats-toggle-label {
    font-size: 13px;
    font-weight: 800;
    color: rgba(255,255,255,0.80);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .stats-chevron {
    position: absolute;
    right: 14px;
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s;
    font-size: 16px;
    color: #c49230;
    line-height: 1;
  }

  .stats-chevron.open { transform: rotate(-90deg); }

  /* ---- Day heading ---- */
  .day-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .day-label {
    font-size: 20px;
    font-weight: 900;
    color: #e8f0ff;
    letter-spacing: -0.03em;
  }

  .day-sub {
    font-size: 13px;
    color: rgba(255,255,255,0.40);
    font-weight: 600;
    flex: 1;
  }

  .day-progress {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    background: rgba(14,26,55,0.70);
    border: 1px solid rgba(255,255,255,0.13);
    color: rgba(255,255,255,0.50);
    letter-spacing: 0.02em;
    flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }

  .day-progress.all-done {
    background: rgba(255,255,255,0.09);
    border-color: rgba(255,255,255,0.25);
    color: rgba(255,255,255,0.90);
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
    padding: 36px 20px;
    text-align: center;
    border: 1px dashed rgba(255,255,255,0.08);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: rgba(255,255,255,0.28);
    letter-spacing: -0.01em;
  }

  .empty-sub {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.16);
  }


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
    border: 1px solid rgba(196,148,46,0.22);
    background: rgba(196,148,46,0.07);
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
    color: #c49230;
    letter-spacing: -0.01em;
  }

  .migrate-sub {
    font-size: 11px;
    color: #7a6030;
  }

  .migrate-btn {
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid rgba(196,148,46,0.40);
    background: rgba(196,148,46,0.14);
    color: #c49230;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .migrate-btn:active { background: rgba(196,148,46,0.24); }

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
