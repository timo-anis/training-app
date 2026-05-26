<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { uiState, appState, workoutBlocks, exitWorkout, closeWorkoutMode, setActiveBlock, toggleSetDone, updateSetField, findLastSession, toggleRecoveryDone, updateUI } from '../stores/app';
  import { addSet, deleteSet } from '../stores/app';
  import type { WorkoutBlock, LastSession } from '../stores/app';
  import RestTimer from './RestTimer.svelte';

  const DAY_SHORT: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };

  // ---- Wake Lock — keep screen on during workout ----
  let wakeLock: WakeLockSentinel | null = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch { /* not supported or denied — silent */ }
  }

  function releaseWakeLock() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  // Re-request after user returns from another app
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

  // ---- Elapsed workout timer ----
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

  // ---- Rest timer — state lives in uiState so it survives overlay close/reopen ----
  function parseRestToSeconds(s: string): number {
    if (!s) return 0;
    s = s.trim().toLowerCase();
    if (/^\d+:\d+$/.test(s)) {
      const [m, sec] = s.split(':').map(Number);
      return m * 60 + sec;
    }
    const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*min?/);
    if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60);
    const secMatch = s.match(/^(\d+(?:\.\d+)?)/);
    if (secMatch) return Math.round(parseFloat(secMatch[1]));
    return 0;
  }

  $: restActive = $uiState.restStartTime !== null && $uiState.restTotal !== null && $uiState.restTotal > 0;

  function startRest(restString: string) {
    const secs = parseRestToSeconds(restString);
    if (secs > 0) {
      updateUI(ui => ({ ...ui, restStartTime: Date.now(), restTotal: secs }));
    }
  }

  function clearRest() {
    updateUI(ui => ({ ...ui, restStartTime: null, restTotal: null }));
  }

  // ---- Exercise done helpers ----
  function exDone(ex: import('../types/workout').Exercise): boolean {
    if (ex.recovery) return ex.recoveryDone;
    return ex.sets.length > 0 && ex.sets.every(s => s.done);
  }

  $: allDone = blocks.every(b => b.exercises.every(exDone));

  function blockDone(b: WorkoutBlock): boolean {
    return b.exercises.every(exDone);
  }

  function handleSetDone(week: number, day: import('../types/workout').DayOfWeek, exId: string, setIndex: number, currentDone: boolean, exRestString: string) {
    toggleSetDone(week, day, exId, setIndex);
    if (!currentDone && exRestString) {
      startRest(exRestString);
    }
  }

  function prev() { if (!isFirst) setActiveBlock(activeIndex - 1); }
  function next() { if (!isLast) setActiveBlock(activeIndex + 1); }

  function backToNormal() { closeWorkoutMode(); }
  function finish() { exitWorkout(); }

  // ---- Local editable inputs ----
  let localKg: Record<string, string> = {};
  let localReps: Record<string, string> = {};

  $: {
    if (block) {
      for (const ex of block.exercises) {
        ex.sets.forEach((s, i) => {
          const k = `${ex.id}-${i}`;
          if (localKg[k] === undefined) localKg[k] = s.kg;
          if (localReps[k] === undefined) localReps[k] = s.reps;
        });
      }
    }
  }

  // When block changes, reset local map for new block's exercises
  let prevActiveIndex = -1;
  $: if (activeIndex !== prevActiveIndex) {
    prevActiveIndex = activeIndex;
    localKg = {};
    localReps = {};
  }

  function commitKg(week: number, day: import('../types/workout').DayOfWeek, exId: string, i: number) {
    const k = `${exId}-${i}`;
    const val = (localKg[k] ?? '').replace(',', '.').trim();
    localKg[k] = val;
    updateSetField(week, day, exId, i, 'kg', val);
  }

  function commitReps(week: number, day: import('../types/workout').DayOfWeek, exId: string, i: number) {
    const k = `${exId}-${i}`;
    const val = (localReps[k] ?? '').trim();
    localReps[k] = val;
    updateSetField(week, day, exId, i, 'reps', val);
  }

  function handleAddSet(week: number, day: import('../types/workout').DayOfWeek, exId: string) {
    addSet(week, day, exId);
    // Reset local map so new set syncs
    localKg = {};
    localReps = {};
  }

  function handleDeleteSet(week: number, day: import('../types/workout').DayOfWeek, exId: string, i: number) {
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
      <!-- Block title -->
      <div class="block-title">
        {#if block.isSuperset}
          <span class="block-badge superset">Superset {block.code}</span>
        {:else}
          <span class="block-badge single">Exercise</span>
        {/if}
      </div>

      <!-- Exercises in this block -->
      <div class="exercises-wrap">
        {#each block.exercises as ex}
          {@const week = $uiState.week}
          {@const day = $uiState.day}
          {@const lastSession = findLastSession($appState, ex.name, week, day)}
          <div class="ex-section">
            <div class="ex-name-row">
              {#if block.isSuperset}
                <span class="ex-code">{ex.code}</span>
              {/if}
              <span class="ex-name">{ex.name}</span>
              {#if ex.rest}
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

            {#if ex.recovery}
              <button
                class="recovery-toggle"
                class:recovery-done={ex.recoveryDone}
                on:click={() => toggleRecoveryDone($uiState.week, $uiState.day, ex.id)}
              >
                {ex.recoveryDone ? '✓ Done' : 'Tap to mark done'}
              </button>
            {:else}
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

              <!-- Add set -->
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
    {#if allDone}
      <button class="btn-back" on:click={backToNormal}>← Back</button>
      <button class="btn-finish" on:click={finish}>Finish ✓</button>
    {:else}
      <button class="btn-nav" on:click={prev} disabled={isFirst}>‹ Prev</button>
      <button class="btn-end" on:click={backToNormal}>← Back</button>
      <button class="btn-nav primary" on:click={next} disabled={isLast}>Next ›</button>
    {/if}
  </footer>
</div>

<style>
  .wm-overlay {
    position: fixed;
    inset: 0;
    background: #0c0c0e;
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
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  }

  .wm-exit {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
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
    background: rgba(255,255,255,0.08);
    transition: background 0.15s;
  }

  .dot.active { background: #ffc247; }
  .dot.done   { background: rgba(79,192,141,0.6); }

  .wm-clock {
    font-size: 15px;
    font-weight: 800;
    color: #7fa8d4;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  /* Last session */
  .last-session {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 10px;
    background: rgba(255,194,71,0.06);
    border: 1px solid rgba(255,194,71,0.14);
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

  .last-sets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }

  .last-set {
    font-size: 13px;
    font-weight: 700;
    color: #d4a838;
    font-variant-numeric: tabular-nums;
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
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.45);
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
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }

  /* Sets */
  .sets-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* set-n | kg col | reps col | done btn | del btn */
  .set-row {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 54px 32px;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    border-radius: 12px;
    transition: background 0.15s;
  }

  .set-row.done { background: rgba(79,192,141,0.04); }

  .set-n {
    font-size: 14px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    text-align: center;
    user-select: none;
  }

  .set-row.done .set-n { color: rgba(79,192,141,0.55); }

  .set-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.11);
    border-radius: 12px;
    padding: 8px 12px;
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
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
    width: 100%;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  .set-row.done .set-inp { color: rgba(79,192,141,0.90); }
  .set-inp::placeholder { color: rgba(255,255,255,0.18); }
  .set-inp:focus { color: #ffffff; }

  .done-btn {
    height: 52px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.55);
    font-size: 22px;
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
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .del-btn:active {
    background: rgba(255,80,80,0.14);
    color: #ff6060;
  }

  /* Add set button */
  .add-set-btn {
    width: 100%;
    padding: 13px;
    border-radius: 12px;
    border: 1px dashed rgba(255,255,255,0.14);
    background: transparent;
    color: rgba(255,255,255,0.38);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .add-set-btn:active {
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.65);
    border-color: rgba(255,255,255,0.28);
  }

  /* Footer */
  .wm-footer {
    padding: 12px 14px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .btn-nav {
    flex: 1;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.65);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-nav.primary {
    background: rgba(255,194,71,0.12);
    border-color: rgba(255,194,71,0.30);
    color: #ffc247;
  }

  .btn-nav:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .btn-nav:not(:disabled):active { background: rgba(255,255,255,0.11); }
  .btn-nav.primary:not(:disabled):active { background: rgba(255,194,71,0.22); }

  /* ← Back button (mid-workout) */
  .btn-end {
    flex: 0 0 auto;
    padding: 16px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.50);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .btn-end:active { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.70); }

  /* All done footer: ← Back + Finish ✓ */
  .btn-back {
    flex: 1;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.60);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .btn-back:active { background: rgba(255,255,255,0.11); }

  .btn-finish {
    flex: 2;
    padding: 16px;
    border-radius: 14px;
    border: none;
    background: #ffc247;
    color: #0c0c0e;
    font-size: 16px;
    font-weight: 900;
    cursor: pointer;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow: 0 4px 24px rgba(255,194,71,0.25);
    transition: background 0.12s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-finish:active { background: #e8b030; transform: scale(0.98); }

  /* Recovery toggle */
  .recovery-toggle {
    width: 100%;
    padding: 18px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.45);
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .recovery-toggle.recovery-done {
    background: rgba(79,192,141,0.10);
    border-color: rgba(79,192,141,0.30);
    color: #4fc08d;
  }

  .recovery-toggle:active { background: rgba(255,255,255,0.08); }
  .recovery-toggle.recovery-done:active { background: rgba(79,192,141,0.18); }
</style>
