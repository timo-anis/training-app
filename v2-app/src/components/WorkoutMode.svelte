<script lang="ts">
  import { onDestroy } from 'svelte';
  import { uiState, appState, workoutBlocks, exitWorkout, closeWorkoutMode, setActiveBlock, toggleSetDone, updateSetField, findLastSession, toggleRecoveryDone } from '../stores/app';
  import type { WorkoutBlock, LastSession } from '../stores/app';
  import RestTimer from './RestTimer.svelte';

  const DAY_SHORT: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };

  // Elapsed workout timer
  let elapsed = 0;
  const clockInterval = setInterval(() => {
    const start = $uiState.workoutStartTime;
    elapsed = start ? Math.floor((Date.now() - start) / 1000) : 0;
  }, 1000);
  onDestroy(() => clearInterval(clockInterval));

  function formatElapsed(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  // Active block index comes from uiState.activeExerciseIndex
  $: blocks = $workoutBlocks;
  $: activeIndex = $uiState.activeExerciseIndex;
  $: block = blocks[activeIndex] ?? null;
  $: isFirst = activeIndex === 0;
  $: isLast = activeIndex === blocks.length - 1;

  // Rest timer state
  let restActive = false;
  let restString = '';

  // Helper: is a single exercise considered done?
  function exDone(ex: import('../types/workout').Exercise): boolean {
    if (ex.recovery) return ex.recoveryDone;
    return ex.sets.length > 0 && ex.sets.every(s => s.done);
  }

  // All blocks done across workout
  $: allDone = blocks.every(b => b.exercises.every(exDone));

  // Is a specific block done (for dots)?
  function blockDone(b: WorkoutBlock): boolean {
    return b.exercises.every(exDone);
  }

  function handleSetDone(week: number, day: import('../types/workout').DayOfWeek, exId: string, setIndex: number, currentDone: boolean, exRestString: string) {
    toggleSetDone(week, day, exId, setIndex);
    // Start rest timer only when marking done (not undoing)
    if (!currentDone && exRestString) {
      restString = exRestString;
      restActive = true;
    }
  }

  function onRestDone() { restActive = false; }
  function onRestSkip() { restActive = false; }

  function prev() {
    if (!isFirst) setActiveBlock(activeIndex - 1);
  }

  function next() {
    if (!isLast) setActiveBlock(activeIndex + 1);
  }

  /** Close overlay, keep timer running */
  function backToNormal() {
    closeWorkoutMode();
  }

  /** End workout entirely */
  function finish() {
    exitWorkout();
  }

  // Local editable inputs per exercise per set
  // We use a map keyed by `${exId}-${setIndex}`
  let localKg: Record<string, string> = {};
  let localReps: Record<string, string> = {};

  $: {
    // Sync locals when block changes
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
                </div>
              {/each}
            </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Rest timer -->
      {#if restActive}
        <RestTimer {restString} on:done={onRestDone} on:skip={onRestSkip} />
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
    background: #08172d;
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
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .wm-exit {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    color: #4a6a8a;
    font-size: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .wm-progress {
    font-size: 13px;
    font-weight: 700;
    color: #4a6a8a;
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
    font-size: 13px;
    font-weight: 800;
    color: #4a6a8a;
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
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #8a6a20;
    flex-shrink: 0;
  }

  .last-sets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }

  .last-set {
    font-size: 12px;
    font-weight: 700;
    color: #c8962a;
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
  }

  .block-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .block-badge {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 8px;
  }

  .block-badge.superset {
    background: rgba(127,178,255,0.12);
    border: 1px solid rgba(127,178,255,0.25);
    color: #7fb2ff;
  }

  .block-badge.single {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    color: #4a6a8a;
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
    font-size: 17px;
    font-weight: 900;
    color: #e8f2ff;
    letter-spacing: -0.02em;
    flex: 1;
  }

  .ex-rest {
    font-size: 11px;
    font-weight: 700;
    color: #3a6a5a;
    background: rgba(79,192,141,0.08);
    border: 1px solid rgba(79,192,141,0.15);
    border-radius: 8px;
    padding: 3px 8px;
    flex-shrink: 0;
  }

  .ex-note {
    font-size: 13px;
    color: #4a7aaa;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }

  /* Sets */
  .sets-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .set-row {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 48px;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    border-radius: 10px;
    transition: background 0.15s;
  }

  .set-row.done { background: rgba(79,192,141,0.04); }

  .set-n {
    font-size: 12px;
    font-weight: 700;
    color: #4a6a8a;
    text-align: center;
    user-select: none;
  }

  .set-row.done .set-n { color: rgba(79,192,141,0.55); }

  .set-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 6px 10px;
  }

  .set-row.done .set-col {
    border-color: rgba(79,192,141,0.15);
    background: rgba(79,192,141,0.05);
  }

  .set-lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #3a5a7a;
    user-select: none;
  }

  .set-inp {
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    font-size: 16px;
    font-weight: 700;
    color: #d8eafc;
    letter-spacing: -0.01em;
    width: 100%;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  .set-row.done .set-inp { color: rgba(79,192,141,0.85); }
  .set-inp::placeholder { color: #2a4a6a; }
  .set-inp:focus { color: #ffffff; }

  .done-btn {
    height: 44px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.03);
    color: #4a6a8a;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .done-btn.on {
    background: rgba(79,192,141,0.13);
    border-color: rgba(79,192,141,0.45);
    color: #4fc08d;
    font-weight: 700;
  }

  .done-btn:active { transform: scale(0.95); }

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
    padding: 15px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    color: #4a6a8a;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-nav.primary {
    background: rgba(255,194,71,0.12);
    border-color: rgba(255,194,71,0.3);
    color: #ffc247;
  }

  .btn-nav:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .btn-nav:not(:disabled):active { background: rgba(255,255,255,0.09); }
  .btn-nav.primary:not(:disabled):active { background: rgba(255,194,71,0.2); }

  /* ← Back button (mid-workout) */
  .btn-end {
    flex: 0 0 auto;
    padding: 15px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.07);
    background: transparent;
    color: #2a4a6a;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .btn-end:active { background: rgba(255,255,255,0.06); color: #7fa8d4; }

  /* All done footer: ← Back + Finish ✓ */
  .btn-back {
    flex: 1;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    color: #4a6a8a;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .btn-back:active { background: rgba(255,255,255,0.09); }

  .btn-finish {
    flex: 2;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid rgba(79,192,141,0.4);
    background: rgba(79,192,141,0.15);
    color: #4fc08d;
    font-size: 16px;
    font-weight: 900;
    cursor: pointer;
    letter-spacing: -0.01em;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-finish:active { background: rgba(79,192,141,0.25); }

  /* Recovery toggle */
  .recovery-toggle {
    width: 100%;
    padding: 18px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    color: #4a6a8a;
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
