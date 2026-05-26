<script lang="ts">
  import { DAY_ORDER, type DayOfWeek } from '../types/workout';
  import { appState, uiState, updateUI } from '../stores/app';

  const PROGRAM_START = new Date('2026-02-16T00:00:00');

  function dateToWeekDay(date: Date): { week: number; day: DayOfWeek } | null {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.floor((date.getTime() - PROGRAM_START.getTime()) / msPerDay);
    if (diff < 0) return null;
    const week = Math.floor(diff / 7) + 1;
    const dayIdx = diff % 7;
    return { week, day: DAY_ORDER[dayIdx] };
  }

  type DayStatus = 'done' | 'active-recovery' | 'has-data' | 'rest' | 'future';

  function getDayStatus(date: Date): DayStatus {
    const wd = dateToWeekDay(date);
    if (!wd) return 'future';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) return 'future';

    const workoutDay = $appState.weeks.find(w => w.week === wd.week && w.day === wd.day);
    if (!workoutDay || workoutDay.exercises.length === 0) return 'rest';

    const nonRecovery = workoutDay.exercises.filter(e => !e.recovery);
    const hasRecovery = workoutDay.exercises.some(e => e.recovery && e.recoveryDone);

    if (nonRecovery.length === 0) return hasRecovery ? 'active-recovery' : 'has-data';

    const allSetsDone = nonRecovery.every(ex => ex.sets.length > 0 && ex.sets.every(s => s.done));
    if (allSetsDone) return 'done';
    if (hasRecovery) return 'active-recovery';
    return 'has-data';
  }

  function selectDay(date: Date) {
    const wd = dateToWeekDay(date);
    if (!wd) return;
    updateUI(ui => ({ ...ui, week: wd.week, day: wd.day }));
  }

  function isSelected(date: Date): boolean {
    const wd = dateToWeekDay(date);
    if (!wd) return false;
    return wd.week === $uiState.week && wd.day === $uiState.day;
  }

  function isToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate();
  }

  // Month navigation
  function weekToDate(week: number, day: DayOfWeek): Date {
    const dayIdx = DAY_ORDER.indexOf(day);
    const d = new Date(PROGRAM_START);
    d.setDate(d.getDate() + (week - 1) * 7 + dayIdx);
    return d;
  }

  let viewYear: number;
  let viewMonth: number;

  $: {
    const ref = weekToDate($uiState.week, $uiState.day);
    viewYear = ref.getFullYear();
    viewMonth = ref.getMonth();
  }

  function prevMonth() {
    if (viewMonth === 0) { viewYear -= 1; viewMonth = 11; }
    else viewMonth -= 1;
  }

  function nextMonth() {
    if (viewMonth === 11) { viewYear += 1; viewMonth = 0; }
    else viewMonth += 1;
  }

  function toggleCollapsed() {
    updateUI(ui => ({ ...ui, calendarCollapsed: !ui.calendarCollapsed }));
  }

  $: collapsed = $uiState.calendarCollapsed;

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

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
      <button class="nav-btn" on:click={nextMonth} aria-label="Next month">›</button>
    {:else}
      <div class="nav-placeholder"></div>
    {/if}
  </div>

  {#if !collapsed}
    <!-- Day header -->
    <div class="day-header">
      {#each DAY_LABELS as lbl}
        <span class="day-hdr">{lbl}</span>
      {/each}
    </div>

    <!-- Weeks grid -->
    {#each grid as week}
      <div class="week-row">
        {#each week as date}
          {#if date}
            {@const status = getDayStatus(date)}
            {@const selected = isSelected(date)}
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
              {:else if status === 'has-data'}
                <span class="status-dot"></span>
              {:else if status === 'active-recovery'}
                <span class="status-mark rec">○</span>
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
    background: linear-gradient(180deg, #131f32, #0e1b2c);
    border: 1px solid rgba(255,255,255,0.11);
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
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.70);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .nav-btn:active { background: rgba(255,255,255,0.10); }

  .nav-placeholder {
    width: 32px;
    flex-shrink: 0;
  }

  /* Month label + toggle */
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

  .month-label-btn:active { background: rgba(255,255,255,0.05); }

  .month-label {
    font-size: 14px;
    font-weight: 800;
    color: #c8ddf4;
    letter-spacing: -0.01em;
    user-select: none;
  }

  .chevron {
    font-size: 14px;
    color: rgba(255,255,255,0.40);
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s ease;
    user-select: none;
    line-height: 1;
  }

  .chevron.open {
    transform: rotate(-90deg);
  }

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
    color: #4a7090;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 0 2px;
  }

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
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
  }

  /* ---- Status styles ---- */

  /* Done: all sets ticked — green, prominent */
  .status-done {
    background: rgba(79,192,141,0.22);
    border-color: rgba(79,192,141,0.50);
  }
  .status-done .day-num { color: #4fc08d; }

  /* Has-data: workout logged, not fully done — blue */
  .status-has-data {
    background: rgba(127,178,255,0.16);
    border-color: rgba(127,178,255,0.35);
  }
  .status-has-data .day-num { color: #7fb2ff; }

  /* Active recovery — amber */
  .status-active-recovery {
    background: rgba(255,194,71,0.16);
    border-color: rgba(255,194,71,0.36);
  }
  .status-active-recovery .day-num { color: #ffc247; }

  /* Rest: past day, no data — dim, no background */
  .status-rest .day-num { color: #3a5878; }

  /* Future: upcoming — very dim */
  .status-future .day-num { color: #243650; }
  .status-future { cursor: default; }

  /* Today ring */
  .today {
    box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.28) !important;
    border-color: rgba(255,255,255,0.28) !important;
  }

  /* Selected — gold override */
  .selected {
    background: rgba(255,194,71,0.20) !important;
    border-color: rgba(255,194,71,0.55) !important;
  }
  .selected .day-num { color: #ffc247 !important; }

  /* Status marks */
  .status-mark {
    font-size: 9px;
    font-weight: 900;
    line-height: 1;
    color: #4fc08d;
  }

  .status-mark.rec { color: #ffc247; font-weight: 400; }

  .status-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #5a8aff;
  }

  /* ---- Legend ---- */
  .legend {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    padding-top: 2px;
    border-top: 1px solid rgba(255,255,255,0.06);
    margin-top: 2px;
  }

  .leg-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #4a7090;
    font-weight: 600;
  }

  .leg-swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 5px;
    font-size: 9px;
    font-weight: 900;
  }

  .done-sw  { background: rgba(79,192,141,0.22); border: 1px solid rgba(79,192,141,0.50); color: #4fc08d; }
  .data-sw  { background: rgba(127,178,255,0.16); border: 1px solid rgba(127,178,255,0.35); }
  .data-sw::after { content: ''; width: 4px; height: 4px; border-radius: 50%; background: #5a8aff; }
  .rec-sw   { background: rgba(255,194,71,0.16); border: 1px solid rgba(255,194,71,0.36); color: #ffc247; font-size: 10px; }
  .rest-sw  { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
</style>
