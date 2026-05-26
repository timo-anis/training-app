<script lang="ts">
  import { appState } from '../stores/app';
  import type { WorkoutDay } from '../types/workout';

  // ---- Per-week stats ----
  interface WeekStat {
    week: number;
    days: number;
    setsDone: number;
    volume: number; // kg × reps, done sets only
  }

  function computeWeekStats(weeks: WorkoutDay[]): WeekStat[] {
    const map = new Map<number, WeekStat>();

    for (const wd of weeks) {
      if (!map.has(wd.week)) {
        map.set(wd.week, { week: wd.week, days: 0, setsDone: 0, volume: 0 });
      }
      const stat = map.get(wd.week)!;

      const hasExercises = wd.exercises.some(ex => !ex.recovery && ex.sets.length > 0);
      if (hasExercises) stat.days++;

      for (const ex of wd.exercises) {
        if (ex.recovery) continue;
        for (const s of ex.sets) {
          if (!s.done) continue;
          stat.setsDone++;
          const kg = parseFloat(s.kg);
          const reps = parseInt(s.reps);
          if (!isNaN(kg) && !isNaN(reps)) stat.volume += kg * reps;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.week - a.week);
  }

  // ---- Exercise frequency ----
  interface ExFreq {
    name: string;
    count: number; // how many days it appeared
    totalSets: number;
  }

  function computeExFreq(weeks: WorkoutDay[]): ExFreq[] {
    const map = new Map<string, ExFreq>();

    for (const wd of weeks) {
      for (const ex of wd.exercises) {
        if (ex.recovery) continue;
        const key = ex.name.toLowerCase();
        if (!map.has(key)) map.set(key, { name: ex.name, count: 0, totalSets: 0 });
        const f = map.get(key)!;
        f.count++;
        f.totalSets += ex.sets.length;
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }

  function fmtVolume(v: number): string {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
    return `${Math.round(v)}kg`;
  }

  $: weekStats = computeWeekStats($appState.weeks);
  $: exFreq = computeExFreq($appState.weeks);
  $: totalWeeks = weekStats.length;
  $: totalSets = weekStats.reduce((s, w) => s + w.setsDone, 0);
  $: totalVolume = weekStats.reduce((s, w) => s + w.volume, 0);
</script>

<div class="stats-view">
  <!-- Summary chips -->
  <div class="summary-row">
    <div class="chip">
      <span class="chip-val">{totalWeeks}</span>
      <span class="chip-lbl">Weeks</span>
    </div>
    <div class="chip">
      <span class="chip-val">{totalSets}</span>
      <span class="chip-lbl">Sets done</span>
    </div>
    <div class="chip">
      <span class="chip-val">{fmtVolume(totalVolume)}</span>
      <span class="chip-lbl">Volume</span>
    </div>
  </div>

  <!-- Weekly breakdown -->
  <div class="section-head">Weekly breakdown</div>
  {#if weekStats.length === 0}
    <div class="empty">No data yet.</div>
  {:else}
    <div class="week-list">
      {#each weekStats as w}
        <div class="week-row">
          <span class="week-num">W{w.week}</span>
          <div class="week-bars">
            <span class="week-stat">
              <span class="wlbl">Days</span>
              <span class="wval">{w.days}</span>
            </span>
            <span class="week-stat">
              <span class="wlbl">Sets</span>
              <span class="wval">{w.setsDone}</span>
            </span>
            <span class="week-stat">
              <span class="wlbl">Volume</span>
              <span class="wval">{fmtVolume(w.volume)}</span>
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Exercise frequency -->
  <div class="section-head">Most trained</div>
  {#if exFreq.length === 0}
    <div class="empty">No exercises logged.</div>
  {:else}
    <div class="freq-list">
      {#each exFreq as ex, i}
        <div class="freq-row">
          <span class="freq-rank">{i + 1}</span>
          <span class="freq-name">{ex.name}</span>
          <span class="freq-count">{ex.count}×</span>
          <span class="freq-sets">{ex.totalSets} sets</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .stats-view {
    padding: 14px 14px 100px;
    display: grid;
    gap: 0;
  }

  /* Summary chips */
  .summary-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }

  .chip {
    background: linear-gradient(180deg, #0f1c30, #0b1726);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .chip-val {
    font-size: 22px;
    font-weight: 900;
    color: #ffc247;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .chip-lbl {
    font-size: 10px;
    font-weight: 700;
    color: #3a5a7a;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Section head */
  .section-head {
    font-size: 11px;
    font-weight: 800;
    color: #3a5a7a;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }

  .empty {
    font-size: 13px;
    color: #3a5a7a;
    padding: 20px 0;
    text-align: center;
  }

  /* Weekly list */
  .week-list {
    display: grid;
    gap: 6px;
    margin-bottom: 24px;
  }

  .week-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(180deg, #0f1c30, #0b1726);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 12px 14px;
  }

  .week-num {
    font-size: 13px;
    font-weight: 900;
    color: #ffc247;
    width: 28px;
    flex-shrink: 0;
    letter-spacing: -0.01em;
  }

  .week-bars {
    flex: 1 1 0;
    display: flex;
    gap: 14px;
  }

  .week-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .wlbl {
    font-size: 9px;
    font-weight: 700;
    color: #2a4a6a;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .wval {
    font-size: 14px;
    font-weight: 800;
    color: #c8ddf4;
    letter-spacing: -0.02em;
  }

  /* Exercise frequency */
  .freq-list {
    display: grid;
    gap: 5px;
    margin-bottom: 20px;
  }

  .freq-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 14px;
    background: linear-gradient(180deg, #0f1c30, #0b1726);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
  }

  .freq-rank {
    font-size: 11px;
    font-weight: 900;
    color: #2a4a6a;
    width: 16px;
    flex-shrink: 0;
    text-align: right;
  }

  .freq-name {
    flex: 1 1 0;
    font-size: 14px;
    font-weight: 700;
    color: #c8ddf4;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .freq-count {
    font-size: 13px;
    font-weight: 800;
    color: #ffc247;
    flex-shrink: 0;
  }

  .freq-sets {
    font-size: 11px;
    font-weight: 600;
    color: #2a4a6a;
    flex-shrink: 0;
    min-width: 44px;
    text-align: right;
  }
</style>
