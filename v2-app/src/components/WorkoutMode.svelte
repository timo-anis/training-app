<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    uiState, appState, workoutBlocks, exitWorkout, closeWorkoutMode,
    setActiveBlock, toggleSetDone, updateSetField, findLastSession,
    findLastConditioningNote, toggleRecoveryDone, updateUI,
    addSet, deleteSet, updateConditioningNote,
  } from '../stores/app';
  import type { WorkoutBlock } from '../stores/app';
  import type { DayOfWeek } from '../types/workout';
  import RestTimer from './RestTimer.svelte';

  const DAY_SHORT: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };

  // ---- Wake Lock ----
  let wakeLock: WakeLockSentinel | null = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator)
        wakeLock = await (navigator as any).wakeLock.request('screen');
    } catch { /* silent */ }
  }

  function releaseWakeLock() { wakeLock?.release().catch(() => {}); wakeLock = null; }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') requestWakeLock();
  }

  onMount(() => {
    requestWakeLock();
    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  onDestroy(() => {
    releaseWakeLock();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    clearInterval(clockInterval);
  });

  // ---- Elapsed timer ----
  let elapsed = 0;
  const clockInterval = setInterval(() => {
    const start = $uiState.workoutStartTime;
    elapsed = start ? Math.floor((Date.now() - start) / 1000) : 0;
  }, 1000);

  function formatElapsed(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  // ---- Blocks ----
  $: blocks = $workoutBlocks;
  $: activeIndex = $uiState.activeExerciseIndex;
  $: block = blocks[activeIndex] ?? null;
  $: isFirst = activeIndex === 0;
  $: isLast = activeIndex === blocks.length - 1;

  // ---- Rest timer (state in uiState — survives overlay close/reopen) ----
  function parseRestToSeconds(s: string): number {
    if (!s) return 0;
    s = s.trim().toLowerCase();
    if (/^\d+:\d+$/.test(s)) { const [m, sec] = s.split(':').map(Number); return m * 60 + sec; }
    const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*min?/);
    if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60);
    const secMatch = s.match(/^(\d+(?:\.\d+)?)/);
    if (secMatch) return Math.round(parseFloat(secMatch[1]));
    return 0;
  }

  $: restActive = $uiState.restStartTime !== null && $uiState.restTotal !== null && $uiState.restTotal > 0;

  function startRest(restString: string) {
    const secs = parseRestToSeconds(restString);
    if (secs > 0) updateUI(ui => ({ ...ui, restStartTime: Date.now(), restTotal: secs }));
  }

  function clearRest() {
    updateUI(ui => ({ ...ui, restStartTime: null, restTotal: null }));
  }

  // ---- Exercise/block done helpers ----
  function exDone(ex: import('../types/workout').Exercise): boolean {
    if (ex.recovery) return ex.recoveryDone;
    if (ex.conditioning) return ex.conditioningNote.trim().length > 0;
    return ex.sets.length > 0 && ex.sets.every(s => s.done);
  }

  $: allDone = blocks.every(b => b.exercises.every(exDone));

  function blockDone(b: WorkoutBlock): boolean {
    return b.exercises.every(exDone);
  }

  function handleSetDone(week: number, day: DayOfWeek, exId: string, setIndex: number, currentDone: boolean, exRestString: string) {
    toggleSetDone(week, day, exId, setIndex);
    if (!currentDone && exRestString) startRest(exRestString);
  }

  function prev() { if (!isFirst) setActiveBlock(activeIndex - 1); }
  function next() { if (!isLast) setActiveBlock(activeIndex + 1); }
  function backToNormal() { closeWorkoutMode(); }

  // ---- Workout summary ----
  let showSummary = false;

  function openSummary() {
    summaryElapsed = elapsed; // capture at tap time
    showSummary = true;
  }

  let summaryElapsed = 0;

  function confirmFinish() {
    exitWorkout();
    showSummary = false;
  }

  // Summary stats computed from the current workout day
  $: summaryDay = $appState.weeks.find(w => w.week === $uiState.week && w.day === $uiState.day);

  $: summarySetsDone = summaryDay
    ? summaryDay.exercises
        .filter(ex => !ex.recovery && !ex.conditioning)
        .flatMap(ex => ex.sets)
        .filter(s => s.done).length
    : 0;

  $: summaryVolume = (() => {
    if (!summaryDay) return 0;
    let v = 0;
    for (const ex of summaryDay.exercises) {
      if (ex.recovery || ex.conditioning) continue;
      for (const s of ex.sets) {
        if (!s.done) continue;
        const kg = parseFloat(s.kg);
        const reps = parseInt(s.reps);
        if (!isNaN(kg) && !isNaN(reps)) v += kg * reps;
      }
    }
    return v;
  })();

  function fmtVolume(v: number): string {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
    return `${Math.round(v)}kg`;
  }

  $: summaryExercises = summaryDay
    ? summaryDay.exercises.map(ex => ({
        name: ex.name,
        done: exDone(ex),
        conditioning: ex.conditioning,
        recovery: ex.recovery,
        setsDone: ex.conditioning || ex.recovery ? 0 : ex.sets.filter(s => s.done).length,
        setsTotal: ex.conditioning || ex.recovery ? 0 : ex.sets.length,
      }))
    : [];

  // ---- Local editable inputs (sets) ----
  let localKg: Record<string, string> = {};
  let localReps: Record<string, string> = {};
  let localCondNote: Record<string, string> = {};

  // Sync locals when block changes
  $: {
    if (block) {
      for (const ex of block.exercises) {
        ex.sets.forEach((s, i) => {
          const k = `${ex.id}-${i}`;
          if (localKg[k] === undefined) localKg[k] = s.kg;
          if (localReps[k] === undefined) localReps[k] = s.reps;
        });
        // Conditioning note: use current value or fall back to last session's note
        if (ex.conditioning && localCondNote[ex.id] === undefined) {
          localCondNote[ex.id] = ex.conditioningNote ||
            findLastConditioningNote($appState, ex.name, $uiState.week, $uiState.day);
        }
      }
    }
  }

  // Reset locals on block navigation
  let prevActiveIndex = -1;
  $: if (activeIndex !== prevActiveIndex) {
    prevActiveIndex = activeIndex;
    localKg = {};
    localReps = {};
    localCondNote = {};
  }

  function commitKg(week: number, day: DayOfWeek, exId: string, i: number) {
    const k = `${exId}-${i}`;
    const val = (localKg[k] ?? '').replace(',', '.').trim();
    localKg[k] = val;
    updateSetField(week, day, exId, i, 'kg', val);
  }

  function commitReps(week: number, day: DayOfWeek, exId: string, i: number) {
    const k = `${exId}-${i}`;
    const val = (localReps[k] ?? '').trim();
    localReps[k] = val;
    updateSetField(week, day, exId, i, 'reps', val);
  }

  function commitCondNote(week: number, day: DayOfWeek, exId: string) {
    updateConditioningNote(week, day, exId, localCondNote[exId] ?? '');
  }

  function handleAddSet(week: number, day: DayOfWeek, exId: string) {
    addSet(week, day, exId);
    localKg = {};
    localReps = {};
  }

  function handleDeleteSet(week: number, day: DayOfWeek, exId: string, i: number) {
    deleteSet(week, day, exId, i);
    localKg = {};
    localReps = {};
  }
</script>

<div class="wm-overlay">
  <!-- Header -->
  <header class="wm-header">
    <button class="wm-exit" on:click={backToNormal} title="Back to normal view">‹</button>
    <span class="wm-progress">{activeIndex + 1} / {blocks.length}</span>
    <div class="wm-dots">
      {#each blocks as b, i}
        <span class="dot" class:active={i === activeIndex} class:done={blockDone(b)}></span>
      {/each}
    </div>
    <span class="wm-clock">{formatElapsed(elapsed)}</span>
  </header>

  <!-- Block content -->
  {#if block}
    <div class="wm-content">
      <!-- Block badge -->
      <div class="block-title">
        {#if block.isSuperset}
          <span class="block-badge superset">Superset {block.code}</span>
        {:else if block.exercises[0]?.conditioning}
          <span class="block-badge cond">Cardio / Conditioning</span>
        {:else}
          <span class="block-badge single">Exercise</span>
        {/if}
      </div>

      <!-- Exercises in this block -->
      <div class="exercises-wrap">
        {#each block.exercises as ex}
          {@const week = $uiState.week}
          {@const day = $uiState.day}
          {@const lastSession = ex.conditioning ? null : findLastSession($appState, ex.name, week, day)}
          <div class="ex-section">
            <div class="ex-name-row">
              {#if block.isSuperset}
                <span class="ex-code">{ex.code}</span>
              {/if}
              <span class="ex-name">{ex.name}</span>
              {#if ex.rest && !ex.conditioning}
                <span class="ex-rest">Rest {ex.rest}</span>
              {/if}
            </div>

            {#if lastSession}
              <div class="last-session">
                <span class="last-label">W{lastSession.week} {DAY_SHORT[lastSession.day]}</span>
                <span class="last-sets">
                  {#each lastSession.sets as s, i}
                    <span class="last-set">{s.kg || '—'} × {s.reps || '—'}{i < lastSession.sets.length - 1 ? ' ·' : ''}</span>
                  {/each}
                </span>
              </div>
            {/if}

            {#if ex.note}
              <div class="ex-note">{ex.note}</div>
            {/if}

            {#if ex.conditioning}
              <!-- Conditioning: large editable textarea, previous session shown above -->
              {@const prevNote = findLastConditioningNote($appState, ex.name, week, day)}
              {#if prevNote}
                <div class="cond-prev">
                  <span class="cond-prev-lbl">Last session</span>
                  <span class="cond-prev-text">{prevNote}</span>
                </div>
              {/if}
              <textarea
                class="cond-textarea"
                bind:value={localCondNote[ex.id]}
                on:blur={() => commitCondNote(week, day, ex.id)}
                placeholder="Log this session — e.g. 12 min @ 160W, RPE 7"
                rows="4"
              ></textarea>

            {:else if ex.recovery}
              <button
                class="recovery-toggle"
                class:recovery-done={ex.recoveryDone}
                on:click={() => toggleRecoveryDone(week, day, ex.id)}
              >
                {ex.recoveryDone ? '✓ Done' : 'Tap to mark done'}
              </button>

            {:else}
              <!-- Strength sets -->
              <div class="sets-grid">
                {#each ex.sets as set, i}
                  {@const k = `${ex.id}-${i}`}
                  <div class="set-row" class:done={set.done}>
                    <span class="set-n">{i + 1}</span>

                    <div class="set-col">
                      <label class="set-lbl" for="wm-kg-{ex.id}-{i}">kg</label>
                      <input
                        id="wm-kg-{ex.id}-{i}"
                        class="set-inp"
                        type="text"
                        inputmode="decimal"
                        bind:value={localKg[k]}
                        on:blur={() => commitKg(week, day, ex.id, i)}
                        on:keydown={e => e.key === 'Enter' && (e.target as HTMLElement).blur()}
                        placeholder="—"
                        autocomplete="off"
                      />
                    </div>

                    <div class="set-col">
                      <label class="set-lbl" for="wm-reps-{ex.id}-{i}">reps</label>
                      <input
                        id="wm-reps-{ex.id}-{i}"
                        class="set-inp"
                        type="text"
                        inputmode="numeric"
                        bind:value={localReps[k]}
                        on:blur={() => commitReps(week, day, ex.id, i)}
                        on:keydown={e => e.key === 'Enter' && (e.target as HTMLElement).blur()}
                        placeholder="—"
                        autocomplete="off"
                      />
                    </div>

                    <button
                      class="done-btn"
                      class:on={set.done}
                      on:click={() => handleSetDone(week, day, ex.id, i, set.done, ex.rest)}
                      aria-pressed={set.done}
                      aria-label={set.done ? 'Undo set' : 'Mark set done'}
                    >
                      {set.done ? '✓' : '○'}
                    </button>

                    <button
                      class="del-btn"
                      on:click={() => handleDeleteSet(week, day, ex.id, i)}
                      aria-label="Delete set"
                    >×</button>
                  </div>
                {/each}
              </div>

              <button class="add-set-btn" on:click={() => handleAddSet(week, day, ex.id)}>
                + Add set
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Rest timer -->
      {#if restActive && $uiState.restStartTime !== null && $uiState.restTotal !== null}
        <RestTimer
          startTime={$uiState.restStartTime}
          totalSeconds={$uiState.restTotal}
          on:done={clearRest}
          on:skip={clearRest}
        />
      {/if}
    </div>
  {/if}

  <!-- Footer nav -->
  <footer class="wm-footer">
    {#if isLast}
      <!-- Last block: always show Finish Workout -->
      <button class="btn-nav" on:click={prev} disabled={isFirst}>‹ Prev</button>
      <button class="btn-end" on:click={backToNormal}>← Back</button>
      <button class="btn-finish-wod" on:click={openSummary}>Finish ✓</button>
    {:else}
      <button class="btn-nav" on:click={prev} disabled={isFirst}>‹ Prev</button>
      <button class="btn-end" on:click={backToNormal}>← Back</button>
      <button class="btn-nav primary" on:click={next}>Next ›</button>
    {/if}
  </footer>
</div>

<!-- ===== Workout Summary Overlay ===== -->
{#if showSummary}
  <div class="summary-overlay">
    <div class="summary-card">
      <div class="summary-header">
        <span class="summary-icon">🏁</span>
        <span class="summary-title">Workout Done</span>
      </div>

      <!-- Duration -->
      <div class="summary-stat-row">
        <div class="summary-stat">
          <span class="sstat-val">{formatElapsed(summaryElapsed)}</span>
          <span class="sstat-lbl">Duration</span>
        </div>
        <div class="summary-stat">
          <span class="sstat-val">{summarySetsDone}</span>
          <span class="sstat-lbl">Sets done</span>
        </div>
        <div class="summary-stat">
          <span class="sstat-val">{fmtVolume(summaryVolume)}</span>
          <span class="sstat-lbl">Volume</span>
        </div>
      </div>

      <!-- Exercise list -->
      <div class="summary-ex-list">
        {#each summaryExercises as ex}
          <div class="summary-ex-row" class:sdone={ex.done}>
            <span class="sex-check">{ex.done ? '✓' : '○'}</span>
            <span class="sex-name">{ex.name}</span>
            {#if !ex.conditioning && !ex.recovery}
              <span class="sex-sets">{ex.setsDone}/{ex.setsTotal}</span>
            {:else if ex.conditioning}
              <span class="sex-tag">Cardio</span>
            {:else}
              <span class="sex-tag">Recovery</span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Done button -->
      <button class="summary-done-btn" on:click={confirmFinish}>
        Done
      </button>
    </div>
  </div>
{/if}

<style>
  .wm-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at 50% 0%, #0d1a2e 0%, #08090f 55%, #050508 100%);
    z-index: 100;
    display: flex;
    flex-direction: column;
    max-width: 640px;
    margin: 0 auto;
    overflow: hidden;
  }

  /* Header */
  .wm-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px 12px;
    padding-top: calc(14px + env(safe-area-inset-top));
    border-bottom: 1px solid rgba(65,100,170,0.16);
    flex-shrink: 0;
  }

  .wm-exit {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(70,110,185,0.24);
    background: rgba(14,25,55,0.65);
    color: rgba(255,255,255,0.65);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .wm-progress {
    font-size: 14px;
    font-weight: 700;
    color: rgba(255,255,255,0.45);
    flex-shrink: 0;
  }

  .wm-dots {
    display: flex;
    gap: 5px;
    flex: 1;
    flex-wrap: wrap;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(15,28,58,0.80);
    transition: background 0.15s;
  }

  .dot.active { background: #c49230; }
  .dot.done   { background: rgba(79,192,141,0.6); }

  .wm-clock {
    font-size: 15px;
    font-weight: 800;
    color: #7fa8d4;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  /* Content */
  .wm-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
  }

  .block-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .block-badge {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 8px;
  }

  .block-badge.superset {
    background: rgba(127,178,255,0.12);
    border: 1px solid rgba(127,178,255,0.28);
    color: #7fb2ff;
  }

  .block-badge.single {
    background: rgba(14,25,55,0.65);
    border: 1px solid rgba(70,110,185,0.24);
    color: rgba(255,255,255,0.45);
  }

  .block-badge.cond {
    background: rgba(79,192,141,0.08);
    border: 1px solid rgba(79,192,141,0.20);
    color: #4fc08d;
  }

  .exercises-wrap {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .ex-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ex-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ex-code {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: rgba(127,178,255,0.12);
    border: 1px solid rgba(127,178,255,0.25);
    color: #7fb2ff;
    font-size: 11px;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ex-name {
    font-size: 18px;
    font-weight: 900;
    color: #ffffff;
    letter-spacing: -0.02em;
    flex: 1;
  }

  .ex-rest {
    font-size: 12px;
    font-weight: 700;
    color: #4a8070;
    background: rgba(79,192,141,0.08);
    border: 1px solid rgba(79,192,141,0.18);
    border-radius: 8px;
    padding: 3px 8px;
    flex-shrink: 0;
  }

  .ex-note {
    font-size: 14px;
    color: rgba(255,255,255,0.45);
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(12,20,44,0.50);
    border: 1px solid rgba(60,90,160,0.13);
  }

  /* Last session (strength) */
  .last-session {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 10px;
    background: rgba(196,148,46,0.06);
    border: 1px solid rgba(196,148,46,0.14);
    flex-wrap: wrap;
  }

  .last-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9a7828;
    flex-shrink: 0;
  }

  .last-sets { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }

  .last-set {
    font-size: 13px;
    font-weight: 700;
    color: #d4a838;
    font-variant-numeric: tabular-nums;
  }

  /* Conditioning: previous session */
  .cond-prev {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 13px;
    border-radius: 12px;
    background: rgba(79,192,141,0.05);
    border: 1px solid rgba(79,192,141,0.14);
  }

  .cond-prev-lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #3a8a6a;
  }

  .cond-prev-text {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.55);
    line-height: 1.45;
  }

  /* Conditioning textarea */
  .cond-textarea {
    width: 100%;
    box-sizing: border-box;
    background: rgba(14,26,55,0.70);
    border: 1px solid rgba(70,110,185,0.24);
    border-radius: 14px;
    padding: 14px 16px;
    font-size: 16px;
    font-weight: 500;
    color: #ffffff;
    font-family: inherit;
    line-height: 1.55;
    resize: none;
    outline: none;
    transition: border-color 0.12s;
    min-height: 110px;
  }

  .cond-textarea:focus { border-color: rgba(79,192,141,0.40); }
  .cond-textarea::placeholder { color: rgba(255,255,255,0.22); }

  /* Sets */
  .sets-grid { display: flex; flex-direction: column; gap: 10px; }

  .set-row {
    display: grid;
    grid-template-columns: 32px 1fr 1fr 62px 34px;
    align-items: center;
    gap: 7px;
    padding: 2px 0;
    border-radius: 14px;
    transition: background 0.15s;
  }

  .set-row.done { background: rgba(79,192,141,0.04); }

  .set-n {
    font-size: 16px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    text-align: center;
    user-select: none;
  }

  .set-row.done .set-n { color: rgba(79,192,141,0.55); }

  .set-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(13,24,52,0.85);
    border: 1px solid rgba(70,110,185,0.22);
    border-radius: 13px;
    padding: 11px 14px;
    min-height: 68px;
    justify-content: center;
  }

  .set-row.done .set-col {
    border-color: rgba(79,192,141,0.18);
    background: rgba(79,192,141,0.05);
  }

  .set-lbl {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.38);
    user-select: none;
  }

  .set-inp {
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    font-size: 26px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    width: 100%;
    min-width: 0;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .set-row.done .set-inp { color: rgba(79,192,141,0.90); }
  .set-inp::placeholder { color: rgba(255,255,255,0.18); }
  .set-inp:focus { color: #ffffff; }

  .done-btn {
    height: 68px;
    border-radius: 13px;
    border: 1px solid rgba(80,120,200,0.30);
    background: rgba(14,25,55,0.65);
    color: rgba(255,255,255,0.55);
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .done-btn.on {
    background: rgba(79,192,141,0.15);
    border-color: rgba(79,192,141,0.50);
    color: #4fc08d;
    font-weight: 700;
  }

  .done-btn:active { transform: scale(0.94); }

  .del-btn {
    height: 32px;
    width: 32px;
    border-radius: 9px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.22);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .del-btn:active { background: rgba(255,80,80,0.14); color: #ff6060; }

  .add-set-btn {
    width: 100%;
    padding: 13px;
    border-radius: 12px;
    border: 1px dashed rgba(75,115,195,0.26);
    background: transparent;
    color: rgba(255,255,255,0.38);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .add-set-btn:active {
    background: rgba(14,25,55,0.65);
    color: rgba(255,255,255,0.65);
    border-color: rgba(255,255,255,0.28);
  }

  /* Recovery toggle */
  .recovery-toggle {
    width: 100%;
    padding: 18px;
    border-radius: 16px;
    border: 1px solid rgba(65,100,175,0.18);
    background: rgba(12,22,48,0.55);
    color: rgba(255,255,255,0.45);
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .recovery-toggle.recovery-done {
    background: rgba(79,192,141,0.10);
    border-color: rgba(79,192,141,0.30);
    color: #4fc08d;
  }

  .recovery-toggle:active { background: rgba(15,28,58,0.80); }
  .recovery-toggle.recovery-done:active { background: rgba(79,192,141,0.18); }

  /* Footer */
  .wm-footer {
    padding: 12px 14px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    border-top: 1px solid rgba(60,90,160,0.13);
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .btn-nav {
    flex: 1;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid rgba(75,115,195,0.26);
    background: rgba(14,26,55,0.70);
    color: rgba(255,255,255,0.65);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-nav.primary {
    background: rgba(196,148,46,0.12);
    border-color: rgba(196,148,46,0.30);
    color: #c49230;
  }

  .btn-nav:disabled { opacity: 0.25; cursor: not-allowed; }
  .btn-nav:not(:disabled):active { background: rgba(255,255,255,0.11); }
  .btn-nav.primary:not(:disabled):active { background: rgba(196,148,46,0.22); }

  .btn-end {
    flex: 0 0 auto;
    padding: 16px 14px;
    border-radius: 14px;
    border: 1px solid rgba(70,110,185,0.24);
    background: rgba(14,25,55,0.65);
    color: rgba(255,255,255,0.50);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .btn-end:active { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.70); }

  /* Finish Workout — solid gold, last block footer */
  .btn-finish-wod {
    flex: 2;
    padding: 16px;
    border-radius: 14px;
    border: none;
    background: #c49230;
    color: #0c0c0e;
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow: 0 4px 24px rgba(196,148,46,0.25);
    transition: background 0.12s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-finish-wod:active { background: #b07e22; transform: scale(0.98); }

  /* ===== Summary Overlay ===== */
  .summary-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0,0,0,0.78);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 0 env(safe-area-inset-bottom);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: sfade 0.2s ease;
  }

  @keyframes sfade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .summary-card {
    width: 100%;
    max-width: 640px;
    background: #0d1828;
    border: 1px solid rgba(70,110,185,0.28);
    border-radius: 28px 28px 0 0;
    padding: 28px 20px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: sslide 0.25s ease;
  }

  @keyframes sslide {
    from { transform: translateY(60px); opacity: 0.4; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .summary-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .summary-icon { font-size: 28px; line-height: 1; }

  .summary-title {
    font-size: 22px;
    font-weight: 900;
    color: #ffffff;
    letter-spacing: -0.03em;
  }

  .summary-stat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .summary-stat {
    background: rgba(12,22,48,0.55);
    border: 1px solid rgba(65,100,170,0.16);
    border-radius: 16px;
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .sstat-val {
    font-size: 22px;
    font-weight: 900;
    color: #c49230;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .sstat-lbl {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.38);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .summary-ex-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
  }

  .summary-ex-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    background: rgba(12,20,44,0.50);
    border: 1px solid rgba(60,90,160,0.13);
  }

  .summary-ex-row.sdone {
    background: rgba(79,192,141,0.06);
    border-color: rgba(79,192,141,0.15);
  }

  .sex-check {
    font-size: 13px;
    font-weight: 900;
    color: rgba(255,255,255,0.25);
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  .summary-ex-row.sdone .sex-check { color: #4fc08d; }

  .sex-name {
    flex: 1;
    font-size: 14px;
    font-weight: 700;
    color: rgba(255,255,255,0.60);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .summary-ex-row.sdone .sex-name { color: rgba(255,255,255,0.85); }

  .sex-sets {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    flex-shrink: 0;
  }

  .summary-ex-row.sdone .sex-sets { color: #4fc08d; }

  .sex-tag {
    font-size: 11px;
    font-weight: 700;
    color: rgba(79,192,141,0.70);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .summary-done-btn {
    width: 100%;
    padding: 18px;
    border-radius: 16px;
    border: none;
    background: #c49230;
    color: #0c0c0e;
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 4px 28px rgba(196,148,46,0.30);
    transition: background 0.12s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .summary-done-btn:active { background: #b07e22; transform: scale(0.98); }
</style>
