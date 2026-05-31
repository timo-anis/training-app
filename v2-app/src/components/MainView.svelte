<script lang="ts">
  import { currentUser, uiState, appState, currentDayExercises, copyPreviousDay, hasMvp1Data, runMvp1Import, searchOpen, weekOffset, syncStatus, sheetOpen } from '../stores/app';
  import Calendar from './Calendar.svelte';
  import MonthCalendar from './MonthCalendar.svelte';
  import ExerciseCard from './ExerciseCard.svelte';
  import AddExercise from './AddExercise.svelte';
  import StatsView from './StatsView.svelte';
  import AccountSheet from './AccountSheet.svelte';

  let accountOpen = false;
  $: sheetOpen.set(accountOpen);

  const DAY_SHORT: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };

  // Block index map — groups supersets as one block (A, B, C...)
  $: blockIndices = (() => {
    const result: Record<string, number> = {};
    let blockIdx = -1;
    let lastGroupKey = '';
    for (const ex of $currentDayExercises) {
      const groupKey = (ex.type === 'superset' && ex.code) ? ex.code : ex.id;
      if (groupKey !== lastGroupKey) { blockIdx++; lastGroupKey = groupKey; }
      result[ex.id] = blockIdx;
    }
    return result;
  })();

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
  let exercisesExpanded = false;
  let hintsOpen = false;

  // Auto-expand exercise list when there's already progress today
  $: if (dayExDone > 0) exercisesExpanded = true;

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
      {#if $syncStatus === 'saving'}
        <span class="sync-dot saving" title="Saving…" aria-label="Saving"></span>
      {:else if $syncStatus === 'saved'}
        <span class="sync-dot saved" title="Saved" aria-label="Saved"></span>
      {:else if $syncStatus === 'error'}
        <span class="sync-dot error" title="Sync failed" aria-label="Sync failed"></span>
      {/if}
      <button class="icon-btn" on:click={() => hintsOpen = true} title="Quick guide" aria-label="Quick guide">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <circle cx="12" cy="17" r=".5" fill="currentColor"/>
        </svg>
      </button>
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

  <!-- Statistics button -->
  <section class="section section-tight">
    <button class="stats-btn" on:click={() => statsOpen = !statsOpen} aria-expanded={statsOpen}>
      <svg class="stats-btn-icon" width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/>
        <rect x="17" y="3" width="4" height="18"/>
      </svg>
      <span class="stats-btn-label">Statistics</span>
      <span class="stats-chevron" class:open={statsOpen}>›</span>
    </button>
  </section>
  {#if statsOpen}
    <StatsView />
  {/if}

  <!-- Day heading + exercise list (collapsed by default) -->
  <section class="section">
    <button class="day-heading-btn" on:click={() => exercisesExpanded = !exercisesExpanded}>
      <div class="day-heading">
        <span class="day-label">{$uiState.day}</span>
        <span class="day-sub">Week {$uiState.week - $weekOffset}</span>
        {#if dayExTotal > 0}
          <span class="day-progress" class:all-done={dayAllDone}>
            {dayExDone}/{dayExTotal}
          </span>
        {/if}
      </div>
      <span class="ex-chevron" class:open={exercisesExpanded}>›</span>
    </button>

    {#if exercisesExpanded}
      {#if $currentDayExercises.length === 0}
        <div class="empty-state">
          <span class="empty-title">{emptyLabel.title}</span>
          {#if emptyLabel.sub}
            <span class="empty-sub">{emptyLabel.sub}</span>
          {/if}
          {#if canCopyDay}
            <button class="copy-day-btn" on:click|stopPropagation={() => copyPreviousDay($uiState.week, $uiState.day)}>
              Copy from Week {$uiState.week - 1 - $weekOffset}
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
              blockIndex={blockIndices[exercise.id] ?? i}
              total={$currentDayExercises.length}
            />
          {/each}
        </div>
      {/if}

      <div class="add-ex-wrap">
        <AddExercise week={$uiState.week} day={$uiState.day} />
      </div>
    {/if}
  </section>
</div>

<!-- Hints overlay -->
{#if hintsOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="hints-backdrop" on:click={() => hintsOpen = false}>
    <div class="hints-sheet" on:click|stopPropagation>
      <div class="hints-header">
        <span class="hints-title">Quick guide</span>
        <button class="hints-close" on:click={() => hintsOpen = false}>✕</button>
      </div>
      <ol class="hints-list">
        <li><strong>Calendar</strong> — Tap any day to view or add exercises for that day</li>
        <li><strong>Training</strong> — Tap the day heading to expand → add exercises → tap <em>▶ Start Workout</em></li>
        <li><strong>Workout mode</strong> — Swipe left/right between exercises. Tap ○ to mark a set done</li>
        <li><strong>Rest timer</strong> — Starts automatically after each set. Quick presets: 1′ / 1:30 / 2′ / 2:30 / 3′</li>
        <li><strong>Session note</strong> — Tap <em>+ Session note</em> during workout to log how it felt</li>
        <li><strong>Statistics</strong> — Tap the Statistics button to see volume, weekly breakdown, and progress charts</li>
      </ol>
    </div>
  </div>
{/if}

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

  .sync-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    align-self: center;
  }

  .sync-dot.saving {
    background: rgba(196,148,46,0.80);
    animation: sync-pulse 0.8s ease-in-out infinite;
  }

  .sync-dot.saved { background: #4fc08d; }
  .sync-dot.error { background: #ff6060; }

  @keyframes sync-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }

  /* ---- Sections ---- */
  .section {
    padding: 14px 14px 0;
  }

  .section-tight {
    padding-top: 8px;
  }

  /* ---- Statistics button ---- */
  .stats-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 16px;
    border-radius: 14px;
    border: 1px solid rgba(196,148,46,0.22);
    background: rgba(13,24,52,0.70);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
    position: relative;
    overflow: hidden;
  }

  .stats-btn::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: #c49230;
  }

  .stats-btn:active { background: rgba(13,24,52,0.90); }

  .stats-btn-icon {
    color: rgba(196,148,46,0.70);
    flex-shrink: 0;
  }

  .stats-btn-label {
    flex: 1 1 0;
    font-size: 15px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    text-align: left;
  }

  .stats-chevron {
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s;
    font-size: 18px;
    color: rgba(196,148,46,0.60);
    line-height: 1;
    flex-shrink: 0;
  }

  .stats-chevron.open { transform: rotate(-90deg); }

  /* ---- Day heading toggle button ---- */
  .day-heading-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(13,24,52,0.50);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
    margin-bottom: 0;
  }

  .day-heading-btn:active { background: rgba(13,24,52,0.80); }

  .ex-chevron {
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s;
    font-size: 18px;
    color: rgba(255,255,255,0.30);
    line-height: 1;
    flex-shrink: 0;
    margin-left: auto;
  }

  .ex-chevron.open { transform: rotate(-90deg); color: rgba(255,255,255,0.55); }

  .exercise-list { margin-top: 10px; }

  /* ---- Day heading ---- */
  .day-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 0;
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

  /* ---- Exercise list spacing when expanded ---- */
  .exercise-list { margin-top: 10px; }
  .add-ex-wrap { margin-top: 10px; }
  .empty-state { margin-top: 10px; }

  /* ---- Floating hints button ---- */
  :global(.hints-fab) {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 44px;
    border-radius: 10px 0 0 10px;
    border: 1px solid rgba(255,255,255,0.10);
    border-right: none;
    background: rgba(13,24,52,0.80);
    color: rgba(255,255,255,0.30);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    transition: background 0.15s, color 0.15s;
  }

  :global(.hints-fab:active) {
    background: rgba(30,50,100,0.90);
    color: rgba(255,255,255,0.75);
  }

  /* Prominent when no workouts done yet */
  :global(.hints-fab-new) {
    background: rgba(196,148,46,0.18);
    border-color: rgba(196,148,46,0.35);
    color: #c49230;
    width: 32px;
    animation: hints-pulse 2.5s ease-in-out infinite;
  }

  @keyframes -global-hints-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.60; }
  }

  /* ---- Hints overlay ---- */
  :global(.hints-backdrop) {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 80;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fade-in 0.15s ease;
  }

  @keyframes -global-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  :global(.hints-sheet) {
    background: rgba(10,18,42,0.98);
    border: 1px solid rgba(60,90,165,0.25);
    border-radius: 20px 20px 0 0;
    padding: 20px 20px 36px;
    width: 100%;
    max-width: 640px;
    animation: slide-up 0.20s ease;
  }

  @keyframes -global-slide-up {
    from { transform: translateY(40px); opacity: 0.5; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  :global(.hints-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  :global(.hints-title) {
    font-size: 16px;
    font-weight: 900;
    color: #c49230;
    letter-spacing: -0.02em;
  }

  :global(.hints-close) {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.10);
    background: transparent;
    color: rgba(255,255,255,0.40);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  }

  :global(.hints-list) {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    counter-reset: hints;
  }

  :global(.hints-list li) {
    counter-increment: hints;
    display: flex;
    gap: 12px;
    font-size: 13.5px;
    color: rgba(255,255,255,0.75);
    line-height: 1.45;
  }

  :global(.hints-list li::before) {
    content: counter(hints);
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(196,148,46,0.15);
    border: 1px solid rgba(196,148,46,0.30);
    color: #c49230;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  :global(.hints-list strong) { color: rgba(255,255,255,0.92); }
  :global(.hints-list em) {
    color: #c49230;
    font-style: normal;
    font-weight: 700;
  }
</style>
