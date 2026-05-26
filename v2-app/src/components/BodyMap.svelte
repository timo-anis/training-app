<script lang="ts">
  import { appState, uiState } from '../stores/app';
  import type { WorkoutDay } from '../types/workout';

  // ---- Muscle keyword map (from MVP1) ----
  const MUSCLE_HINTS: Record<string, string[]> = {
    chest:       ['bench', 'incline', 'push-up', 'dip', 'pike', 'pushup', 'fly', 'pec'],
    back:        ['row', 'pull-up', 'chin', 'seal row', 'shrug', 'pull-aparts', 'pulldown', 'pullup', 'lat'],
    shoulders:   ['strict press', 'lateral raise', 'rear delt', 'pike', 'seated db shoulder', 'ohp', 'overhead press', 'front raise', 'shoulder press'],
    arms:        ['curl', 'hammer', 'dip', 'tricep', 'bicep', 'skull'],
    quads:       ['squat', 'front squat', 'leg press', 'lunge', 'split squat', 'thruster', 'step up', 'hack squat'],
    posterior:   ['deadlift', 'stiff-leg', 'trap bar', 'shrug', 'back extension', 'hip thrust', 'romanian', 'rdl', 'glute', 'hamstring'],
    core:        ['ab wheel', 'roll out', 'toes to bar', 'plank', 'crunch', 'sit-up', 'leg raise', 'hollow'],
    conditioning:['conditioning', 'metcon', 'run', 'bike', 'row', 'walk', 'sprint', 'ski', 'swim', 'jump rope', 'sled'],
  };

  type MuscleKey = keyof typeof MUSCLE_HINTS;

  const MUSCLE_COLORS: Record<MuscleKey, string> = {
    chest:        '#ffb84d',
    back:         '#ff7a45',
    shoulders:    '#58a6ff',
    arms:         '#48c6ff',
    quads:        '#4dd4ac',
    posterior:    '#6be675',
    core:         '#9de05e',
    conditioning: '#ffd24d',
  };

  const MUSCLE_LABELS: Record<MuscleKey, string> = {
    chest:        'Chest',
    back:         'Back',
    shoulders:    'Shoulders',
    arms:         'Arms',
    quads:        'Quads',
    posterior:    'Posterior',
    core:         'Core',
    conditioning: 'Cardio',
  };

  // ---- Mode ----
  type RadarMode = 'day' | 'week' | 'month' | 'alltime';
  let mode: RadarMode = 'week';

  const PROGRAM_START = new Date('2026-02-16T00:00:00');

  function dateToWeekDay(date: Date): { week: number; dayIdx: number } | null {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.floor((date.getTime() - PROGRAM_START.getTime()) / msPerDay);
    if (diff < 0) return null;
    return { week: Math.floor(diff / 7) + 1, dayIdx: diff % 7 };
  }

  // ---- Score computation ----
  function scoreExercise(name: string, note: string, setCount: number): Partial<Record<MuscleKey, number>> {
    const text = `${name} ${note}`.toLowerCase();
    const result: Partial<Record<MuscleKey, number>> = {};
    for (const [key, hints] of Object.entries(MUSCLE_HINTS)) {
      if (hints.some(h => text.includes(h))) {
        result[key as MuscleKey] = (result[key as MuscleKey] ?? 0) + setCount;
      }
    }
    return result;
  }

  function addTotals(
    acc: Record<MuscleKey, number>,
    partial: Partial<Record<MuscleKey, number>>
  ) {
    for (const [k, v] of Object.entries(partial)) {
      acc[k as MuscleKey] = (acc[k as MuscleKey] ?? 0) + (v ?? 0);
    }
  }

  function emptyTotals(): Record<MuscleKey, number> {
    return { chest:0, back:0, shoulders:0, arms:0, quads:0, posterior:0, core:0, conditioning:0 };
  }

  function computeForDays(days: WorkoutDay[]): Record<MuscleKey, number> {
    const totals = emptyTotals();
    for (const wd of days) {
      for (const ex of wd.exercises) {
        if (ex.recovery) continue;
        addTotals(totals, scoreExercise(ex.name, ex.note, ex.sets.length));
      }
    }
    return totals;
  }

  function computeForMonth(weeks: WorkoutDay[], year: number, month: number): Record<MuscleKey, number> {
    const filtered = weeks.filter(wd => {
      const wd2 = dateToWeekDay(new Date(PROGRAM_START.getTime()));
      // Recompute the date for this workout day
      const { DAY_ORDER } = { DAY_ORDER: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] };
      const dayIdx = DAY_ORDER.indexOf(wd.day);
      const ms = PROGRAM_START.getTime() + ((wd.week - 1) * 7 + dayIdx) * 86400000;
      const d = new Date(ms);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return computeForDays(filtered);
  }

  $: totals = (() => {
    const weeks = $appState.weeks;
    if (mode === 'day') {
      const dayDays = weeks.filter(w => w.week === $uiState.week && w.day === $uiState.day);
      return computeForDays(dayDays);
    }
    if (mode === 'week') {
      const weekDays = weeks.filter(w => w.week === $uiState.week);
      return computeForDays(weekDays);
    }
    if (mode === 'month') {
      // Find date of selected week/day
      const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const dayIdx = DAY_ORDER.indexOf($uiState.day);
      const ms = PROGRAM_START.getTime() + (($uiState.week - 1) * 7 + dayIdx) * 86400000;
      const ref = new Date(ms);
      return computeForMonth(weeks, ref.getFullYear(), ref.getMonth());
    }
    // alltime
    return computeForDays(weeks);
  })();

  $: maxVal = Math.max(1, ...Object.values(totals));

  // Zone intensity: 0=none, 1=low, 2=mid, 3=high
  function intensity(key: MuscleKey): 0 | 1 | 2 | 3 {
    const v = totals[key] ?? 0;
    if (v <= 0) return 0;
    const r = v / maxVal;
    if (r < 0.25) return 1;
    if (r < 0.60) return 2;
    return 3;
  }

  function zoneColor(key: MuscleKey): string {
    const i = intensity(key);
    if (i === 0) return 'rgba(255,255,255,0.04)';
    const base = MUSCLE_COLORS[key];
    const alpha = i === 1 ? '0.20' : i === 2 ? '0.45' : '0.75';
    // Parse hex and apply alpha inline via opacity
    return base;
  }

  function zoneOpacity(key: MuscleKey): number {
    const i = intensity(key);
    if (i === 0) return 0.06;
    if (i === 1) return 0.28;
    if (i === 2) return 0.55;
    return 0.90;
  }

  // Legend — only muscles with any sets
  $: legendItems = (Object.keys(MUSCLE_HINTS) as MuscleKey[])
    .filter(k => (totals[k] ?? 0) > 0)
    .sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));

  // Strongest / weakest (of trained muscles)
  $: strongest = legendItems[0] ?? null;
  $: weakest = legendItems[legendItems.length - 1] ?? null;

  // ---- Manual selection (click to highlight individual muscles) ----
  let selected = new Set<MuscleKey>();

  function toggleMuscle(key: MuscleKey) {
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    selected = selected; // trigger Svelte reactivity
  }

  function clearSelection() { selected = new Set(); }

  // When selection active: highlight selected, dim others
  function effectiveOpacity(key: MuscleKey): number {
    const base = zoneOpacity(key);
    if (selected.size === 0) return base;
    if (selected.has(key)) return Math.max(base, 0.88);
    return Math.min(base, 0.07);
  }

  const MODES: { key: RadarMode; label: string }[] = [
    { key: 'day',     label: 'Day' },
    { key: 'week',    label: 'Week' },
    { key: 'month',   label: 'Month' },
    { key: 'alltime', label: 'All time' },
  ];
