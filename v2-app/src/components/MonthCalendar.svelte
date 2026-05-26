<script lang="ts">
  import { DAY_ORDER, type DayOfWeek } from '../types/workout';
  import { appState, uiState, updateUI } from '../stores/app';

  // Program anchor — Monday of week 1
  const PROGRAM_START = new Date('2026-02-16T00:00:00');

  // Map a JS Date → program { week, day } or null if before program start
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

    const workoutDay = $appState.weeks.find(
      w => w.week === wd.week && w.day === wd.day
    );
    if (!workoutDay || workoutDay.exercises.length === 0) return 'rest';

    const nonRecovery = workoutDay.exercises.filter(e => !e.recovery);
    const hasRecovery = workoutDay.exercises.some(e => e.recovery && e.recoveryDone);

    if (nonRecovery.length === 0) {
      return hasRecovery ? 'active-recovery' : 'has-data';
    }

    const allSetsDone = nonRecovery.every(
      ex => ex.sets.length > 0 && ex.sets.every(s => s.done)
    );

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
    return (
      date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate()
    );
  }

  // ---- Month navigation ----
  // Start from current selected week's month
  function weekToDate(week: number, day: DayOfWeek): Date {
    const dayIdx = DAY_ORDER.indexOf(day);
    const d = new Date(PROGRAM_START);
    d.setDate(d.getDate() + (week - 1) * 7 + dayIdx);
    return d;
  }

  function getMonthStart(): Date {
    const ref = weekToDate($uiState.week, $uiState.day);
    return new Date(ref.getFullYear(), ref.getMonth(), 1);
  }

  let viewYear: number;
  let viewMonth: number; // 0-based

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

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

  // Build calendar grid — ISO weeks (Mon first)
  function buildGrid(year: number, month: number): (Date | null)[][] {
    const firstDay = new Date(year, month, 1);
    // JS: 0=Sun,1=Mon,...,6=Sat → convert to Mon=0
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

<div class="month-cal">
  <!-- Month nav -->
  <div class="month-nav">
    <button class="nav-btn" on:click={prevMonth} aria-label="Previous month">‹</button>
    <span class="month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
    <button class="nav-btn" on:click={nextMonth} aria-label="Next month">›</button>
  </div>

  <!-- Day header -->
  <div class="day-header">
    {#each DAY_LABELS as lbl}
      <span class="day-hdr">{lbl}</span>
    {/each}
  </div>

  <!-- Weeks -->
  {#each grid as week}
    <div class="week-row">
      {#each week as date}
        {#if date}
          {@const status = getDayStatus(date)}
          {@const selected = isSelected(date)}
          {@const today = isToday(date)}
          <button
            class="day-cell"
            class:selected
            class:today
            class:done={status === 'done'}
            class:active-recovery={status === 'active-recovery'}
            class:has-data={status === 'has-data'}
            class:rest={status === 'rest'}
            class:future={status === 'future'}
            on:click={() => selectDay(date)}
          >
            <span class="day-num">{date.getDate()}</span>
            {#if status === 'done'}
              <span class="status-dot done-dot">✓</span>
            {:else if status === 'active-recovery'}
              <span class="status-dot rec-dot">○</span>
            {:else if status === 'has-data'}
              <span class="status-dot data-dot"></span>
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
    <span class="leg-item"><span class="leg-dot done-bg">✓</span> Done</span>
    <span class="leg-item"><span class="leg-dot rec-bg">○</span> Recovery</span>
    <span class="leg-item"><span class="leg-dot data-bg"></span> Logged</span>
    <span class="leg-item"><span class="leg-dot rest-bg"></span> Rest</span>
  </div>
</div>

<style>
  .month-cal {
    background: linear-gradient(180deg, #131f32, #0e1b2c);
    border: 1px solid rgba(255,255,255,0.11);
    border-radius: 18px;
    padding: 14px 12px 12px;
    display: grid;
    gap: 8px;
  }

  /* Month nav */
  .month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .month-label {
    font-size: 14px;
    font-weight: 800;
    color: #c8ddf4;
    letter-spacing: -0.01em;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: #7fa8d4;
    font-size: 17px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .nav-btn:active { background: rgba(255,255,255,0.09); }

  /* Day header row */
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
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 0 4px;
  }

  /* Week row */
  .week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  /* Day cell */
  .day-cell {
    aspect-ratio: 1;
    border-radius: 10px;
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
    transition: background 0.12s, border-color 0.12s;
    position: relative;
  }

  .day-cell.empty { cursor: default; }

  .day-num {
    font-size: 13px;
    font-weight: 700;
    color: #4a7090;
    line-height: 1;
  }

  /* Status variants */
  .day-cell.has-data .day-num  { color: #7fa8d4; }
  .day-cell.done .day-num      { color: #4fc08d; }
  .day-cell.active-recovery .day-num { color: #ffc247; }
  .day-cell.rest .day-num      { color: #3a5878; }
  .day-cell.future .day-num    { color: #2a4060; }

  .day-cell.done            { background: rgba(79,192,141,0.08); border-color: rgba(79,192,141,0.20); }
  .day-cell.active-recovery { background: rgba(255,194,71,0.08); border-color: rgba(255,194,71,0.20); }
  .day-cell.has-data        { background: rgba(127,178,255,0.06); border-color: rgba(127,178,255,0.14); }

  .day-cell.today {
    border-color: rgba(255,255,255,0.22) !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10);
  }

  .day-cell.selected {
    background: rgba(255,194,71,0.16) !important;
    border-color: rgba(255,194,71,0.45) !important;
  }

  .day-cell.selected .day-num { color: #ffc247 !important; }

  /* Status dots */
  .status-dot {
    font-size: 8px;
    line-height: 1;
  }

  .done-dot  { color: #4fc08d; font-size: 9px; font-weight: 900; }
  .rec-dot   { color: #ffc247; font-size: 9px; }

  .data-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #4a7aaa;
  }

  /* Legend */
  .legend {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 2px;
    flex-wrap: wrap;
  }

  .leg-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #4a7090;
    font-weight: 600;
  }

  .leg-dot {
    font-size: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 4px;
  }

  .done-bg { color: #4fc08d; background: rgba(79,192,141,0.12); }
  .rec-bg  { color: #ffc247; background: rgba(255,194,71,0.12); }
  .data-bg {
    background: rgba(127,178,255,0.10);
  }
  .data-bg::after {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #4a7aaa;
  }
  .rest-bg { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
</style>
