<script lang="ts">
  import { currentUser, uiState, appState, currentDayExercises, copyPreviousDay, hasMvp1Data, runMvp1Import, searchOpen, weekOffset, syncStatus, sheetOpen, requestOnboarding, setDayKind, goToAdjacentDay, goToToday, todayWeekDay, showToast } from '../stores/app';
  import type { DayKind } from '../types/workout';
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
      const groupKey = (ex.type === 'superset' && ex.code) ? ex.code[0] : ex.id;
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
  $: isNewUser = totalWeeks === 0;
  $: showMigrateBanner = totalWeeks === 0 && $hasMvp1Data;

  let migrateStatus: 'idle' | 'done' | 'error' = 'idle';
  let statsOpen = false;
  let exercisesExpanded = false;
  let hintsOpen = false;

  // Auto-expand exercise list when there's already progress today
  $: if (dayExDone > 0) exercisesExpanded = true;

  // Current day's user-set type (workout / recovery / rest). Undefined = unmarked.
  $: currentDay = $appState.weeks.find(w => w.week === $uiState.week && w.day === $uiState.day);
  $: currentDayKind = currentDay?.kind ?? null;

  // Empty-state copy is driven by the day's mark, not the weekday.
  $: emptyLabel = (() => {
    if (currentDayKind === 'rest') return { title: 'Rest day', sub: 'Recover and recharge.' };
    if (currentDayKind === 'recovery') return { title: 'Active recovery', sub: 'Mobility, foam rolling, light movement.' };
    return { title: 'No workout yet', sub: 'Add your first exercise to start building today.' };
  })();

  let adder: AddExercise;
  function startFirstExercise() {
    exercisesExpanded = true;
    // wait for the adder to render, open it, and scroll it into view
    setTimeout(() => {
      adder?.openNow?.();
      document.querySelector('.add-ex-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 40);
  }

  // Today highlight for the day-header Today button
  $: _today = todayWeekDay();
  $: onToday = !!_today && _today.week === $uiState.week && _today.day === $uiState.day;

  function markDay(k: DayKind, label: string) {
    const turningOff = currentDayKind === k;
    setDayKind($uiState.week, $uiState.day, turningOff ? null : k);
    showToast(turningOff ? `${$uiState.day}: mark cleared` : `${$uiState.day} → ${label}`, 'success');
  }

  const DAY_KINDS: { k: DayKind; label: string }[] = [
    { k: 'workout', label: 'Workout' },
    { k: 'recovery', label: 'Recovery' },
    { k: 'rest', label: 'Rest' },
  ];

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

  <!-- New-user welcome (top, prominent) -->
  {#if isNewUser}
    <section class="section">
      <div class="welcome-card">
        <div class="welcome-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
            <rect x="6" y="18" width="6" height="8" rx="2" fill="var(--h-c49230)"/>
            <rect x="12" y="15" width="5" height="14" rx="2" fill="var(--h-c49230)"/>
            <rect x="17" y="20" width="10" height="4" rx="2" fill="var(--h-c49230)"/>
            <rect x="27" y="15" width="5" height="14" rx="2" fill="var(--h-c49230)"/>
            <rect x="32" y="18" width="6" height="8" rx="2" fill="var(--h-c49230)"/>
          </svg>
        </div>
        <span class="welcome-title">Welcome — let’s start training</span>
        <span class="welcome-sub">Plan your week in the calendar and log your first workout.</span>
        <div class="welcome-actions">
          <button class="welcome-primary" on:click={startFirstExercise}>+ Add first exercise</button>
          <button class="welcome-secondary" on:click={() => requestOnboarding.set(true)}>How it works</button>
        </div>
      </div>
    </section>
  {/if}

  <!-- Monthly calendar -->
  <section class="section">
    <MonthCalendar />
  </section>

  <!-- Day heading + exercise list (collapsed by default) -->
  <section class="section">
    <div class="day-heading-row">
      <button class="day-nav-arrow" on:click={() => goToAdjacentDay(-1)} aria-label="Previous day">‹</button>
      <button class="day-heading-btn" on:click={() => exercisesExpanded = !exercisesExpanded}>
        <div class="day-heading">
          <div class="day-heading-main">
            <span class="day-label">{$uiState.day}</span>
            <span class="day-week-num">Week {$uiState.week - $weekOffset}</span>
          </div>
          {#if dayExTotal > 0}
            <span class="day-progress" class:all-done={dayAllDone}>
              {dayExDone}/{dayExTotal}
            </span>
          {/if}
        </div>
        {#if $currentDayExercises.length > 0}<span class="ex-chevron" class:open={exercisesExpanded}>›</span>{/if}
      </button>
      <button class="day-nav-arrow" on:click={() => goToAdjacentDay(1)} aria-label="Next day">›</button>
    </div>
    {#if !onToday}
      <button class="today-day-btn" on:click={goToToday}>Today</button>
    {/if}

    <div class="day-kind-seg" role="group" aria-label="Day type">
      {#each DAY_KINDS as { k, label }}
        <button
          class="seg-btn seg-{k}"
          class:active={currentDayKind === k}
          on:click={() => markDay(k, label)}
        >{label}</button>
      {/each}
    </div>

    {#if $currentDayExercises.length === 0}
      <div class="empty-state">
        <span class="empty-title">{emptyLabel.title}</span>
        {#if emptyLabel.sub}
          <span class="empty-sub">{emptyLabel.sub}</span>
        {/if}
        {#if currentDayKind !== 'rest'}
          <button class="add-first-btn" on:click|stopPropagation={startFirstExercise}>
            + Add first exercise
          </button>
        {/if}
        {#if canCopyDay}
          <button class="copy-day-btn" on:click|stopPropagation={() => copyPreviousDay($uiState.week, $uiState.day)}>
            Copy from Week {$uiState.week - 1 - $weekOffset}
          </button>
        {/if}
      </div>
    {:else if exercisesExpanded}
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

    {#if exercisesExpanded}
      <div class="add-ex-wrap">
        <AddExercise bind:this={adder} week={$uiState.week} day={$uiState.day} />
      </div>
    {/if}
  </section>

  <!-- Statistics button -->
  <section class="section section-tight">
    <button class="stats-btn" on:click={() => statsOpen = !statsOpen} aria-expanded={statsOpen}>
      <svg class="stats-btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"
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
      <div class="hints-grid">
        <div class="hint-card">
          <div class="hint-header"><span class="hint-num">1</span><span class="hint-title">Calendar</span></div>
          <p class="hint-desc">Tap any day to view or add exercises for that day</p>
        </div>
        <div class="hint-card">
          <div class="hint-header"><span class="hint-num">2</span><span class="hint-title">Rest timer</span></div>
          <p class="hint-desc">Auto-starts after each set, or set it manually: ＋/－ adjusts in 15s steps, then tap Start. Presets: 1′ / 1:30 / 2′ / 3′</p>
        </div>
        <div class="hint-card">
          <div class="hint-header"><span class="hint-num">3</span><span class="hint-title">Session note</span></div>
          <p class="hint-desc">Tap <em>+ Session note</em> during workout to log how it felt</p>
        </div>
        <div class="hint-card">
          <div class="hint-header"><span class="hint-num">4</span><span class="hint-title">Statistics</span></div>
          <p class="hint-desc">Tap Statistics to see volume, weekly breakdown and progress charts</p>
        </div>
        <div class="hint-card">
          <div class="hint-header"><span class="hint-num">5</span><span class="hint-title">Training</span></div>
          <p class="hint-desc">Expand day → add exercises → tap <em>▶ Start Workout</em></p>
        </div>
        <div class="hint-card">
          <div class="hint-header"><span class="hint-num">6</span><span class="hint-title">Workout mode</span></div>
          <p class="hint-desc">Swipe left/right between exercises. Tap ○ to mark a set done</p>
        </div>
      </div>
      <button class="hints-walkthrough" on:click={() => { hintsOpen = false; requestOnboarding.set(true); }}>
        ▶ Ava tutvustus uuesti
      </button>
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
    color: var(--h-e8f0ff);
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
    border-bottom: 1px solid rgba(var(--c-blue-b), 0.16);
    position: sticky;
    top: 0;
    background: var(--c-7-9-18-0_92);
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
    background: linear-gradient(90deg, transparent 0%, rgba(var(--c-gold), 0.45) 15%, var(--h-c49230) 50%, rgba(var(--c-gold), 0.45) 85%, transparent 100%);
  }

  .title-text {
    font-size: 17px;
    font-weight: 900;
    color: var(--h-d4a038);
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
    border: 1px solid rgba(var(--c-blue-c), 0.20);
    background: transparent;
    color: rgba(var(--c-w), 0.30);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .icon-btn:active {
    background: var(--c-14-26-55-0_70);
    color: rgba(var(--c-w), 0.65);
  }

  .sync-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    align-self: center;
  }

  .sync-dot.saving {
    background: rgba(var(--c-gold), 0.80);
    animation: sync-pulse 0.8s ease-in-out infinite;
  }

  .sync-dot.saved { background: var(--h-4fc08d); }
  .sync-dot.error { background: var(--h-ff6060); }

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
    justify-content: center;
    gap: 10px;
    padding: 16px 20px;
    border-radius: 16px;
    border: 1px solid rgba(var(--c-gold), 0.35);
    background: rgba(var(--c-ink-b), 0.80);
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
    background: var(--h-c49230);
  }

  .stats-btn:active { background: rgba(var(--c-ink-b), 0.90); }

  .stats-btn-icon {
    color: rgba(var(--c-gold), 0.85);
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .stats-btn-label {
    font-size: 16px;
    font-weight: 700;
    color: rgba(var(--c-w), 0.90);
    text-align: center;
  }

  .stats-chevron {
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s;
    font-size: 18px;
    color: rgba(var(--c-gold), 0.60);
    line-height: 1;
    flex-shrink: 0;
  }

  .stats-chevron.open { transform: rotate(-90deg); }

  /* ---- Day heading toggle button ---- */
  .day-heading-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }

  .day-nav-arrow {
    flex: 0 0 auto;
    width: 44px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-w), 0.07);
    background: rgba(var(--c-ink-b), 0.50);
    color: var(--c-232-240-255-0_65);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .day-nav-arrow:active { background: rgba(var(--c-ink-b), 0.85); }

  .today-day-btn {
    margin: 8px auto 0;
    display: block;
    padding: 6px 16px;
    border-radius: 999px;
    border: 1px solid rgba(var(--c-gold), 0.45);
    background: rgba(var(--c-gold), 0.12);
    color: var(--h-d4a038);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.02em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .today-day-btn:active { background: rgba(var(--c-gold), 0.22); }

  .day-heading-btn {
    width: 100%;
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-w), 0.07);
    background: rgba(var(--c-ink-b), 0.50);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
    margin-bottom: 0;
  }

  .day-heading-btn:active { background: rgba(var(--c-ink-b), 0.80); }

  .ex-chevron {
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s;
    font-size: 18px;
    color: rgba(var(--c-w), 0.30);
    line-height: 1;
    flex-shrink: 0;
    margin-left: auto;
  }

  .ex-chevron.open { transform: rotate(-90deg); color: rgba(var(--c-w), 0.55); }

  .exercise-list { margin-top: 10px; }

  /* ---- Day heading ---- */
  .day-heading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex: 1 1 0;
  }

  .day-heading-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .day-label {
    font-size: 20px;
    font-weight: 900;
    color: var(--h-e8f0ff);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .day-week-num {
    font-size: 11px;
    font-weight: 600;
    color: rgba(var(--c-w), 0.35);
    letter-spacing: 0.02em;
  }

  .day-progress {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    background: var(--c-14-26-55-0_70);
    border: 1px solid rgba(var(--c-w), 0.13);
    color: rgba(var(--c-w), 0.50);
    letter-spacing: 0.02em;
    flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }

  .day-progress.all-done {
    background: rgba(var(--c-w), 0.09);
    border-color: rgba(var(--c-w), 0.25);
    color: rgba(var(--c-w), 0.90);
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

  /* ---- Day type segment ---- */
  .day-kind-seg {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }

  .seg-btn {
    flex: 1;
    padding: 9px 4px;
    border-radius: 10px;
    border: 1px solid rgba(var(--c-blue-b), 0.16);
    background: rgba(var(--c-ink-b), 0.55);
    color: var(--c-232-240-255-0_55);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .seg-btn:active { transform: scale(0.98); }

  /* Active state colour matches the calendar cell for that type */
  .seg-workout.active {
    background: var(--c-100-155-255-0_16);
    border-color: var(--c-100-155-255-0_45);
    color: var(--h-9bc0ff);
  }
  .seg-recovery.active {
    background: rgba(var(--c-gold), 0.16);
    border-color: rgba(var(--c-gold), 0.45);
    color: var(--h-d4a038);
  }
  .seg-rest.active {
    background: var(--c-150-140-212-0_20);
    border-color: var(--c-150-140-212-0_50);
    color: var(--h-b8aee8);
  }

  .add-first-btn {
    margin-top: 14px;
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-gold), 0.45);
    background: rgba(var(--c-gold), 0.14);
    color: var(--h-d4a038);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
  }

  .add-first-btn:active { background: rgba(var(--c-gold), 0.24); transform: scale(0.98); }

  /* ---- Empty state ---- */
  .empty-state {
    padding: 36px 20px;
    text-align: center;
    border: 1px dashed rgba(var(--c-w), 0.08);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: rgba(var(--c-w), 0.28);
    letter-spacing: -0.01em;
  }

  .empty-sub {
    font-size: 13px;
    font-weight: 500;
    color: rgba(var(--c-w), 0.45);
  }

  /* ---- New-user welcome card (top) ---- */
  .welcome-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    padding: 24px 20px;
    border-radius: 18px;
    border: 1px solid rgba(var(--c-gold), 0.35);
    background: rgba(var(--c-gold), 0.07);
  }
  .welcome-icon { margin-bottom: 4px; }
  .welcome-title { font-size: 18px; font-weight: 900; color: var(--h-ffffff); letter-spacing: -0.01em; }
  .welcome-sub { font-size: 13px; font-weight: 500; color: rgba(var(--c-w), 0.55); max-width: 300px; line-height: 1.5; }
  .welcome-actions { display: flex; gap: 10px; margin-top: 14px; width: 100%; max-width: 360px; }
  .welcome-primary {
    flex: 1;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-gold), 0.55);
    background: rgba(var(--c-gold), 0.18);
    color: var(--h-d4a038);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
  }
  .welcome-primary:active { background: rgba(var(--c-gold), 0.28); transform: scale(0.98); }
  .welcome-secondary {
    flex: 0 0 auto;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-w), 0.16);
    background: rgba(var(--c-w), 0.05);
    color: var(--h-e8f0ff);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }
  .welcome-secondary:active { background: rgba(var(--c-w), 0.12); }


  .copy-day-btn {
    margin-top: 12px;
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--c-127-178-255-0_22);
    background: var(--c-127-178-255-0_07);
    color: var(--h-e8f0ff);
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .copy-day-btn:active { background: var(--c-127-178-255-0_15); }

  /* ---- Migration banner ---- */
  .migrate-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(var(--c-gold), 0.22);
    background: rgba(var(--c-gold), 0.07);
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
    color: var(--h-c49230);
    letter-spacing: -0.01em;
  }

  .migrate-sub {
    font-size: 11px;
    color: var(--h-7a6030);
  }

  .migrate-btn {
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid rgba(var(--c-gold), 0.40);
    background: rgba(var(--c-gold), 0.14);
    color: var(--h-c49230);
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .migrate-btn:active { background: rgba(var(--c-gold), 0.24); }

  .migrate-done {
    font-size: 13px;
    font-weight: 700;
    color: var(--h-4fc08d);
    flex-shrink: 0;
  }

  .migrate-err {
    font-size: 13px;
    font-weight: 700;
    color: var(--h-ff6060);
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
    border: 1px solid rgba(var(--c-w), 0.10);
    border-right: none;
    background: rgba(var(--c-ink-b), 0.80);
    color: rgba(var(--c-w), 0.30);
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
    background: var(--c-30-50-100-0_90);
    color: rgba(var(--c-w), 0.75);
  }

  /* Prominent when no workouts done yet */
  :global(.hints-fab-new) {
    background: rgba(var(--c-gold), 0.18);
    border-color: rgba(var(--c-gold), 0.35);
    color: var(--h-c49230);
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
    background: rgba(var(--c-black), 0.55);
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
    background: var(--c-10-18-42-0_98);
    border: 1px solid rgba(var(--c-blue-b), 0.25);
    border-radius: 20px 20px 0 0;
    padding: 20px 20px 36px;
    width: 100%;
    max-width: 640px;
    max-height: 80dvh;
    overflow-y: auto;
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
    position: sticky;
    top: 0;
    background: var(--c-10-18-42-0_98);
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(var(--c-blue-b), 0.18);
    z-index: 10;
  }

  :global(.hints-title) {
    font-size: 16px;
    font-weight: 900;
    color: var(--h-c49230);
    letter-spacing: -0.02em;
  }

  :global(.hints-close) {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(var(--c-w), 0.10);
    background: transparent;
    color: rgba(var(--c-w), 0.40);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  }

  :global(.hints-walkthrough) {
    display: block;
    width: 100%;
    margin-top: 14px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-gold), 0.45);
    background: rgba(var(--c-gold), 0.12);
    color: var(--h-d4a038);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.1s;
  }

  :global(.hints-walkthrough:active) { background: rgba(var(--c-gold), 0.22); transform: scale(0.98); }

  :global(.hints-grid) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  :global(.hint-card) {
    background: rgba(var(--c-w), 0.04);
    border: 1px solid rgba(var(--c-w), 0.08);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.hint-header) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.hint-num) {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(var(--c-gold), 0.15);
    border: 1px solid rgba(var(--c-gold), 0.30);
    color: var(--h-c49230);
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  :global(.hint-title) {
    font-size: 14px;
    font-weight: 800;
    color: rgba(var(--c-w), 0.92);
  }

  :global(.hint-desc) {
    font-size: 12.5px;
    color: rgba(var(--c-w), 0.55);
    line-height: 1.5;
    margin: 0;
  }

  :global(.hint-desc em) {
    color: var(--h-c49230);
    font-style: normal;
    font-weight: 700;
  }
  @media (min-width: 640px) {
    .title-text { font-size: 22px; }
    .icon-btn { width: 44px; height: 44px; }
    .section { padding: 18px 20px 0; }
    .section-tight { padding-top: 10px; }
    .day-label { font-size: 26px; }
    .day-week-num { font-size: 13px; }
    .day-progress { font-size: 13px; padding: 5px 12px; }
    .stats-btn { padding: 18px 24px; }
    .stats-btn-label { font-size: 18px; }
    .stats-btn-icon { width: 22px; height: 22px; }
    .empty-title { font-size: 20px; }
  }
</style>
