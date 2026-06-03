<script lang="ts">
  import { appState, weekOffset } from '../stores/app';
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

  // Volume sparkline — last 8 weeks, oldest first
  $: sparkBars = weekStats.slice(0, 8).reverse();
  $: sparkMax = Math.max(...sparkBars.map(w => w.volume), 1);

  // Collapse/expand
  const PREVIEW = 3;
  let weekExpanded = false;
  let exExpanded = false;
  $: weekHidden = Math.max(0, weekStats.length - PREVIEW);
  $: exHidden = Math.max(0, exFreq.length - PREVIEW);
  $: displayedWeeks = weekExpanded ? weekStats : weekStats.slice(0, PREVIEW);
  $: displayedEx = exExpanded ? exFreq : exFreq.slice(0, PREVIEW);

  // ---- #7 Per-exercise progression chart ----
  let selectedExForChart: string | null = null;

  interface ExSession { week: number; label: string; maxKg: number; }

  function getExerciseHistory(name: string, allWeeks: WorkoutDay[]): ExSession[] {
    const weekMap = new Map<number, ExSession>();
    for (const wd of allWeeks) {
      for (const ex of wd.exercises) {
        if (ex.name.toLowerCase() !== name.toLowerCase()) continue;
        if (ex.recovery || ex.conditioning) continue;
        const doneSets = ex.sets.filter(s => s.done && parseFloat(s.kg) > 0);
        if (doneSets.length === 0) continue;
        const maxKg = Math.max(...doneSets.map(s => parseFloat(s.kg)));
        const existing = weekMap.get(wd.week);
        if (!existing || maxKg > existing.maxKg) weekMap.set(wd.week, { week: wd.week, label: `W${wd.week - $weekOffset}`, maxKg });
      }
    }
    return Array.from(weekMap.values()).sort((a, b) => a.week - b.week);
  }

  // ---- #4 Plateau detection ----
  function hasPlateau(name: string, allWeeks: WorkoutDay[]): boolean {
    const hist = getExerciseHistory(name, allWeeks);
    if (hist.length < 3) return false;
    const last3 = hist.slice(-3).map(s => s.maxKg);
    return last3.every(kg => kg === last3[0]);
  }

  $: plateauSet = new Set(
    exFreq.filter(e => hasPlateau(e.name, $appState.weeks)).map(e => e.name.toLowerCase())
  );
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

  <!-- Volume sparkline -->
  {#if sparkBars.length > 0}
    <div class="section-head">Volume trend</div>
    <div class="sparkline-card">
      <div class="spark-bars">
        {#each sparkBars as w}
          {@const barH = Math.max(4, Math.round((w.volume / sparkMax) * 56))}
          <div class="spark-col">
            <span class="spark-val">{w.volume > 0 ? fmtVolume(w.volume) : ''}</span>
            <div class="spark-bar-wrap">
              <div
                class="spark-bar"
                class:active={w.volume > 0}
                style="height: {barH}px"
              ></div>
            </div>
            <span class="spark-lbl">W{w.week - $weekOffset}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Weekly breakdown -->
  <div class="section-head">Weekly breakdown</div>
  {#if weekStats.length === 0}
    <div class="empty">No data yet.</div>
  {:else}
    <div class="week-list">
      {#each displayedWeeks as w}
        <div class="week-row">
          <span class="week-num">W{w.week - $weekOffset}</span>
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
        {@const isSelected = selectedExForChart === ex.name}
        {@const isPlateau = plateauSet.has(ex.name.toLowerCase())}
        <div class="freq-row" class:freq-row-selected={isSelected}>
          <span class="freq-rank">{i + 1}</span>
          <button
            class="freq-name-btn"
            on:click={() => selectedExForChart = isSelected ? null : ex.name}
          >
            {ex.name}
            {#if isPlateau}<span class="plateau-badge" title="No weight increase in last 3 sessions">→</span>{/if}
          </button>
          <span class="freq-count">{ex.count}×</span>
          <span class="freq-sets">{ex.totalSets} sets</span>
        </div>
        {#if isSelected}
          {@const hist = getExerciseHistory(ex.name, $appState.weeks).slice(-8)}
          {@const histMax = Math.max(...hist.map(h => h.maxKg), 1)}
          {#if hist.length > 0}
            <div class="ex-chart">
              <div class="ex-chart-bars">
                {#each hist as h}
                  {@const barH = Math.max(4, Math.round((h.maxKg / histMax) * 52))}
                  <div class="ex-chart-col">
                    <span class="ex-chart-val">{h.maxKg}kg</span>
                    <div class="ex-chart-bar-wrap">
                      <div class="ex-chart-bar" style="height: {barH}px"></div>
                    </div>
                    <span class="ex-chart-lbl">{h.label}</span>
                  </div>
                {/each}
              </div>
              <div class="ex-chart-foot">Max weight per session (last {hist.length})</div>
            </div>
          {:else}
            <div class="ex-chart-empty">No logged sets with weight yet.</div>
          {/if}
        {/if}
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
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border: 1px solid rgba(var(--c-edge-e), 0.22);
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
    color: var(--c-accent-solid);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .chip-lbl {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.38);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Section head */
  .section-head {
    font-size: 12px;
    font-weight: 800;
    color: rgba(var(--c-fg), 0.38);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }

  .empty {
    font-size: 13px;
    color: var(--h-2a4880);
    padding: 20px 0;
    text-align: center;
  }

  /* Volume sparkline */
  .sparkline-card {
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border: 1px solid rgba(var(--c-edge-e), 0.22);
    border-radius: 16px;
    padding: 14px 14px 10px;
    margin-bottom: 20px;
  }

  .spark-bars {
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }

  .spark-col {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .spark-val {
    font-size: 9px;
    font-weight: 800;
    color: var(--c-accent-solid);
    letter-spacing: -0.01em;
    min-height: 12px;
    white-space: nowrap;
  }

  .spark-bar-wrap {
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    height: 56px;
  }

  .spark-bar {
    width: 100%;
    max-width: 28px;
    border-radius: 4px 4px 2px 2px;
    background: rgba(var(--c-fg), 0.08);
    transition: height 0.4s ease;
  }

  .spark-bar.active {
    background: linear-gradient(180deg, rgba(var(--c-accent), 0.90) 0%, rgba(var(--c-accent), 0.45) 100%);
  }

  .spark-lbl {
    font-size: 10px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.30);
    letter-spacing: 0.02em;
    text-transform: uppercase;
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
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border: 1px solid rgba(var(--c-edge-e), 0.22);
    border-radius: 14px;
    padding: 12px 14px;
  }

  .week-num {
    font-size: 13px;
    font-weight: 900;
    color: var(--c-accent-solid);
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
    color: rgba(var(--c-fg), 0.35);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .wval {
    font-size: 14px;
    font-weight: 800;
    color: var(--c-text);
    letter-spacing: -0.02em;
  }

  /* Expand toggle */
  .expand-btn {
    width: 100%;
    padding: 11px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-edge-d), 0.18);
    background: transparent;
    color: rgba(var(--c-fg), 0.38);
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

  .expand-btn:active { background: rgba(var(--c-surface-c), 0.65); color: rgba(var(--c-fg), 0.60); }

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
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border: 1px solid rgba(var(--c-edge-e), 0.22);
    border-radius: 12px;
  }

  .freq-rank {
    font-size: 12px;
    font-weight: 900;
    color: rgba(var(--c-fg), 0.30);
    width: 16px;
    flex-shrink: 0;
    text-align: right;
  }

  .freq-count {
    font-size: 13px;
    font-weight: 800;
    color: var(--c-accent-solid);
    flex-shrink: 0;
  }

  .freq-sets {
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.35);
    flex-shrink: 0;
    min-width: 44px;
    text-align: right;
  }

  /* #4 Plateau badge */
  .plateau-badge {
    display: inline-block;
    margin-left: 5px;
    font-size: 12px;
    font-weight: 900;
    color: var(--c-accent-solid);
    vertical-align: middle;
    opacity: 0.85;
  }

  /* #7 Exercise chart */
  .freq-row-selected {
    border-color: rgba(var(--c-accent), 0.28);
    background: linear-gradient(160deg, rgba(var(--c-accent), 0.06), var(--h-080e1c));
  }

  .freq-name-btn {
    flex: 1 1 0;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    font-size: 14px;
    font-weight: 700;
    color: var(--c-text);
    letter-spacing: -0.01em;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-tap-highlight-color: transparent;
  }

  .ex-chart {
    background: linear-gradient(160deg, var(--h-0b1628), var(--h-060c18));
    border: 1px solid rgba(var(--c-accent), 0.18);
    border-top: none;
    border-radius: 0 0 12px 12px;
    padding: 12px 14px 10px;
    margin-top: -1px;
    margin-bottom: 2px;
  }

  .ex-chart-bars {
    display: flex;
    align-items: flex-end;
    gap: 5px;
  }

  .ex-chart-col {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .ex-chart-val {
    font-size: 9px;
    font-weight: 800;
    color: var(--c-accent-solid);
    letter-spacing: -0.01em;
    min-height: 11px;
    white-space: nowrap;
  }

  .ex-chart-bar-wrap {
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    height: 52px;
  }

  .ex-chart-bar {
    width: 100%;
    max-width: 28px;
    border-radius: 3px 3px 2px 2px;
    background: linear-gradient(180deg, rgba(var(--c-accent), 0.85) 0%, rgba(var(--c-accent), 0.40) 100%);
    transition: height 0.3s ease;
  }

  .ex-chart-lbl {
    font-size: 9px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.28);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .ex-chart-foot {
    margin-top: 8px;
    font-size: 10px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.22);
    text-align: center;
    letter-spacing: 0.02em;
  }

  .ex-chart-empty {
    padding: 14px;
    font-size: 12px;
    color: rgba(var(--c-fg), 0.28);
    text-align: center;
    background: linear-gradient(160deg, var(--h-0b1628), var(--h-060c18));
    border: 1px solid rgba(var(--c-accent), 0.15);
    border-top: none;
    border-radius: 0 0 12px 12px;
    margin-top: -1px;
  }
</style>
