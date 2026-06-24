<script lang="ts">
  import { appState, uiState, openWorkoutMode, todayWeekDay } from '../stores/app';
  import { displayName } from '../stores/ui-state';
  import { setDayLabel, streakInfo } from '../stores/workout-state';

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
  // Always use real calendar today — not the UI-selected week/day
  $: realToday = todayWeekDay();
  $: todayDay = realToday ? $appState.weeks.find(w => w.week === realToday!.week && w.day === realToday!.day) : undefined;
  $: exercises = todayDay?.exercises ?? [];

  // Workout chip: label OR "First Exercise · +N more"
  $: savedLabel = todayDay?.label ?? '';
  $: chipLine = (() => {
    if (exercises.length === 0) return null;
    const first = exercises[0].name;
    const rest = exercises.length - 1;
    return rest > 0 ? `${first} · +${rest} more` : first;
  })();

  // Weekly progress: completed days vs days-with-exercises this week
  // todayISO guards against future days that were accidentally marked completed
  $: todayISO = new Date().toISOString().split('T')[0];
  $: realWeekDays = realToday ? $appState.weeks.filter(w => w.week === realToday!.week) : [];
  $: weekDone = realWeekDays.filter(d => d.completed && d.date <= todayISO).length;
  $: weekTotal = realWeekDays.filter(d => d.exercises.length > 0).length;
  $: weekPct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

  $: streak = $streakInfo.count;

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

  <div class="meta-row">
    {#if streak > 0}
      <span class="meta-pill">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z"/></svg>
        {streak}-week streak
      </span>
    {/if}
    {#if weekTotal > 0}
      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill" style="width:{weekPct}%"></div>
        </div>
        <span class="progress-label">{weekDone} / {weekTotal} this week</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .hero-card {
    background: var(--c-topbar-bg, #111);
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

  .name-accent {
    color: var(--c-accent-solid);
  }

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
    color: #000;
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
    gap: 10px;
  }

  .meta-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: rgba(var(--c-fg), 0.48);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .meta-pill svg { color: var(--c-accent-solid); }

  .progress-wrap {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    min-width: 0;
  }

  .progress-bar {
    flex: 1;
    height: 3px;
    background: rgba(var(--c-fg), 0.12);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #22c55e;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: 11px;
    color: rgba(var(--c-fg), 0.42);
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>
