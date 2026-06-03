<script lang="ts">
  import { DAY_ORDER, type DayOfWeek, type AppState, type UIState } from '../types/workout';
  import { appState, uiState, updateUI } from '../stores/app';
  import { PS_UTC } from '../lib/program';

  // Use UTC arithmetic — avoids DST shifts (e.g. 28 Mar 2026 spring-forward)
  function dateToWeekDay(date: Date): { week: number; day: DayOfWeek } | null {
    const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((utc - PS_UTC) / 86400000);
    if (diff < 0) return null;
    return { week: Math.floor(diff / 7) + 1, day: DAY_ORDER[diff % 7] };
  }

  function weekToDate(week: number, day: DayOfWeek): Date {
    const dayIdx = DAY_ORDER.indexOf(day);
    const utc = PS_UTC + ((week - 1) * 7 + dayIdx) * 86400000;
    const d = new Date(utc);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  type DayStatus = 'done' | 'partial' | 'active-recovery' | 'has-data' | 'rest' | 'weekend' | 'future' | 'neutral';

  function getDayStatus(date: Date, state: AppState): DayStatus {
    const wd = dateToWeekDay(date);
    // Outside the program range — nothing to show.
    if (!wd) return 'neutral';

    const workoutDay = state.weeks.find(w => w.week === wd.week && w.day === wd.day);
    const hasData = workoutDay && workoutDay.exercises.length > 0;

    if (hasData) {
      // Logged work present — completion drives the colour.
      if (workoutDay!.completed === true) return 'done';
      const nonRecovery = workoutDay!.exercises.filter(e => !e.recovery);
      const hasRecovery = workoutDay!.exercises.some(e => e.recovery && e.recoveryDone);
      if (nonRecovery.length === 0) {
        if (hasRecovery || workoutDay!.kind === 'recovery') return 'active-recovery';
        return 'has-data';
      }
      const allDone = nonRecovery.every(ex => ex.sets.length > 0 && ex.sets.every(s => s.done));
      if (allDone) return 'done';
      // Partially done — some sets completed but not all
      const anyDone = nonRecovery.some(ex => ex.sets.some(s => s.done));
      if (anyDone) return 'partial';
      if (hasRecovery) return 'active-recovery';
      return 'has-data';
    }

    // No logged exercises — the user's explicit day mark drives the look.
    // Unmarked days stay neutral (empty calendar for new users).
    switch (workoutDay?.kind) {
      case 'workout':  return 'has-data';
      case 'recovery': return 'active-recovery';
      case 'rest':     return 'rest';
      default:         return 'neutral';
    }
  }

  function selectDay(date: Date) {
    const wd = dateToWeekDay(date);
    if (!wd) return;
    // Sync view to the selected day's month (user explicitly chose this day)
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();
    manualMonth = false; // allow week-strip navigation to follow again
    updateUI(ui => ({ ...ui, week: wd.week, day: wd.day }));
  }

  function isSelected(date: Date, ui: UIState): boolean {
    const wd = dateToWeekDay(date);
    if (!wd) return false;
    return wd.week === ui.week && wd.day === ui.day;
  }

  function isToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate();
  }

  // Month navigation — always start on today's month.
  // Follows the selected day only when the user explicitly picks a day from the calendar.
  // Does NOT auto-jump when uiState.week changes (e.g. on boot or token refresh).
  const _today = new Date();
  let viewYear: number = _today.getFullYear();
  let viewMonth: number = _today.getMonth();

  // When the selected day is in a different month than current view,
  // offer to sync — but only when the user navigates via the week strip,
  // not automatically. We track whether the view has been manually set.
  let manualMonth = false;

  // Sync view to selected day only on first mount (before any manual nav)
  $: if (!manualMonth) {
    const ref = weekToDate($uiState.week, $uiState.day);
    viewYear = ref.getFullYear();
    viewMonth = ref.getMonth();
  }

  function prevMonth() {
    manualMonth = true;
    if (viewMonth === 0) { viewYear -= 1; viewMonth = 11; }
    else viewMonth -= 1;
  }

  function nextMonth() {
    manualMonth = true;
    if (viewMonth === 11) { viewYear += 1; viewMonth = 0; }
    else viewMonth += 1;
  }

  function toggleCollapsed() {
    updateUI(ui => ({ ...ui, calendarCollapsed: !ui.calendarCollapsed }));
  }

  $: collapsed = $uiState.calendarCollapsed;

  const _todayForBtn = new Date();
  $: isViewingToday = viewYear === _todayForBtn.getFullYear() && viewMonth === _todayForBtn.getMonth();

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  function buildGrid(year: number, month: number): (Date | null)[][] {
    const firstDay = new Date(year, month, 1);
    const startDow = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }

  $: grid = buildGrid(viewYear, viewMonth);
</script>

