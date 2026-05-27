<script lang="ts">
  import { DAY_ORDER, type DayOfWeek } from '../types/workout';
  import { uiState, appState, availableWeeks, currentWeekDays, updateUI, addNewWeek } from '../stores/app';

  const DAY_SHORT: Record<DayOfWeek, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };

  function hasDayData(day: DayOfWeek): boolean {
    return $currentWeekDays.some(w => w.day === day && w.exercises.length > 0);
  }

  function selectDay(day: DayOfWeek) {
    updateUI(ui => ({ ...ui, day }));
  }

  function prevWeek() {
    const idx = $availableWeeks.indexOf($uiState.week);
    if (idx > 0) updateUI(ui => ({ ...ui, week: $availableWeeks[idx - 1] }));
  }

  function nextWeek() {
    const idx = $availableWeeks.indexOf($uiState.week);
    if (idx < $availableWeeks.length - 1) updateUI(ui => ({ ...ui, week: $availableWeeks[idx + 1] }));
  }

  $: canPrev = $availableWeeks.indexOf($uiState.week) > 0;
  $: canNext = $availableWeeks.indexOf($uiState.week) < $availableWeeks.length - 1;
  $: isLastWeek = !canNext;
  $: weekLabel = `Week ${$uiState.week}`;
</script>

<div class="calendar-card">
  <div class="week-nav">
    <button class="nav-btn" on:click={prevWeek} disabled={!canPrev} aria-label="Previous week">‹</button>
    <span class="week-label">{weekLabel}</span>
    <button class="nav-btn" on:click={nextWeek} disabled={!canNext} aria-label="Next week">›</button>
    {#if isLastWeek}
      <button class="new-week-btn" on:click={addNewWeek} aria-label="New week">+ Week</button>
    {/if}
  </div>

  <div class="day-pills">
    {#each DAY_ORDER as day}
      {@const active = $uiState.day === day}
      {@const hasData = hasDayData(day)}
      <button
        class="pill"
        class:active
        class:has-data={hasData}
        on:click={() => selectDay(day)}
        aria-pressed={active}
      >
        <span class="pill-label">{DAY_SHORT[day]}</span>
        {#if hasData}
          <span class="pill-dot" aria-hidden="true"></span>
        {/if}
      </button>
    {/each}
  </div>

</div>

<style>
  .calendar-card {
    background: linear-gradient(180deg, #0f1c30, #0b1726);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 16px 14px 14px;
    display: grid;
    gap: 14px;
  }

  .week-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .week-label {
    font-size: 14px;
    font-weight: 700;
    color: #c8ddf4;
    letter-spacing: -0.01em;
    flex: 1;
    text-align: center;
  }

  .nav-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(12,22,48,0.55);
    color: rgba(255,255,255,0.60);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .nav-btn:not(:disabled):active { background: rgba(15,28,58,0.80); }

  .new-week-btn {
    padding: 6px 12px;
    border-radius: 10px;
    border: 1px solid rgba(196,148,46,0.28);
    background: rgba(196,148,46,0.09);
    color: #c49230;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    letter-spacing: 0.02em;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .new-week-btn:active { background: rgba(196,148,46,0.18); }

  .day-pills {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 5px;
  }

  .pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 2px;
    border-radius: 12px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }

  .pill.has-data { background: rgba(12,20,44,0.50); }

  .pill.active {
    background: linear-gradient(180deg, rgba(196,148,46,0.18), rgba(255,159,10,0.10));
    border-color: rgba(196,148,46,0.35);
  }

  .pill-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #5a7a9a;
    text-transform: uppercase;
  }

  .pill.has-data .pill-label { color: #97b8d8; }
  .pill.active .pill-label  { color: #c49230; }

  .pill-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255,255,255,0.30);
  }

  .pill.active .pill-dot { background: #c49230; }
</style>
