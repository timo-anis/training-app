<script lang="ts">
  import { appState } from '../stores/app';
  import type { WorkoutDay } from '../types/workout';
  import BodyMap from './BodyMap.svelte';

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

  // Collapse/expand
  const PREVIEW = 3;
  let weekExpanded = false;
  let exExpanded = false;
  $: weekHidden = Math.max(0, weekStats.length - PREVIEW);
  $: exHidden = Math.max(0, exFreq.length - PREVIEW);
  $: displayedWeeks = weekExpanded ? weekStats : weekStats.slice(0, PREVIEW);
  $: displayedEx = exExpanded ? exFreq : exFreq.slice(0, PREVIEW);
</script>

<div class="stats-view">
  <!-- Body map -->

  <div class="section-head">Muscle groups</div>
  <div class="bodymap-wrap">
    <BodyMap />
  </div>

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
      {#each displayedWeeks as w}
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
    {#if weekHidden > 0 || weekExpanded}
      <button class="expand-btn" on:click={() => weekExpanded = !weekExpanded}>
        <span class="expand-chevron" class:open={weekExpanded}>›</span>
        {weekExpanded ? 'Show less' : `${weekHidden} more week${weekHidden > 1 ? 's' : ''}`}
      </button>
    {/if}
  {/if}

  <!-- Exercise frequency -->
  <div class="section-head">Most trained</div>
  {#if exFreq.length === 0}
    <div class="empty">No exercises logged.</div>
  {:else}
    <div class="freq-list">
      {#each displayedEx as ex, i}
        <div class="freq-row">
          <span class="freq-rank">{i + 1}</span>
          <span class="freq-name">{ex.name}</span>
          <span class="freq-count">{ex.count}×</span>
          <span class="freq-sets">{ex.totalSets} sets</span>
        </div>
      {/each}
    </div>
    {#if exHidden > 0 || exExpanded}
      <button class="expand-btn" on:click={() => exExpanded = !exExpanded}>
        <span class="expand-chevron" class:open={exExpanded}>›</span>
        {exExpanded ? 'Show less' : `${exHidden} more`}
      </button>
    {/if}
  {/if}
</div>

<style>
  .stats-view {
    padding: 14px 14px 100px;
    display: grid;
    gap: 0;
  }

  /* Body map wrapper */
  .bodymap-wrap {
    margin-bottom: 28px;
  }

  /* Summary chips */
  .summary-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }

  .chip {
    background: linear-gradient(160deg, #0d1a30, #080e1c);
    border: 1px solid rgba(70,110,185,0.22);
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
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.38);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Section head */
  .section-head {
    font-size: 12px;
    font-weight: 800;
    color: rgba(255,255,255,0.38);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }

  .empty {
    font-size: 13px;
    color: #2a4880;
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
    background: linear-gradient(160deg, #0d1a30, #080e1c);
    border: 1px solid rgba(70,110,185,0.22);
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
    font-size: 10px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .wval {
    font-size: 14px;
    font-weight: 800;
    color: #c8ddf4;
    letter-spacing: -0.02em;
  }

  /* Expand toggle */
  .expand-btn {
    width: 100%;
    padding: 11px;
    border-radius: 12px;
    border: 1px solid rgba(65,100,175,0.18);
    background: transparent;
    color: rgba(255,255,255,0.38);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 2px;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .expand-btn:active { background: rgba(14,25,55,0.65); color: rgba(255,255,255,0.60); }

  .expand-chevron {
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.2s;
    font-size: 15px;
    line-height: 1;
  }

  .expand-chevron.open { transform: rotate(-90deg); }

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
    background: linear-gradient(160deg, #0d1a30, #080e1c);
    border: 1px solid rgba(70,110,185,0.22);
    border-radius: 12px;
  }

  .freq-rank {
    font-size: 12px;
    font-weight: 900;
    color: rgba(255,255,255,0.30);
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
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.35);
    flex-shrink: 0;
    min-width: 44px;
    text-align: right;
  }
</style>