<div class="month-cal" class:collapsed>
  <!-- Header row: nav + month label + collapse toggle -->
  <div class="month-nav">
    {#if !collapsed}
      <button class="nav-btn" on:click={prevMonth} aria-label="Previous month">‹</button>
    {:else}
      <div class="nav-placeholder"></div>
    {/if}

    <button class="month-label-btn" on:click={toggleCollapsed} aria-label={collapsed ? 'Expand calendar' : 'Collapse calendar'}>
      <span class="month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
      <span class="chevron" class:open={!collapsed}>›</span>
    </button>

    {#if !collapsed}
      <div class="month-nav-right">
        {#if !isViewingToday}
          <button class="today-month-btn" on:click={() => { const t = new Date(); viewYear = t.getFullYear(); viewMonth = t.getMonth(); manualMonth = false; }} aria-label="Go to today's month">Today</button>
        {/if}
        <button class="nav-btn" on:click={nextMonth} aria-label="Next month">›</button>
      </div>
    {:else}
      <div class="nav-placeholder"></div>
    {/if}
  </div>

  {#if !collapsed}
    <!-- Day header -->
    <div class="day-header">
      {#each DAY_LABELS as lbl, i}
        <span class="day-hdr" class:hdr-weekend={i >= 5}>{lbl}</span>
      {/each}
    </div>

    <!-- Weeks grid -->
    {#each grid as week}
      <div class="week-row">
        {#each week as date}
          {#if date}
            {@const status = getDayStatus(date, $appState)}
            {@const selected = isSelected(date, $uiState)}
            {@const today = isToday(date)}
            <button
              class="day-cell status-{status}"
              class:selected
              class:today
              on:click={() => selectDay(date)}
            >
              <span class="day-num">{date.getDate()}</span>
              {#if status === 'done'}
                <span class="status-mark">✓</span>
              {:else if status === 'partial'}
                <span class="status-mark partial-mark">◑</span>
              {:else if status === 'has-data'}
                <span class="status-dot"></span>
              {:else if status === 'active-recovery'}
                <span class="status-mark rec">○</span>
              {:else if status === 'rest'}
                <span class="status-mark rest-mark">–</span>
              {:else if status === 'weekend'}
                <span class="status-mark wknd">–</span>
              {/if}
            </button>
          {:else}
            <div class="day-cell empty"></div>
          {/if}
        {/each}
      </div>
    {/each}

    <!-- Legend -->
    <div class="legend">
      <span class="leg-item"><span class="leg-swatch done-sw">✓</span>Done</span>
      <span class="leg-item"><span class="leg-swatch data-sw"></span>Workout</span>
      <span class="leg-item"><span class="leg-swatch rec-sw">○</span>Recovery</span>
      <span class="leg-item"><span class="leg-swatch rest-sw"></span>Rest</span>
    </div>
  {/if}
</div>

<style>
  .month-cal {
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border: 1px solid rgba(var(--c-edge-d), 0.18);
    border-radius: 18px;
    padding: 12px 12px 10px;
    display: grid;
    gap: 6px;
    transition: gap 0.2s;
  }

  .month-cal.collapsed {
    gap: 0;
    padding: 10px 12px;
  }

  /* ---- Header row ---- */
  .month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    border: 1px solid rgba(var(--c-edge-e), 0.24);
    background: rgba(var(--c-surface-c), 0.65);
    color: rgba(var(--c-fg), 0.70);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .nav-btn:active { background: rgba(var(--c-fg), 0.10); }

  .nav-placeholder { width: 32px; flex-shrink: 0; }

  .month-nav-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  .today-month-btn {
    padding: 5px 10px;
    border-radius: 9px;
    border: 1px solid rgba(var(--c-fg), 0.18);
    background: rgba(var(--c-fg), 0.07);
    color: rgba(var(--c-fg), 0.65);
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    letter-spacing: 0.02em;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .today-month-btn:active { background: rgba(var(--c-fg), 0.14); color: var(--h-ffffff); }

  .month-label-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    padding: 4px 8px;
    border-radius: 8px;
  }

  .month-label-btn:active { background: rgba(var(--c-surface-c), 0.65); }

  .month-label {
    font-size: 14px;
    font-weight: 800;
    color: var(--h-ffffff);
    letter-spacing: -0.01em;
    user-select: none;
  }

  .chevron {
    font-size: 14px;
    color: rgba(var(--c-fg), 0.40);
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s ease;
    user-select: none;
    line-height: 1;
  }

  .chevron.open { transform: rotate(-90deg); }

  /* ---- Day header ---- */
  .day-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .day-hdr {
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    color: rgba(var(--c-fg), 0.45);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 0;
  }

  .day-hdr.hdr-weekend { color: rgba(var(--c-fg), 0.25); }

  /* ---- Week row ---- */
  .week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  /* ---- Day cell base ---- */
  .day-cell {
    aspect-ratio: 1;
    border-radius: 9px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s, border-color 0.1s;
    position: relative;
  }

  .day-cell.empty { cursor: default; }

  .day-num {
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
  }

  /* ---- Status styles — Monochrome + single gold (palette B) ---- */

  /* Done: green — fully completed */
  .status-done {
    background: var(--h-2e7d57);
    border-color: var(--h-3fa06f);
  }
  .status-done .day-num { color: var(--h-eafff5); }

  /* Partial: amber/yellow — started but not finished */
  .status-partial {
    background: var(--h-2f5bd0);
    border-color: var(--h-5b82e6);
  }
  .status-partial .day-num { color: var(--h-eaf1ff); }

  /* Has-data: workout logged, not fully done — slightly lighter white */
  .status-has-data {
    background: var(--h-2f5bd0);
    border-color: var(--h-5b82e6);
  }
  .status-has-data .day-num { color: var(--h-eaf1ff); }

  /* Active recovery — gentle amber tint, same family as gold */
  .status-active-recovery {
    background: var(--h-a8741f);
    border-color: var(--h-cf9433);
  }
  .status-active-recovery .day-num { color: var(--h-fff6e6); }

  /* Weekend — dim but readable */
  .status-weekend .day-num { color: rgba(var(--c-fg), 0.22); }

  /* Rest: explicitly marked rest day — distinct violet */
  .status-rest {
    background: var(--h-544aa0);
    border-color: var(--h-7d72c4);
  }
  .status-rest .day-num { color: var(--h-f1eeff); }
  .rest-mark { color: var(--h-f1eeff); font-weight: 700; font-size: 12px; line-height: 1; }

  /* Future — visible but clearly lighter than past */
  .status-future .day-num { color: rgba(var(--c-fg), 0.18); }
  .status-future { cursor: pointer; }

  /* Unmarked day — neutral, empty look (no marker) */
  .status-neutral .day-num { color: rgba(var(--c-fg), 0.30); }
  .status-neutral { cursor: pointer; }

  /* Today — solid gold, THE single strong accent */
  .today {
    box-shadow: inset 0 0 0 2px var(--c-accent-solid) !important;
    border-color: var(--c-accent-solid) !important;
  }
  .today .day-num { color: var(--h-ffffff) !important; font-weight: 900 !important; }

  /* Selected — white ring, distinct from today (today's gold ring wins when both) */
  .selected {
    box-shadow: inset 0 0 0 2px rgba(var(--c-fg), 0.55);
    border-color: rgba(var(--c-fg), 0.45);
  }
  .selected .day-num { color: var(--h-ffffff); }

  /* Status marks */
  .status-mark {
    font-size: 11px;
    font-weight: 900;
    line-height: 1;
    color: rgba(var(--c-fg), 0.85);
  }

  .status-done .status-mark { color: var(--h-eafff5); }
  .partial-mark { color: var(--h-c6f2db) !important; font-size: 12px; }

  .status-mark.rec  { color: var(--h-fff6e6); font-weight: 400; font-size: 12px; }
  .status-mark.wknd { color: var(--h-182438); font-weight: 600; font-size: 11px; }

  .status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--h-dbe6ff);
  }

  /* ---- Legend ---- */
  .legend {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    padding-top: 4px;
    border-top: 1px solid rgba(var(--c-edge-a), 0.13);
    margin-top: 2px;
  }

  .leg-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: rgba(var(--c-fg), 0.45);
    font-weight: 600;
  }

  .leg-swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 900;
  }

  .done-sw    { background: var(--h-2e7d57); border: 1px solid var(--h-3fa06f); color: var(--h-eafff5); }
  .partial-sw { background: rgba(var(--c-accent), 0.10); border: 1px solid rgba(var(--c-accent), 0.30); color: var(--c-accent-solid); font-size: 10px; }
  .data-sw  { background: var(--h-2f5bd0); border: 1px solid var(--h-5b82e6); }
  .data-sw::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--h-dbe6ff); }
  .rec-sw   { background: var(--h-a8741f); border: 1px solid var(--h-cf9433); color: var(--h-fff6e6); font-size: 10px; }
  .wknd-sw  { background: transparent; border: 1px solid rgba(var(--c-fg), 0.10); color: var(--h-2e4060); font-size: 10px; }
  .rest-sw  { background: var(--h-544aa0); border: 1px solid var(--h-7d72c4); }
  @media (min-width: 640px) {
    .month-label { font-size: 17px; }
    .day-num { font-size: 17px; }
    .day-hdr { font-size: 13px; }
    .day-cell { border-radius: 11px; }
    .status-mark { font-size: 13px; }
    .leg-item { font-size: 12px; }
    .nav-btn { width: 38px; height: 38px; font-size: 20px; }
  }

  /* Presentation mode: keep every date legible on transparent/light cells too */
  :root[data-theme="presentation"] .status-weekend .day-num,
  :root[data-theme="presentation"] .status-future .day-num,
  :root[data-theme="presentation"] .status-neutral .day-num {
    color: rgba(13, 26, 46, 0.62);
  }
  :root[data-theme="presentation"] .status-mark.wknd {
    color: rgba(13, 26, 46, 0.55);
  }
</style>
