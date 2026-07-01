<script lang="ts">
  import { appState, uiState, openWorkoutMode, todayWeekDay, streakInfo, dayFullyDone } from '../stores/app';
  import { displayName } from '../stores/ui-state';
  import { setDayLabel } from '../stores/workout-state';
  import { DAY_ORDER } from '../types/workout';
  import type { WorkoutDay, DayOfWeek } from '../types/workout';

  function timeGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function todayDateString(): string {
    return new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  $: name = $displayName;
  $: realToday = todayWeekDay();
  $: todayISO = new Date().toISOString().split('T')[0];
  $: todayDay = realToday ? $appState.weeks.find(w => w.week === realToday?.week && w.day === realToday?.day) : undefined;
  $: exercises = todayDay?.exercises ?? [];

  $: savedLabel = todayDay?.label ?? '';
  $: chipLine = (() => {
    if (exercises.length === 0) return null;
    const first = exercises[0].name;
    const rest = exercises.length - 1;
    return rest > 0 ? `${first} · +${rest} more` : first;
  })();

  // Day rings — planned workout days this week, sorted Mon→Sun
  $: realWeekDays = realToday
    ? $appState.weeks.filter(w => w.week === realToday?.week && (!w.kind || w.kind === 'workout') && w.exercises.length > 0)
    : [];
  $: ringDays = [...realWeekDays].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

  // Ring state per day
  function ringState(d: WorkoutDay): 'done' | 'today' | 'past' | 'future' {
    if (dayFullyDone(d)) return 'done';
    if (d.date === todayISO) return 'today';
    if (d.date < todayISO) return 'past';
    return 'future';
  }

  // Single letter label: Mon→M, Tue→T, Wed→W, Thu→T, Fri→F, Sat→S, Sun→S
  function dayLetter(d: DayOfWeek): string {
    return d[0];
  }

  // Streak
  $: streak = $streakInfo.count;
  $: atRisk = streak > 0 && !$streakInfo.thisWeekActive;
  $: hasStreak = streak > 0;

  // Inline label editing
  let editing = false;
  let editValue = '';

  function startEdit() {
    editValue = savedLabel;
    editing = true;
  }

  function saveLabel() {
    editing = false;
    setDayLabel($uiState.week, $uiState.day, editValue.trim());
  }

  function focusEl(el: HTMLElement) { el.focus(); }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveLabel();
    if (e.key === 'Escape') editing = false;
  }
</script>

<div class="hero-card">
  <p class="date-line">{todayDateString()}</p>
  <p class="greeting-line">
    {#if name}
      {timeGreeting()},&nbsp;<span class="name-accent">{name}</span>
    {:else}
      {timeGreeting()}
    {/if}
  </p>

  {#if exercises.length > 0}
    <div class="workout-chip">
      <div class="chip-left">
        {#if editing}
          <input
            class="label-input"
            bind:value={editValue}
            on:blur={saveLabel}
            on:keydown={onKeydown}
            placeholder="Name this session…"
            maxlength={40}
            use:focusEl
          />
        {:else}
          <div class="chip-name">
            {savedLabel || chipLine}
            <button class="edit-btn" on:click={startEdit} aria-label="Rename session">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
          {#if savedLabel && chipLine}
            <div class="chip-sub">{chipLine}</div>
          {/if}
        {/if}
      </div>
      <button class="start-btn" on:click={openWorkoutMode}>Start</button>
    </div>
  {/if}

  <!-- Single progress row: streak + day rings -->
  <div class="meta-row">
    <div class="streak-pill" class:at-risk={atRisk} class:dormant={!hasStreak}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z"/></svg>
      {#if hasStreak}
        {streak}w{#if atRisk}&nbsp;<span class="risk-label">at risk</span>{/if}
      {:else}
        Start a streak
      {/if}
    </div>

    {#if ringDays.length > 0}
      <div class="day-rings" aria-label="This week's workouts">
        {#each ringDays as d (d.day)}
          {@const state = ringState(d)}
          <div class="ring-wrap">
            <span class="ring-label">{dayLetter(d.day)}</span>
            <div class="ring ring--{state}" aria-label="{d.day}: {state}"></div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .hero-card {
    background: rgba(var(--c-accent), 0.08);
    border: 0.5px solid rgba(var(--c-accent), 0.20);
    border-radius: 14px;
    padding: 14px 16px 16px;
  }

  .date-line {
    font-size: 11px;
    color: rgba(var(--c-fg), 0.38);
    margin: 0 0 3px;
    font-weight: 400;
  }

  .greeting-line {
    font-size: 19px;
    font-weight: 500;
    color: rgba(var(--c-fg), 0.92);
    margin: 0 0 12px;
    letter-spacing: -0.01em;
  }

  .name-accent { color: var(--c-accent-solid); }

  /* Workout chip */
  .workout-chip {
    background: rgba(var(--c-accent), 0.10);
    border: 0.5px solid rgba(var(--c-accent), 0.22);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .chip-left { flex: 1; min-width: 0; }

  .chip-name {
    font-size: 13px;
    font-weight: 500;
    color: rgba(var(--c-fg), 0.90);
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip-sub {
    font-size: 11px;
    color: rgba(var(--c-fg), 0.42);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .edit-btn {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: rgba(var(--c-fg), 0.35);
    display: flex;
    align-items: center;
    flex-shrink: 0;
    border-radius: 4px;
  }
  .edit-btn:hover { color: rgba(var(--c-fg), 0.65); }

  .label-input {
    width: 100%;
    background: rgba(var(--c-fg), 0.06);
    border: 0.5px solid rgba(var(--c-accent), 0.35);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(var(--c-fg), 0.92);
    outline: none;
    box-sizing: border-box;
  }
  .label-input::placeholder { color: rgba(var(--c-fg), 0.30); }

  .start-btn {
    background: var(--c-accent-solid);
    color: var(--c-bg-3);
    border: none;
    border-radius: 7px;
    padding: 6px 13px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    flex-shrink: 0;
    letter-spacing: 0.01em;
  }
  .start-btn:active { opacity: 0.85; transform: scale(0.97); }

  /* Meta row */
  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  /* Streak pill */
  .streak-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.65);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .streak-pill svg { color: var(--c-accent-solid); }
  .streak-pill.at-risk svg { color: var(--h-d4a038); }
  .streak-pill.at-risk { color: var(--h-d4a038); }
  .streak-pill.dormant svg { color: rgba(var(--c-fg), 0.25); }

  .risk-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--h-d4a038);
    letter-spacing: 0.02em;
  }

  /* Day rings */
  .day-rings {
    display: flex;
    gap: 7px;
    align-items: center;
    flex-shrink: 0;
  }

  .ring-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .ring-label {
    font-size: 9px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.22);
    letter-spacing: 0.02em;
  }

  .ring {
    width: 14px;
    height: 14px;
    border-radius: 50%;
  }

  /* done = fully completed → green fill */
  .ring--done {
    background: var(--h-4fc08d);
    border: 1.5px solid var(--h-4fc08d);
  }

  /* today = current day, not yet done → gold outline */
  .ring--today {
    background: transparent;
    border: 1.5px solid var(--c-accent-solid);
  }

  /* past = missed → very dim outline */
  .ring--past {
    background: transparent;
    border: 1.5px solid rgba(var(--c-fg), 0.18);
  }

  /* future = upcoming → barely visible outline */
  .ring--future {
    background: transparent;
    border: 1.5px solid rgba(var(--c-fg), 0.10);
  }

  /* today ring label gets gold accent */
  .ring-wrap:has(.ring--today) .ring-label {
    color: var(--c-accent-solid);
  }
</style>
