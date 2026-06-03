<script lang="ts">
  import { appState, uiState } from '../stores/app';
  import { PS_UTC } from '../lib/program';
  import type { WorkoutDay } from '../types/workout';

  // ---- Muscle keyword map ----
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
    chest:        'var(--h-ffb84d)',
    back:         'var(--h-ff7a45)',
    shoulders:    'var(--h-58a6ff)',
    arms:         'var(--h-48c6ff)',
    quads:        'var(--h-4dd4ac)',
    posterior:    'var(--h-6be675)',
    core:         'var(--h-9de05e)',
    conditioning: 'var(--h-ffd24d)',
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

  const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

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
        addTotals(totals, scoreExercise(ex.name, ex.note ?? '', ex.sets.length));
      }
    }
    return totals;
  }

  function computeForMonth(weeks: WorkoutDay[], year: number, month: number): Record<MuscleKey, number> {
    const filtered = weeks.filter(wd => {
      const dayIdx = DAY_ORDER.indexOf(wd.day);
      const ms = PS_UTC + ((wd.week - 1) * 7 + dayIdx) * 86400000;
      const d = new Date(ms);
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
    });
    return computeForDays(filtered);
  }

  $: totals = (() => {
    const weeks = $appState.weeks;
    if (mode === 'day') {
      return computeForDays(weeks.filter(w => w.week === $uiState.week && w.day === $uiState.day));
    }
    if (mode === 'week') {
      return computeForDays(weeks.filter(w => w.week === $uiState.week));
    }
    if (mode === 'month') {
      const dayIdx = DAY_ORDER.indexOf($uiState.day);
      const ms = PS_UTC + (($uiState.week - 1) * 7 + dayIdx) * 86400000;
      const ref = new Date(ms);
      return computeForMonth(weeks, ref.getUTCFullYear(), ref.getUTCMonth());
    }
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

  function zoneOpacity(key: MuscleKey): number {
    const i = intensity(key);
    if (i === 0) return 0.06;
    if (i === 1) return 0.28;
    if (i === 2) return 0.55;
    return 0.90;
  }

  // ---- Hide/show muscle groups ----
  let hidden = new Set<MuscleKey>();

  function zoneKey(e: KeyboardEvent, m: MuscleKey) {

    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHidden(m); }

  }


  function toggleHidden(key: MuscleKey) {
    if (hidden.has(key)) hidden.delete(key);
    else hidden.add(key);
    hidden = hidden; // trigger reactivity
  }

  // Reactive zone opacities — computed as a record so Svelte sees `hidden` dependency
  $: zoneOpacities = (() => {
    const r: Record<string, number> = {};
    for (const key of Object.keys(MUSCLE_HINTS) as MuscleKey[]) {
      r[key] = hidden.has(key) ? 0 : zoneOpacity(key);
    }
    return r;
  })();

  // Back zone uses a 0.7 multiplier (overlaps chest)
  $: backOpacity = hidden.has('back') ? 0 : zoneOpacity('back') * 0.7;

  // Reactive glow flags
  $: zoneGlows = (() => {
    const r: Record<string, boolean> = {};
    for (const key of Object.keys(MUSCLE_HINTS) as MuscleKey[]) {
      r[key] = intensity(key) === 3 && !hidden.has(key);
    }
    return r;
  })();

  // Legend — only muscles with any sets
  $: legendItems = (Object.keys(MUSCLE_HINTS) as MuscleKey[])
    .filter(k => (totals[k] ?? 0) > 0)
    .sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));

  $: strongest = legendItems[0] ?? null;
  $: weakest = legendItems[legendItems.length - 1] ?? null;

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
      <defs>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="glow-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Body shell -->
      <ellipse cx="110" cy="34" rx="24" ry="25" class="body-shell"/>
      <path class="body-shell" d="M70 78 C78 60,94 52,110 52 C126 52,142 60,150 78 C156 92,159 106,158 124 C156 151,148 177,142 198 C139 208,138 220,139 234 C140 250,144 275,147 304 L128 304 C124 278,121 257,118 238 C116 223,114 208,110 196 C106 208,104 223,102 238 C99 257,96 278,92 304 L73 304 C76 275,80 250,81 234 C82 220,81 208,78 198 C72 177,64 151,62 124 C61 106,64 92,70 78 Z"/>
      <path class="body-core-shell" d="M88 86 C94 80,101 77,110 77 C119 77,126 80,132 86 C138 93,140 102,139 114 C137 134,131 154,127 172 C124 184,121 194,110 201 C99 194,96 184,93 172 C89 154,83 134,81 114 C80 102,82 93,88 86 Z"/>

      <!-- Shoulders -->
      <path
        class="zone"
        fill={MUSCLE_COLORS.shoulders}
        opacity={zoneOpacities.shoulders}
        filter={zoneGlows.shoulders ? 'url(#glow)' : undefined}
        on:click={() => toggleHidden('shoulders')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.shoulders}"
        on:keydown={(e) => zoneKey(e, 'shoulders')}
        d="M62 82 C73 63,89 54,110 54 C131 54,147 63,158 82 C151 89,144 95,136 99 C128 88,120 83,110 83 C100 83,92 88,84 99 C76 95,69 89,62 82 Z"
      />
      <!-- Chest -->
      <path
        class="zone"
        fill={MUSCLE_COLORS.chest}
        opacity={zoneOpacities.chest}
        filter={zoneGlows.chest ? 'url(#glow)' : undefined}
        on:click={() => toggleHidden('chest')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.chest}"
        on:keydown={(e) => zoneKey(e, 'chest')}
        d="M85 98 C92 90,100 86,110 86 C120 86,128 90,135 98 C132 112,124 123,110 128 C96 123,88 112,85 98 Z"
      />
      <!-- Back -->
      <path
        class="zone zone-back"
        fill={MUSCLE_COLORS.back}
        opacity={backOpacity}
        filter={zoneGlows.back ? 'url(#glow-soft)' : undefined}
        on:click={() => toggleHidden('back')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.back}"
        on:keydown={(e) => zoneKey(e, 'back')}
        d="M85 92 C93 83,101 80,110 80 C119 80,127 83,135 92 C135 116,127 139,110 151 C93 139,85 116,85 92 Z"
      />
      <!-- Arms (both) -->
      <path
        class="zone"
        fill={MUSCLE_COLORS.arms}
        opacity={zoneOpacities.arms}
        filter={zoneGlows.arms ? 'url(#glow)' : undefined}
        on:click={() => toggleHidden('arms')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.arms}"
        on:keydown={(e) => zoneKey(e, 'arms')}
        d="M61 90 C54 102,51 117,52 135 C53 152,57 168,61 183 C64 194,69 204,76 212 C79 198,80 185,79 172 C76 148,74 125,75 105 C75 100,72 94,67 90 Z"
      />
      <path
        class="zone"
        fill={MUSCLE_COLORS.arms}
        opacity={zoneOpacities.arms}
        filter={zoneGlows.arms ? 'url(#glow)' : undefined}
        on:click={() => toggleHidden('arms')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.arms}"
        on:keydown={(e) => zoneKey(e, 'arms')}
        d="M159 90 C166 102,169 117,168 135 C167 152,163 168,159 183 C156 194,151 204,144 212 C141 198,140 185,141 172 C144 148,146 125,145 105 C145 100,148 94,153 90 Z"
      />
      <!-- Core -->
      <path
        class="zone"
        fill={MUSCLE_COLORS.core}
        opacity={zoneOpacities.core}
        filter={zoneGlows.core ? 'url(#glow)' : undefined}
        on:click={() => toggleHidden('core')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.core}"
        on:keydown={(e) => zoneKey(e, 'core')}
        d="M92 128 C98 122,103 120,110 120 C117 120,122 122,128 128 C126 148,122 165,110 179 C98 165,94 148,92 128 Z"
      />
      <!-- Posterior -->
      <path
        class="zone"
        fill={MUSCLE_COLORS.posterior}
        opacity={zoneOpacities.posterior}
        filter={zoneGlows.posterior ? 'url(#glow)' : undefined}
        on:click={() => toggleHidden('posterior')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.posterior}"
        on:keydown={(e) => zoneKey(e, 'posterior')}
        d="M91 182 C97 176,103 173,110 173 C117 173,123 176,129 182 C127 193,122 204,110 210 C98 204,93 193,91 182 Z"
      />
      <!-- Quads (both legs) -->
      <path
        class="zone"
        fill={MUSCLE_COLORS.quads}
        opacity={zoneOpacities.quads}
        filter={zoneGlows.quads ? 'url(#glow)' : undefined}
        on:click={() => toggleHidden('quads')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.quads}"
        on:keydown={(e) => zoneKey(e, 'quads')}
        d="M83 212 C91 213,97 217,101 224 C102 240,99 269,95 304 L76 304 C79 270,80 241,83 212 Z"
      />
      <path
        class="zone"
        fill={MUSCLE_COLORS.quads}
        opacity={zoneOpacities.quads}
        filter={zoneGlows.quads ? 'url(#glow)' : undefined}
        on:click={() => toggleHidden('quads')}
        role="button"
        tabindex="0"
        aria-label="Toggle {MUSCLE_LABELS.quads}"
        on:keydown={(e) => zoneKey(e, 'quads')}
        d="M137 212 C129 213,123 217,119 224 C118 240,121 269,125 304 L144 304 C141 270,140 241,137 212 Z"
      />
    </svg>

    <!-- No data overlay -->
    {#if legendItems.length === 0}
      <div class="no-data-overlay">No training data<br>for this period</div>
    {/if}
  </div>

  <!-- Legend chips (clickable toggles) -->
  {#if legendItems.length > 0}
    <div class="legend-grid">
      {#each legendItems as key}
        <button
          class="legend-chip"
          class:chip-hidden={hidden.has(key)}
          style="--c: {MUSCLE_COLORS[key]}; --op: {zoneOpacity(key)}"
          on:click={() => toggleHidden(key)}
          title={hidden.has(key) ? `Show ${MUSCLE_LABELS[key]}` : `Hide ${MUSCLE_LABELS[key]}`}
        >
          <span class="chip-dot"></span>
          <span class="chip-name">{MUSCLE_LABELS[key]}</span>
          <span class="chip-sets">{totals[key]}×</span>
          {#if hidden.has(key)}
            <span class="chip-eye-off" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/>
              </svg>
            </span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Insights -->
    <div class="insights">
      {#if strongest}
        <div class="insight-row">
          <span class="insight-lbl">Most trained</span>
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
    background: rgba(var(--c-surface-a), 0.50);
    border: 1px solid rgba(var(--c-edge-b), 0.14);
    border-radius: 14px;
    padding: 4px;
  }

  .mode-btn {
    padding: 8px 4px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: rgba(var(--c-fg), 0.25);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .mode-btn.active {
    background: rgba(var(--c-accent), 0.14);
    color: var(--c-accent-solid);
  }

  /* Body SVG — premium dark card */
  .body-wrap {
    position: relative;
    display: flex;
    justify-content: center;
    background: linear-gradient(180deg, var(--c-8-12-28-0_80) 0%, var(--c-5-7-18-0_90) 100%);
    border: 1px solid rgba(var(--c-edge-d), 0.18);
    border-top: 1px solid rgba(var(--c-accent), 0.15);
    border-radius: 20px;
    padding: 20px 16px;
  }

  .body-svg {
    width: 160px;
    height: auto;
    overflow: visible; /* needed so glow filter isn't clipped */
  }

  .body-shell {
    fill: rgba(var(--c-fg), 0.04);
    stroke: rgba(var(--c-fg), 0.10);
    stroke-width: 1;
  }

  .body-core-shell {
    fill: rgba(var(--c-fg), 0.02);
    stroke: rgba(var(--c-fg), 0.06);
    stroke-width: 0.5;
  }

  .zone {
    transition: opacity 0.25s;
    cursor: pointer;
  }

  .zone:active {
    opacity: 0.4 !important;
  }

  .no-data-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: rgba(var(--c-fg), 0.18);
    text-align: center;
    line-height: 1.6;
    pointer-events: none;
  }

  /* Legend chips — clickable toggle buttons */
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
    border: 1px solid rgba(var(--c-edge-a), 0.18);
    background: rgba(var(--c-surface-a), 0.55);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.18s, background 0.12s, border-color 0.18s;
    text-align: left;
    width: 100%;
  }

  .legend-chip:active {
    background: rgba(var(--c-surface-a), 0.80);
  }

  .legend-chip.chip-hidden {
    opacity: 0.38;
    border-color: rgba(var(--c-edge-a), 0.10);
    background: var(--c-8-12-24-0_40);
  }

  .chip-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--c);
    opacity: var(--op);
    flex-shrink: 0;
    transition: opacity 0.18s;
  }

  .chip-hidden .chip-dot {
    opacity: 0.20;
  }

  .chip-name {
    flex: 1 1 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--c-200-221-244-0_85);
    transition: color 0.18s;
  }

  .chip-hidden .chip-name {
    color: var(--c-200-221-244-0_35);
    text-decoration: line-through;
    text-decoration-color: rgba(var(--c-fg), 0.20);
  }

  .chip-sets {
    font-size: 11px;
    font-weight: 800;
    color: var(--c-58-88-136-0_90);
  }

  .chip-eye-off {
    color: rgba(var(--c-fg), 0.20);
    flex-shrink: 0;
    display: flex;
    align-items: center;
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
    background: rgba(var(--c-surface-a), 0.50);
    border: 1px solid rgba(var(--c-edge-a), 0.13);
  }

  .insight-lbl {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.22);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .insight-val {
    font-size: 13px;
    font-weight: 800;
    color: var(--c-200-221-244-0_90);
  }
</style>