</script>

<div class="bodymap">
  <!-- Mode toggle -->
  <div class="mode-toggle">
    {#each MODES as m}
      <button
        class="mode-btn"
        class:active={mode === m.key}
        on:click={() => mode = m.key}
      >{m.label}</button>
    {/each}
  </div>

  <!-- Body SVG -->
  <div class="body-wrap">
    <svg viewBox="0 0 220 320" class="body-svg" role="img" aria-label="Muscle balance body">
      <!-- Body shell -->
      <ellipse cx="110" cy="34" rx="24" ry="25" class="body-shell"/>
      <path class="body-shell" d="M70 78 C78 60,94 52,110 52 C126 52,142 60,150 78 C156 92,159 106,158 124 C156 151,148 177,142 198 C139 208,138 220,139 234 C140 250,144 275,147 304 L128 304 C124 278,121 257,118 238 C116 223,114 208,110 196 C106 208,104 223,102 238 C99 257,96 278,92 304 L73 304 C76 275,80 250,81 234 C82 220,81 208,78 198 C72 177,64 151,62 124 C61 106,64 92,70 78 Z"/>
      <path class="body-core-shell" d="M88 86 C94 80,101 77,110 77 C119 77,126 80,132 86 C138 93,140 102,139 114 C137 134,131 154,127 172 C124 184,121 194,110 201 C99 194,96 184,93 172 C89 154,83 134,81 114 C80 102,82 93,88 86 Z"/>

      <!-- Shoulders -->
      <path
        class="zone" class:zone-sel={selected.has('shoulders')}
        fill={MUSCLE_COLORS.shoulders}
        opacity={effectiveOpacity('shoulders')}
        stroke={selected.has('shoulders') ? MUSCLE_COLORS.shoulders : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('shoulders')}
        d="M62 82 C73 63,89 54,110 54 C131 54,147 63,158 82 C151 89,144 95,136 99 C128 88,120 83,110 83 C100 83,92 88,84 99 C76 95,69 89,62 82 Z"
      />
      <!-- Chest -->
      <path
        class="zone" class:zone-sel={selected.has('chest')}
        fill={MUSCLE_COLORS.chest}
        opacity={effectiveOpacity('chest')}
        stroke={selected.has('chest') ? MUSCLE_COLORS.chest : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('chest')}
        d="M85 98 C92 90,100 86,110 86 C120 86,128 90,135 98 C132 112,124 123,110 128 C96 123,88 112,85 98 Z"
      />
      <!-- Back -->
      <path
        class="zone zone-back" class:zone-sel={selected.has('back')}
        fill={MUSCLE_COLORS.back}
        opacity={selected.size === 0 ? zoneOpacity('back') * 0.7 : effectiveOpacity('back')}
        stroke={selected.has('back') ? MUSCLE_COLORS.back : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('back')}
        d="M85 92 C93 83,101 80,110 80 C119 80,127 83,135 92 C135 116,127 139,110 151 C93 139,85 116,85 92 Z"
      />
      <!-- Arms (both) -->
      <path
        class="zone" class:zone-sel={selected.has('arms')}
        fill={MUSCLE_COLORS.arms}
        opacity={effectiveOpacity('arms')}
        stroke={selected.has('arms') ? MUSCLE_COLORS.arms : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('arms')}
        d="M61 90 C54 102,51 117,52 135 C53 152,57 168,61 183 C64 194,69 204,76 212 C79 198,80 185,79 172 C76 148,74 125,75 105 C75 100,72 94,67 90 Z"
      />
      <path
        class="zone" class:zone-sel={selected.has('arms')}
        fill={MUSCLE_COLORS.arms}
        opacity={effectiveOpacity('arms')}
        stroke={selected.has('arms') ? MUSCLE_COLORS.arms : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('arms')}
        d="M159 90 C166 102,169 117,168 135 C167 152,163 168,159 183 C156 194,151 204,144 212 C141 198,140 185,141 172 C144 148,146 125,145 105 C145 100,148 94,153 90 Z"
      />
      <!-- Core -->
      <path
        class="zone" class:zone-sel={selected.has('core')}
        fill={MUSCLE_COLORS.core}
        opacity={effectiveOpacity('core')}
        stroke={selected.has('core') ? MUSCLE_COLORS.core : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('core')}
        d="M92 128 C98 122,103 120,110 120 C117 120,122 122,128 128 C126 148,122 165,110 179 C98 165,94 148,92 128 Z"
      />
      <!-- Posterior -->
      <path
        class="zone" class:zone-sel={selected.has('posterior')}
        fill={MUSCLE_COLORS.posterior}
        opacity={effectiveOpacity('posterior')}
        stroke={selected.has('posterior') ? MUSCLE_COLORS.posterior : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('posterior')}
        d="M91 182 C97 176,103 173,110 173 C117 173,123 176,129 182 C127 193,122 204,110 210 C98 204,93 193,91 182 Z"
      />
      <!-- Quads (both legs) -->
      <path
        class="zone" class:zone-sel={selected.has('quads')}
        fill={MUSCLE_COLORS.quads}
        opacity={effectiveOpacity('quads')}
        stroke={selected.has('quads') ? MUSCLE_COLORS.quads : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('quads')}
        d="M83 212 C91 213,97 217,101 224 C102 240,99 269,95 304 L76 304 C79 270,80 241,83 212 Z"
      />
      <path
        class="zone" class:zone-sel={selected.has('quads')}
        fill={MUSCLE_COLORS.quads}
        opacity={effectiveOpacity('quads')}
        stroke={selected.has('quads') ? MUSCLE_COLORS.quads : 'none'}
        stroke-width="1.5"
        on:click={() => toggleMuscle('quads')}
        d="M137 212 C129 213,123 217,119 224 C118 240,121 269,125 304 L144 304 C141 270,140 241,137 212 Z"
      />
    </svg>

    <!-- No data overlay -->
    {#if legendItems.length === 0}
      <div class="no-data-overlay">No training data<br>for this period</div>
    {/if}
  </div>

  <!-- Clear selection button -->
  {#if selected.size > 0}
    <button class="clear-sel-btn" on:click={clearSelection}>
      Clear selection ×
    </button>
  {/if}

  <!-- Legend chips -->
  {#if legendItems.length > 0}
    <div class="legend-grid">
      {#each legendItems as key}
        <div class="legend-chip" style="--c: {MUSCLE_COLORS[key]}; --op: {zoneOpacity(key)}">
          <span class="chip-dot"></span>
          <span class="chip-name">{MUSCLE_LABELS[key]}</span>
          <span class="chip-sets">{totals[key]}×</span>
        </div>
      {/each}
    </div>

    <!-- Insights -->
    <div class="insights">
      {#if strongest}
        <div class="insight-row">
          <span class="insight-lbl">Strongest</span>
          <span class="insight-val" style="color: {MUSCLE_COLORS[strongest]}">{MUSCLE_LABELS[strongest]}</span>
        </div>
      {/if}
      {#if weakest && weakest !== strongest}
        <div class="insight-row">
          <span class="insight-lbl">Least trained</span>
          <span class="insight-val">{MUSCLE_LABELS[weakest]}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .bodymap {
    display: grid;
    gap: 14px;
    padding: 4px 0;
  }

  /* Mode toggle */
  .mode-toggle {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    background: rgba(12,20,44,0.50);
    border: 1px solid rgba(60,90,165,0.14);
    border-radius: 14px;
    padding: 4px;
  }

  .mode-btn {
    padding: 8px 4px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: #2a4880;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .mode-btn.active {
    background: rgba(196,148,46,0.14);
    color: #c49230;
  }

  /* Body SVG */
  .body-wrap {
    position: relative;
    display: flex;
    justify-content: center;
  }

  .body-svg {
    width: 160px;
    height: auto;
  }

  .body-shell {
    fill: rgba(255,255,255,0.05);
    stroke: rgba(255,255,255,0.08);
    stroke-width: 1;
  }

  .body-core-shell {
    fill: rgba(255,255,255,0.03);
    stroke: rgba(255,255,255,0.05);
    stroke-width: 0.5;
  }

  .zone {
    transition: opacity 0.3s, fill 0.3s;
    stroke: none;
    cursor: pointer;
  }

  .zone:active {
    opacity: 0.5 !important;
  }

  /* Clear selection button */
  .clear-sel-btn {
    width: 100%;
    padding: 9px;
    border-radius: 10px;
    border: 1px solid rgba(65,100,175,0.20);
    background: transparent;
    color: rgba(255,255,255,0.40);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .clear-sel-btn:active {
    background: rgba(14,25,55,0.65);
    color: rgba(255,255,255,0.65);
  }

  .zone-back {
    /* Back overlaps chest — show as hatching by reducing opacity further */
  }

  .no-data-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: #1e3870;
    text-align: center;
    line-height: 1.6;
    pointer-events: none;
  }

  /* Legend grid */
  .legend-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .legend-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 12px;
    border: 1px solid rgba(60,90,160,0.13);
    background: rgba(12,20,44,0.50);
  }

  .chip-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--c);
    opacity: var(--op);
    flex-shrink: 0;
  }

  .chip-name {
    flex: 1 1 0;
    font-size: 12px;
    font-weight: 700;
    color: #c8ddf4;
  }

  .chip-sets {
    font-size: 11px;
    font-weight: 800;
    color: #3a5888;
  }

  /* Insights */
  .insights {
    display: grid;
    gap: 6px;
  }

  .insight-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(12,20,44,0.50);
    border: 1px solid rgba(60,90,160,0.13);
  }

  .insight-lbl {
    font-size: 11px;
    font-weight: 700;
    color: #1e3870;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .insight-val {
    font-size: 13px;
    font-weight: 800;
    color: #c8ddf4;
  }
</style>
