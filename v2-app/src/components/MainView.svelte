<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { currentUser, uiState, appState, currentDayExercises, copyPreviousDay, searchOpen, weekOffset, syncStatus, sheetOpen, requestOnboarding, hintsOpen, recordsOpen, recoveryOpen, accountOpen, statsOpen, setDayKind, goToAdjacentDay, goToToday, todayWeekDay, showToast, addExercise, materializeAssignment, openWorkoutMode, exitWorkout } from '../stores/app';
  import type { DayKind } from '../types/workout';
  import { listIncomingInvites, getMyCoach } from '../services/coach';
  import { loadCoachNotesFor } from '../stores/coachNotes';
  import { coachUnreadTotal, myCoachLinkId, myCoachEmail, startCoachUnreadWatch, stopCoachUnreadWatch, refreshCoachUnread } from '../stores/messages';
  import ChatView from './ChatView.svelte';
  import { assignments, assignmentKey, setAssignmentContext, loadAssignmentsFor } from '../stores/assignments';
  import MonthCalendar from './MonthCalendar.svelte';
  import { weekDayToUTCDate } from '../lib/dates';
  import TopBar from './TopBar.svelte';
  import HeroCard from './HeroCard.svelte';
  import ExerciseCard from './ExerciseCard.svelte';
  import CoachNote from './CoachNote.svelte';
  import AddExercise from './AddExercise.svelte';
  import CopyDaySheet from './CopyDaySheet.svelte';


  // Pending coach invite -> show a marker on the account icon so the trainee
  // knows to open the sheet and accept. Optional layer; failures are silent.
  let hasInvite = false;
  async function refreshInvites() {
    try { hasInvite = (await listIncomingInvites()).length > 0; } catch { /* ignore */ }
  }
  // Coach notes (Track 2): read-only for the trainee. Tracks load failures so
  // the UI can show a retry affordance instead of silently rendering empty.
  let notesLoadFailed = false;
  async function refreshCoachNotes() {
    const me = $currentUser?.id;
    if (!me) return;
    try {
      await loadCoachNotesFor(me);
      notesLoadFailed = false;
    } catch {
      notesLoadFailed = true;
    }
  }
  // Coach program (Track 3): the trainee READS prescribed future days. Tracks
  // load failures so the UI can show a retry affordance.
  let planLoadFailed = false;
  async function refreshAssignments() {
    const me = $currentUser?.id;
    if (!me) return;
    setAssignmentContext({ coachId: null, traineeId: me, canEdit: false });
    try {
      await loadAssignmentsFor(me);
      planLoadFailed = false;
    } catch {
      planLoadFailed = true;
    }
  }
  async function retryCoachData() {
    notesLoadFailed = false;
    planLoadFailed = false;
    await Promise.allSettled([refreshCoachNotes(), refreshAssignments()]);
  }
  // Desktop session CTA elapsed clock (mirrors App.svelte's bottom-bar timer).
  // The bottom bar is hidden on desktop; the Start/Resume/Stop control lives in
  // the session pane instead. Mobile keeps the bottom bar untouched.
  let elapsed = 0;
  let clockInterval: ReturnType<typeof setInterval>;
  function fmtElapsed(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s2 = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s2).padStart(2,'0')}`;
    return `${m}:${String(s2).padStart(2,'0')}`;
  }

  onMount(async () => {
    refreshInvites(); refreshCoachNotes(); refreshAssignments();
    const me = $currentUser?.id;
    if (me) {
      // Eagerly detect coach so the chat button appears immediately
      getMyCoach(me).then(c => { hasCoach = !!c; }).catch(() => {});
      startCoachUnreadWatch(me).then(() => { hasCoach = !!$myCoachLinkId; }).catch(() => {});
    }
    clockInterval = setInterval(() => {
      const start = $uiState.workoutStartTime;
      elapsed = start ? Math.floor((Date.now() - start) / 1000) : 0;
    }, 1000);
  });
  onDestroy(() => { stopCoachUnreadWatch(); clearInterval(clockInterval); });

  // Plan-vs-actual per current day (§3.4): a prescribed day the trainee has not
  // yet touched renders read-mostly; first touch materializes it into the blob.
  $: plannedDay = $assignments[assignmentKey($uiState.week, $uiState.day)] ?? null;
  $: isPlanOnly = $currentDayExercises.length === 0 && !!plannedDay;

  function startPlanned() {
    const plan = plannedDay;
    if (!plan) return;
    const ok = materializeAssignment($uiState.week, $uiState.day, plan.exercises);
    if (ok) {
      exercisesExpanded = true;
      showToast('Plan started \u2014 log your sets', 'success');
    }
  }

  // Compact preview helper for a planned exercise's set line.
  function planSetLine(ex: { sets: { kg: string; reps: string }[] }): string {
    if (ex.sets.length === 0) return '';
    const first = ex.sets[0];
    const tail = first.kg || first.reps ? ` \u00b7 ${first.kg ? first.kg + 'kg' : ''}${first.kg && first.reps ? ' \u00d7 ' : (first.reps ? '\u00d7 ' : '')}${first.reps || ''}` : '';
    return `${ex.sets.length} set${ex.sets.length !== 1 ? 's' : ''}${tail}`;
  }

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

  // Superset group sizes — how many exercises share the same code[0]
  // Used to suppress the code badge on lone-coded exercises.
  $: supersetSizes = (() => {
    const groupCount: Record<string, number> = {};
    for (const ex of $currentDayExercises) {
      if (ex.type === 'superset' && ex.code) {
        const k = ex.code[0];
        groupCount[k] = (groupCount[k] ?? 0) + 1;
      }
    }
    const result: Record<string, number> = {};
    for (const ex of $currentDayExercises) {
      result[ex.id] = (ex.type === 'superset' && ex.code) ? (groupCount[ex.code[0]] ?? 1) : 1;
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

  $: totalWeeks = $appState.weeks.filter(w => w.exercises.length > 0).length;
  $: isNewUser = totalWeeks === 0;
  let hasCoach = false; // set eagerly on mount, updated after watch

  // Sync sheetOpen with accountOpen store (used by service worker / badge logic)
  $: sheetOpen.set($accountOpen);

  // When accountOpen goes false (sheet closed), refresh coach/invite state
  let _prevAccountOpen = false;
  $: {
    if (_prevAccountOpen && !$accountOpen) {
      refreshInvites(); refreshCoachNotes(); refreshAssignments();
      const _me = $currentUser?.id; if (_me) refreshCoachUnread(_me);
    }
    _prevAccountOpen = $accountOpen;
  }
  type TraineeChatState = 'hidden' | 'mini' | 'open';
  let traineeChatState: TraineeChatState = 'hidden';
  function openTraineeChat() { if (traineeChatState === 'open') { traineeChatState = 'mini'; } else { traineeChatState = 'open'; } }
  function minimiseTraineeChat() { traineeChatState = 'mini'; }
  function closeTraineeChat() { traineeChatState = 'hidden'; }
  let copySheetOpen = false;
  let exercisesExpanded = false;

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

  // ---- #2 Starter templates (new-user first-run) ----
  const STARTER_TEMPLATES: { name: string; sub: string; exercises: string[] }[] = [
    { name: 'Full Body', sub: '5 exercises', exercises: ['Squat', 'Bench Press', 'Barbell Row', 'Overhead Press', 'Plank'] },
    { name: 'Upper / Lower', sub: 'today: Upper', exercises: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Lat Pulldown', 'Biceps Curl'] },
    { name: 'Push / Pull / Legs', sub: 'today: Push', exercises: ['Bench Press', 'Overhead Press', 'Incline DB Press', 'Triceps Pushdown'] },
  ];
  let selectedTemplate = 0;

  function applyTemplate(i: number) {
    const tpl = STARTER_TEMPLATES[i];
    for (const name of tpl.exercises) addExercise($uiState.week, $uiState.day, name);
    exercisesExpanded = true;
    showToast(`${tpl.name} added \u2014 fill in your weights`, 'success');
  }

  // Today highlight for the day-header Today button
  $: _today = todayWeekDay();
  $: onToday = !!_today && _today.week === $uiState.week && _today.day === $uiState.day;
  $: browsingLabel = (() => {
    const d = weekDayToUTCDate($uiState.week, $uiState.day);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  })();

  function markDay(k: DayKind, label: string) {
    const turningOff = currentDayKind === k;
    setDayKind($uiState.week, $uiState.day, turningOff ? null : k);
    showToast(turningOff ? `${$uiState.day}: mark cleared` : `${$uiState.day} → ${label}`, 'success');
  }

  const DAY_KINDS: { k: DayKind; label: string }[] = [
    { k: 'recovery', label: 'Recovery' },
    { k: 'rest', label: 'Rest' },
  ];

</script>

<div class="main">
  <!-- Header -->
  <TopBar
    syncStatus={$syncStatus}
    onGuide={() => ($hintsOpen = true)}
    onSearch={() => ($searchOpen = true)}
    onAccount={() => ($accountOpen = true)}
    onChat={openTraineeChat}
    {hasInvite}
    {hasCoach}
    unreadMessages={$coachUnreadTotal}
  />

  {#if !isNewUser}
    <section class="section section-tight r-hero">
      <HeroCard />
    </section>
  {/if}

  {#if isNewUser}
    <section class="section r-welcome">
      <div class="welcome-card">
        <div class="welcome-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
            <rect x="6" y="18" width="6" height="8" rx="2" fill="var(--c-accent-solid)"/>
            <rect x="12" y="15" width="5" height="14" rx="2" fill="var(--c-accent-solid)"/>
            <rect x="17" y="20" width="10" height="4" rx="2" fill="var(--c-accent-solid)"/>
            <rect x="27" y="15" width="5" height="14" rx="2" fill="var(--c-accent-solid)"/>
            <rect x="32" y="18" width="6" height="8" rx="2" fill="var(--c-accent-solid)"/>
          </svg>
        </div>
        <span class="welcome-title">Welcome — let’s start training</span>
        <span class="welcome-sub">Plan your week in the calendar and log your first workout.</span>
        <div class="tpl-list">
          {#each STARTER_TEMPLATES as tpl, i}
            <button type="button" class="tpl-row" class:sel={selectedTemplate === i} on:click={() => (selectedTemplate = i)}>
              <span class="tpl-name">{tpl.name}</span>
              <span class="tpl-sub">{tpl.sub}</span>
            </button>
          {/each}
        </div>
        <div class="tpl-pills">
          {#each STARTER_TEMPLATES[selectedTemplate].exercises as ex}
            <span class="tpl-pill">{ex}</span>
          {/each}
        </div>
        <button class="tpl-cta" on:click={() => applyTemplate(selectedTemplate)}>
          Add {STARTER_TEMPLATES[selectedTemplate].exercises.length} exercises to today
        </button>
        <div class="welcome-actions">
          <button class="welcome-secondary" on:click={startFirstExercise}>Start blank</button>
          <button class="welcome-secondary" on:click={() => requestOnboarding.set(true)}>How it works</button>
        </div>
      </div>
    </section>
  {/if}

  <div class="col-planner">
    <section class="section r-calendar">
    <MonthCalendar />
  </section>

    <section class="section section-tight r-stats">
    <div class="nav-bar">
      <button class="nav-btn" on:click={() => ($recordsOpen = true)} aria-label="Personal records">
        <svg class="nav-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
          <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
        </svg>
        <span class="nav-btn-label">Records</span>
      </button>
      <button class="nav-btn" on:click={() => ($recoveryOpen = true)} aria-label="Recovery status">
        <svg class="nav-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="nav-btn-label">Recovery</span>
      </button>
      <button class="nav-btn" on:click={() => ($statsOpen = true)} aria-label="Statistics">
        <svg class="nav-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/>
          <rect x="17" y="3" width="4" height="18"/>
        </svg>
        <span class="nav-btn-label">Statistics</span>
      </button>
    </div>
  </section>


  
  </div>

  <div class="col-session">
  {#if $currentDayExercises.length > 0 && !$uiState.workoutMode}
    <div class="session-cta-wrap">
      {#if $uiState.workoutActive}
        <button class="session-resume" on:click={openWorkoutMode}>Resume workout →</button>
        <button class="session-stop" on:click={exitWorkout} title="Stop workout"><span class="session-stop-dot"></span><span class="session-stop-val">{fmtElapsed(elapsed)}</span><span class="session-stop-x">■</span></button>
      {:else}
        <button class="session-start" on:click={openWorkoutMode}>▶ Start workout</button>
      {/if}
    </div>
  {/if}
    <section class="section r-day">
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
      <button class="browsing-banner" on:click={goToToday} aria-label="Return to today">
        <span class="bb-icon">📅</span>
        <span class="bb-body">
          <span class="bb-title">Viewing {browsingLabel}</span>
          <span class="bb-sub">Tap to return to today</span>
        </span>
        <span class="bb-cta">Today ›</span>
      </button>
    {/if}

    {#if $currentDayExercises.length === 0}
    <div class="day-kind-seg" role="group" aria-label="Day type">
      {#each DAY_KINDS as { k, label }}
        <button
          class="seg-btn seg-{k}"
          class:active={currentDayKind === k}
          on:click={() => markDay(k, label)}
        >{label}</button>
      {/each}
    </div>
    {/if}

    <CoachNote week={$uiState.week} day={$uiState.day} exerciseId={null} authoring={false} />

    {#if notesLoadFailed || planLoadFailed}
      <div class="coach-load-err" role="alert">
        <span>Could not load coach data</span>
        <button class="coach-load-retry" on:click={retryCoachData}>Retry</button>
      </div>
    {/if}

    {#if isPlanOnly && plannedDay}
      <div class="planned-panel">
        <div class="planned-head">
          <span class="planned-badge">PLANNED BY COACH</span>
          <span class="planned-count">{plannedDay.exercises.length} exercise{plannedDay.exercises.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="planned-list">
          {#each plannedDay.exercises as ex (ex.id)}
            <div class="planned-row">
              {#if ex.type === 'superset' && ex.code}<span class="planned-code">{ex.code}</span>{/if}
              <span class="planned-name">{ex.name}</span>
              <span class="planned-sets">{planSetLine(ex)}</span>
            </div>
          {/each}
        </div>
        <button class="planned-cta" on:click={startPlanned}>Start planned workout</button>
        <span class="planned-foot">Starting copies the plan into your day — then it’s yours to log.</span>
      </div>
    {:else if $currentDayExercises.length === 0}
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
        <button class="copy-day-btn" on:click|stopPropagation={() => copySheetOpen = true}>
          Copy from another day →
        </button>
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
            supersetSize={supersetSizes[exercise.id] ?? 1}
            total={$currentDayExercises.length}
          />
        {/each}
      </div>
    {/if}

    {#if exercisesExpanded && !isPlanOnly}
      <div class="add-ex-wrap">
        <AddExercise bind:this={adder} week={$uiState.week} day={$uiState.day} />
      </div>
    {/if}
  </section>
  </div>
</div>



{#if traineeChatState === 'open' && $myCoachLinkId && $currentUser}
  <div class="trainee-chat-panel">
    <ChatView
      linkId={$myCoachLinkId}
      myUserId={$currentUser.id}
      peerName={$myCoachEmail ?? 'Coach'}
      onClose={minimiseTraineeChat}
    />
  </div>
{/if}

{#if traineeChatState === 'mini'}
  <button class="trainee-chat-mini" on:click={openTraineeChat} aria-label="Open coach chat">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <span class="trainee-chat-mini-lbl">Coach</span>
    {#if $coachUnreadTotal > 0}<span class="trainee-chat-mini-badge">{$coachUnreadTotal > 9 ? '9+' : $coachUnreadTotal}</span>{/if}
    <span class="trainee-chat-mini-close" role="button" tabindex="0"
      on:click|stopPropagation={closeTraineeChat}
      on:keydown={(e) => e.key === 'Enter' && closeTraineeChat()}
      aria-label="Dismiss">✕</span>
  </button>
{/if}

{#if copySheetOpen}
  <CopyDaySheet
    week={$uiState.week}
    day={$uiState.day}
    on:close={() => copySheetOpen = false}
  />
{/if}

<style>
  .main {
    min-height: 100%;
    background: transparent;
    color: var(--c-text);
    padding: 0 0 32px;
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  /* Desktop-grid scaffold (PR1). Below 900px the region wrappers are inert
     (display: contents) so their children flow directly inside .main and the
     `order` values below reproduce the exact current single-column sequence:
     TopBar, welcome, streak, calendar, day, stats, statsview. Mobile is
     byte-identical; the wrappers only become real columns at >=900px. */
  .col-planner,
  .col-session { display: contents; }

  /* Desktop session CTA (Start / Resume / Stop) lives at the top of the session
     pane on desktop; on mobile it is hidden and the bottom workout-bar handles it. */
  .session-cta-wrap { display: none; }
  .session-start,
  .session-resume {
    flex: 1 1 0;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-accent), 0.55);
    background: rgba(var(--c-accent), 0.16);
    color: var(--h-d4a038);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
  }
  .session-start { background: var(--c-accent-solid); color: var(--h-0c0c0e); border: none; }
  .session-start:active { transform: scale(0.99); }
  .session-resume:active { background: rgba(var(--c-accent), 0.26); transform: scale(0.99); }
  .session-stop {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-fg), 0.16);
    background: rgba(var(--c-fg), 0.06);
    color: rgba(var(--c-fg), 0.80);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }
  .session-stop-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(var(--c-fg), 0.70); flex-shrink: 0; }
  .session-stop-val { font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .session-stop-x { font-size: 10px; opacity: 0.5; }

  .r-welcome   { order: 2; }
  .r-hero      { order: 2; }
  .r-streak    { order: 3; }
  .r-calendar  { order: 4; }
  .r-day       { order: 5; }
  .r-stats     { order: 6; }
  .r-statsview { order: 7; }

  /* ---- Topbar ---- */
  /* ---- Sections ---- */
  .section {
    padding: 14px 14px 0;
  }

  .section-tight {
    padding-top: 8px;
  }

  /* ---- Nav bar (Records | Recovery | Statistics) ---- */
  .nav-bar {
    display: flex;
    gap: 8px;
  }

  .nav-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 14px 8px;
    border-radius: 16px;
    border: 1px solid rgba(var(--c-accent), 0.30);
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
  }

  .nav-btn:active { background: rgba(var(--c-accent), 0.10); transform: scale(0.97); }

  .nav-btn-icon {
    color: rgba(var(--c-accent), 0.80);
    flex-shrink: 0;
  }

  .nav-btn-label {
    font-size: 11px;
    font-weight: 800;
    color: rgba(var(--c-fg), 0.60);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

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
    border: 1px solid rgba(var(--c-fg), 0.07);
    background: rgba(var(--c-surface-b), 0.50);
    color: var(--c-232-240-255-0_65);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .day-nav-arrow:active { background: rgba(var(--c-surface-b), 0.85); }

  .browsing-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    width: calc(100% - 24px);
    margin: 8px 12px 0;
    padding: 9px 12px;
    border-radius: 10px;
    border: 0.5px solid rgba(var(--c-accent), 0.28);
    background: rgba(var(--c-accent), 0.10);
    cursor: pointer;
    text-align: left;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s;
  }
  .browsing-banner:active { background: rgba(var(--c-accent), 0.18); }
  .bb-icon {
    width: 28px; height: 28px;
    border-radius: 6px;
    background: rgba(var(--c-accent), 0.18);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0;
  }
  .bb-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .bb-title { font-size: 13px; font-weight: 600; color: var(--h-d4a038); }
  .bb-sub { font-size: 11px; color: rgba(var(--c-accent), 0.55); }
  .bb-cta { font-size: 13px; font-weight: 700; color: var(--h-d4a038); flex-shrink: 0; }

  .day-heading-btn {
    width: 100%;
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-fg), 0.07);
    background: rgba(var(--c-surface-b), 0.50);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
    margin-bottom: 0;
  }

  .day-heading-btn:active { background: rgba(var(--c-surface-b), 0.80); }

  .ex-chevron {
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s;
    font-size: 18px;
    color: rgba(var(--c-fg), 0.30);
    line-height: 1;
    flex-shrink: 0;
    margin-left: auto;
  }

  .ex-chevron.open { transform: rotate(-90deg); color: rgba(var(--c-fg), 0.55); }

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
    color: var(--c-text);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .day-week-num {
    font-size: 11px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.35);
    letter-spacing: 0.02em;
  }

  .day-progress {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    background: var(--c-14-26-55-0_70);
    border: 1px solid rgba(var(--c-fg), 0.13);
    color: rgba(var(--c-fg), 0.50);
    letter-spacing: 0.02em;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }

  .day-progress.all-done {
    background: rgba(var(--c-fg), 0.09);
    border-color: rgba(var(--c-fg), 0.25);
    color: rgba(var(--c-fg), 0.90);
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
    border: 1px solid rgba(var(--c-edge-b), 0.16);
    background: rgba(var(--c-surface-b), 0.55);
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
    background: rgba(var(--c-accent), 0.16);
    border-color: rgba(var(--c-accent), 0.45);
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
    border: 1px solid rgba(var(--c-accent), 0.45);
    background: rgba(var(--c-accent), 0.14);
    color: var(--h-d4a038);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
  }

  .add-first-btn:active { background: rgba(var(--c-accent), 0.24); transform: scale(0.98); }

  /* ---- Planned-by-coach panel (Track 3) ---- */
  .planned-panel {
    margin-top: 10px;
    padding: 16px 16px 14px;
    border-radius: 18px;
    border: 1px solid rgba(var(--c-accent), 0.40);
    background: rgba(var(--c-accent), 0.06);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .planned-head {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .planned-badge {
    font-size: 11px; font-weight: 900; letter-spacing: 0.12em;
    color: var(--c-accent-solid);
    padding: 3px 10px; border-radius: 999px;
    background: rgba(var(--c-accent), 0.14);
    border: 1px solid rgba(var(--c-accent), 0.40);
  }
  .planned-count { font-size: 12px; font-weight: 700; color: rgba(var(--c-fg), 0.45); }
  .planned-list { display: grid; gap: 6px; }
  .planned-row {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; border-radius: 11px;
    border: 1px solid rgba(var(--c-fg), 0.08);
    background: rgba(var(--c-fg), 0.03);
  }
  .planned-code {
    flex: 0 0 auto; width: 20px; height: 20px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 900; color: var(--c-accent-solid);
    background: rgba(var(--c-accent), 0.14); border: 1px solid rgba(var(--c-accent), 0.35);
  }
  .planned-name {
    flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 700; color: var(--c-text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .planned-sets { flex: 0 0 auto; font-size: 12px; font-weight: 600; color: rgba(var(--c-fg), 0.45); }
  .planned-cta {
    margin-top: 2px; width: 100%; padding: 14px;
    border-radius: 13px; border: 1px solid rgba(var(--c-accent), 0.55);
    background: rgba(var(--c-accent), 0.18); color: var(--h-d4a038);
    font-size: 15px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
  }
  .planned-cta:active { background: rgba(var(--c-accent), 0.28); transform: scale(0.98); }
  .planned-foot { font-size: 11.5px; color: rgba(var(--c-fg), 0.40); text-align: center; line-height: 1.5; }

  /* ---- Empty state ---- */
  .empty-state {
    padding: 36px 20px;
    text-align: center;
    border: 1px dashed rgba(var(--c-fg), 0.08);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.28);
    letter-spacing: -0.01em;
  }

  .empty-sub {
    font-size: 13px;
    font-weight: 500;
    color: rgba(var(--c-fg), 0.45);
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
    border: 1px solid rgba(var(--c-accent), 0.35);
    background: rgba(var(--c-accent), 0.07);
  }
  .welcome-icon { margin-bottom: 4px; }
  .welcome-title { font-size: 18px; font-weight: 900; color: var(--h-ffffff); letter-spacing: -0.01em; }
  .welcome-sub { font-size: 13px; font-weight: 500; color: rgba(var(--c-fg), 0.55); max-width: 300px; line-height: 1.5; }
  .welcome-actions { display: flex; gap: 10px; margin-top: 14px; width: 100%; max-width: 360px; }
  .welcome-primary {
    flex: 1;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-accent), 0.55);
    background: rgba(var(--c-accent), 0.18);
    color: var(--h-d4a038);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
  }
  .welcome-primary:active { background: rgba(var(--c-accent), 0.28); transform: scale(0.98); }
  .welcome-secondary {
    flex: 0 0 auto;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-fg), 0.16);
    background: rgba(var(--c-fg), 0.05);
    color: var(--c-text);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }
  .welcome-secondary:active { background: rgba(var(--c-fg), 0.12); }

  .welcome-actions .welcome-secondary { flex: 1; }

  .tpl-list { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 360px; margin-top: 12px; }
  .tpl-row {
    display: flex; align-items: center; gap: 10px;
    padding: 13px 14px; border-radius: 13px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: rgba(var(--c-fg), 0.04);
    cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, border-color 0.12s;
  }
  .tpl-row.sel { border-color: rgba(var(--c-accent), 0.55); background: rgba(var(--c-accent), 0.10); }
  .tpl-name { font-size: 15px; font-weight: 800; color: var(--h-ffffff); }
  .tpl-sub { margin-left: auto; font-size: 12px; color: rgba(var(--c-fg), 0.40); }

  .tpl-pills { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; width: 100%; max-width: 360px; margin-top: 10px; }
  .tpl-pill {
    font-size: 12px; color: rgba(var(--c-fg), 0.70);
    background: rgba(var(--c-fg), 0.06); border: 1px solid rgba(var(--c-fg), 0.10);
    border-radius: 999px; padding: 4px 10px;
  }

  .tpl-cta {
    width: 100%; max-width: 360px; margin-top: 14px; padding: 15px;
    border-radius: 13px; border: 1px solid rgba(var(--c-accent), 0.55);
    background: rgba(var(--c-accent), 0.18); color: var(--h-d4a038);
    font-size: 15px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
  }
  .tpl-cta:active { background: rgba(var(--c-accent), 0.28); transform: scale(0.98); }

  .copy-day-btn {
    margin-top: 12px;
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--c-127-178-255-0_22);
    background: var(--c-127-178-255-0_07);
    color: var(--c-text);
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .copy-day-btn:active { background: var(--c-127-178-255-0_15); }

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
    border: 1px solid rgba(var(--c-fg), 0.10);
    border-right: none;
    background: rgba(var(--c-surface-b), 0.80);
    color: rgba(var(--c-fg), 0.30);
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
    color: rgba(var(--c-fg), 0.75);
  }

  /* Prominent when no workouts done yet */
  :global(.hints-fab-new) {
    background: rgba(var(--c-accent), 0.18);
    border-color: rgba(var(--c-accent), 0.35);
    color: var(--c-accent-solid);
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
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
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
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border: 1px solid rgba(var(--c-edge-b), 0.25);
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
    background: var(--h-0d1a30);
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(var(--c-edge-b), 0.18);
    z-index: 10;
  }

  :global(.hints-title) {
    font-size: 16px;
    font-weight: 900;
    color: var(--c-accent-solid);
    letter-spacing: -0.02em;
  }

  :global(.hints-close) {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: transparent;
    color: rgba(var(--c-fg), 0.40);
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
    border: 1px solid rgba(var(--c-accent), 0.45);
    background: rgba(var(--c-accent), 0.12);
    color: var(--h-d4a038);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.1s;
  }

  :global(.hints-walkthrough:active) { background: rgba(var(--c-accent), 0.22); transform: scale(0.98); }

  :global(.hints-grid) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  :global(.hint-card) {
    background: rgba(var(--c-fg), 0.04);
    border: 1px solid rgba(var(--c-fg), 0.08);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.hint-header) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  :global(.hint-num) {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(var(--c-accent), 0.15);
    border: 1px solid rgba(var(--c-accent), 0.30);
    color: var(--c-accent-solid);
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
    color: rgba(var(--c-fg), 0.92);
  }

  :global(.hint-desc) {
    font-size: 12.5px;
    color: rgba(var(--c-fg), 0.55);
    line-height: 1.5;
    margin: 0;
    text-align: left;
  }

  :global(.hint-desc em) {
    color: var(--c-accent-solid);
    font-style: normal;
    font-weight: 700;
  }
  @media (min-width: 640px) {
    .section { padding: 18px 20px 0; }
    .section-tight { padding-top: 10px; }
    .day-label { font-size: 26px; }
    .day-week-num { font-size: 13px; }
    .day-progress { font-size: 13px; padding: 5px 12px; }
    .empty-title { font-size: 20px; }
  }

  /* Desktop layout (>=900px): full-width TopBar + a streak status strip, then two
     panes — Planner (calendar + statistics) on the left, today's Session (the hero)
     on the right with its Start/Resume CTA at the top. The bottom workout-bar is
     hidden on desktop (App.svelte). Mobile/PWA single-column above is untouched. */
  @media (min-width: 900px) {
    .main {
      max-width: 1160px;
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      grid-template-areas:
        "bar     bar"
        "strip   strip"
        "hero    hero"
        "welcome welcome"
        "planner session";
      column-gap: 18px;
      align-items: start;
    }

    .main > :global(.topbar) { grid-area: bar; }
    .r-streak  { grid-area: strip; }
    .r-hero    { grid-area: hero; }
    .r-welcome { grid-area: welcome; }

    .col-planner { display: flex; flex-direction: column; grid-area: planner; }
    .col-session { display: flex; flex-direction: column; grid-area: session; }

    .session-cta-wrap { display: flex; gap: 8px; padding: 14px 20px 0; }

    /* Editorial heading craft — desktop only (mobile keeps 20px / -0.03em) */
    .day-label { font-size: 23px; letter-spacing: -0.04em; }
  }


  /* ---- Trainee floating chat panel ---- */
  .trainee-chat-panel {
    position: fixed; inset: 0; z-index: 120;
    display: flex; flex-direction: column;
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
  }
  .trainee-chat-mini {
    position: fixed;
    bottom: 0; right: 16px;
    display: flex; align-items: center; gap: 7px;
    padding: 10px 16px 14px;
    border-radius: 12px 12px 0 0;
    border: 1px solid rgba(var(--c-edge-b), 0.28); border-bottom: none;
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    color: rgba(var(--c-accent-solid), 0.90);
    font-size: 13px; font-weight: 700; cursor: pointer;
    z-index: 120;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.35);
  }
  .trainee-chat-mini-lbl { letter-spacing: 0.01em; }
  .trainee-chat-mini-badge {
    min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--c-accent-solid); color: #0c0c0e;
    font-size: 10px; font-weight: 900; line-height: 1;
  }
  .trainee-chat-mini-close {
    margin-left: 2px; width: 20px; height: 20px;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; background: transparent;
    color: rgba(var(--c-fg), 0.35); font-size: 11px; cursor: pointer;
    border-radius: 50%;
  }
  @media (min-width: 900px) {
    .trainee-chat-panel {
      inset: auto; right: 16px; bottom: 0;
      width: 360px; height: 72vh;
      border-radius: 16px 16px 0 0;
      border: 1px solid rgba(var(--c-edge-b), 0.25); border-bottom: none;
      box-shadow: 0 -4px 32px rgba(0,0,0,0.40);
    }
  }

  .coach-load-err {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 13px;
    border-radius: 10px;
    background: rgba(255, 80, 80, 0.10);
    border: 1px solid rgba(255, 80, 80, 0.25);
    font-size: 13px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.70);
    margin-top: 8px;
  }
  .coach-load-retry {
    font-size: 12px;
    font-weight: 700;
    color: var(--c-accent-solid);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    -webkit-tap-highlight-color: transparent;
  }
  .coach-load-retry:hover { background: rgba(var(--c-accent), 0.12); }

</style>
