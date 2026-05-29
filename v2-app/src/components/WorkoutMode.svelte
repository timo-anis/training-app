<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    uiState, appState, workoutBlocks, exitWorkout, closeWorkoutMode, weekOffset,
    setActiveBlock, toggleSetDone, updateSetField, findLastSession,
    findLastConditioningNote, toggleRecoveryDone, toggleConditioningDone, updateUI,
    addSet, deleteSet, insertSet, updateConditioningNote, markWorkoutComplete,
    renameExercise, updateDayNote, addExercise,
  } from '../stores/app';
  import type { WorkoutBlock } from '../stores/app';
  import type { DayOfWeek, WorkoutSet } from '../types/workout';
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
    if (undoTimer) clearTimeout(undoTimer);
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

  function resetRest() {
    const total = $uiState.restTotal;
    if (total) updateUI(ui => ({ ...ui, restStartTime: Date.now(), restTotal: total }));
  }

  // ---- Exercise/block done helpers ----
  function exDone(ex: import('../types/workout').Exercise): boolean {
    if (ex.recovery) return ex.recoveryDone;
    if (ex.conditioning) return ex.conditioningDone === true;
    return ex.sets.length > 0 && ex.sets.every(s => s.done);
  }

  $: allDone = blocks.every(b => b.exercises.every(exDone));

  function blockDone(b: WorkoutBlock): boolean {
    return b.exercises.every(exDone);
  }

  function handleSetDone(week: number, day: DayOfWeek, exId: string, setIndex: number, currentDone: boolean, exRestString: string) {
    // Commit current local values (including any prefill) before toggling done
    commitKg(week, day, exId, setIndex);
    commitReps(week, day, exId, setIndex);
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

  // confirmFinish is defined below (after swipe/flash helpers)

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

  // ---- Inline exercise rename ----
  let editingNameId: string | null = null;
  let editingNameValue = '';

  function startRename(exId: string, currentName: string) {
    editingNameId = exId;
    editingNameValue = currentName;
  }

  function commitRename(week: number, day: DayOfWeek, exId: string) {
    if (editingNameValue.trim()) renameExercise(week, day, exId, editingNameValue);
    editingNameId = null;
  }

  // Svelte action: auto-focus + select-all when input mounts
  function focusOnMount(node: HTMLElement) {
    node.focus();
    (node as HTMLInputElement).select();
    return {};
  }

  // ---- #1 kg +/- adjustment ----
  function adjustKg(week: number, day: DayOfWeek, exId: string, i: number, delta: number) {
    const k = `${exId}-${i}`;
    const raw = (localKg[k] ?? '').replace(',', '.').trim();
    const current = parseFloat(raw) || 0;
    const next = Math.max(0, parseFloat((current + delta).toFixed(2)));
    localKg[k] = next > 0 ? String(next) : '';
    localKg = localKg; // trigger reactivity
    updateSetField(week, day, exId, i, 'kg', localKg[k]);
  }

  // ---- reps +/- adjustment ----
  function adjustReps(week: number, day: DayOfWeek, exId: string, i: number, delta: number) {
    const k = `${exId}-${i}`;
    const raw = (localReps[k] ?? '').trim();
    const current = parseInt(raw, 10) || 0;
    const next = Math.max(1, current + delta);
    localReps[k] = String(next);
    localReps = localReps;
    updateSetField(week, day, exId, i, 'reps', localReps[k]);
  }

  // ---- #2 manual rest timer presets ----
  function startRestSecs(secs: number) {
    if (secs > 0) updateUI(ui => ({ ...ui, restStartTime: Date.now(), restTotal: secs }));
  }

  // ---- #3 day-level session note ----
  // Lock week/day at the moment the note is opened — prevents saving to wrong
  // day if $uiState changes between open and blur.
  let noteWeek = $uiState.week;
  let noteDay  = $uiState.day;
  let localDayNote: string = $appState.weeks.find(
    w => w.week === noteWeek && w.day === noteDay
  )?.note ?? '';
  let showDayNote = !!localDayNote;

  function openDayNote() {
    // Re-read week/day and fresh note content every time the note is opened
    noteWeek     = $uiState.week;
    noteDay      = $uiState.day;
    localDayNote = $appState.weeks.find(
      w => w.week === noteWeek && w.day === noteDay
    )?.note ?? '';
    showDayNote  = true;
  }

  function commitDayNote() {
    updateDayNote(noteWeek, noteDay, localDayNote);
  }

  // ---- #5 add exercise within workout mode ----
  let showAddEx = false;
  let addExName = '';

  function handleAddExInWorkout() {
    const name = addExName.trim();
    if (!name) return;
    addExercise($uiState.week, $uiState.day, name);
    addExName = '';
    showAddEx = false;
  }

  // ---- #8 undo last destructive action ----
  interface UndoAction { label: string; fn: () => void; }
  let undoPending: UndoAction | null = null;
  let undoTimer: ReturnType<typeof setTimeout> | null = null;

  function pushUndo(action: UndoAction) {
    if (undoTimer) clearTimeout(undoTimer);
    undoPending = action;
    undoTimer = setTimeout(() => { undoPending = null; }, 5000);
  }

  function execUndo() {
    if (!undoPending) return;
    if (undoTimer) clearTimeout(undoTimer);
    undoPending.fn();
    undoPending = null;
  }

  // ---- Local editable inputs (sets) ----
  let localKg: Record<string, string> = {};
  let localReps: Record<string, string> = {};
  let localCondNote: Record<string, string> = {};

  // Sync locals when block changes — prefill from last session when set is empty
  $: {
    if (block) {
      for (const ex of block.exercises) {
        const lastSess = ex.conditioning ? null : findLastSession($appState, ex.name, $uiState.week, $uiState.day);
        ex.sets.forEach((s, i) => {
          const k = `${ex.id}-${i}`;
          if (localKg[k] === undefined)   localKg[k]   = s.kg   || lastSess?.sets[i]?.kg   || '';
          if (localReps[k] === undefined)  localReps[k] = s.reps || lastSess?.sets[i]?.reps || '';
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
    editingNameId = null; // cancel any in-progress rename on block change
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
    // Capture state for undo before deleting
    const wd = $appState.weeks.find(w => w.week === week && w.day === day);
    const targetEx = wd?.exercises.find(e => e.id === exId);
    const capturedSet: WorkoutSet | null = targetEx ? { ...targetEx.sets[i] } : null;
    const capturedIdx = i;

    deleteSet(week, day, exId, i);
    localKg = {};
    localReps = {};

    if (capturedSet) {
      pushUndo({
        label: `Set ${capturedIdx + 1} deleted`,
        fn: () => {
          insertSet(week, day, exId, capturedIdx, capturedSet!);
          localKg = {};
          localReps = {};
        },
      });
    }
  }

  // ---- Swipe navigation ----
  let touchStartX = 0;

  function onTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
  }

  function onTouchEnd(e: TouchEvent) {
    if (restActive) return; // don't swipe while rest timer is visible
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 55) {
      if (delta < 0) next();
      else prev();
    }
  }

  // ---- Completion flash ----
  let showCompletionFlash = false;

  function confirmFinish() {
    markWorkoutComplete($uiState.week, $uiState.day);
    showSummary = false;
    showCompletionFlash = true;
    setTimeout(() => {
      showCompletionFlash = false;
      exitWorkout();
    }, 550);
  }
</script>

<div class="wm-overlay">
  <!-- Header -->
  <header class="wm-header">
    <div class="wm-header-row">
      <button class="wm-exit" on:click={backToNormal} title="Back to normal view">‹</button>
      <div class="wm-mid">
        <span class="wm-blk-label">Block</span>
        <span class="wm-progress">{activeIndex + 1} / {blocks.length}</span>
      </div>
      <span class="wm-clock">{formatElapsed(elapsed)}</span>
    </div>
    <div class="wm-progress-bar">
      <div class="wm-progress-fill" style="width: {((activeIndex + 1) / blocks.length) * 100}%"></div>
    </div>
  </header>

  <!-- Block content -->
  {#if block}
    <div class="wm-content" on:touchstart={onTouchStart} on:touchend={onTouchEnd}>
      <!-- Block badge — only for supersets and conditioning blocks -->
      {#if block.isSuperset || block.exercises[0]?.conditioning}
        <div class="block-title">
          {#if block.isSuperset}
            <span class="block-badge superset">Superset {block.code}</span>
          {:else}
            <span class="block-badge cond">No weights</span>
          {/if}
        </div>
      {/if}

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
              {#if editingNameId === ex.id}
                <input
                  class="ex-name-edit"
                  type="text"
                  bind:value={editingNameValue}
                  use:focusOnMount
                  on:blur={() => commitRename(week, day, ex.id)}
                  on:keydown={e => {
                    if (e.key === 'Enter') (e.target as HTMLElement).blur();
                    if (e.key === 'Escape') { editingNameId = null; }
                  }}
                  autocomplete="off"
                />
              {:else}
                <span class="ex-name">{ex.name}</span>
                <button
                  class="ex-rename-btn"
                  on:click={() => startRename(ex.id, ex.name)}
                  aria-label="Rename exercise"
                  title="Rename exercise"
                >✎</button>
              {/if}
              {#if ex.rest && !ex.conditioning}
                <span class="ex-rest">Rest {ex.rest}</span>
              {/if}
            </div>

            {#if lastSession}
              {@const firstK = `${ex.id}-0`}
              {@const curKg = localKg[firstK] ?? ex.sets[0]?.kg ?? ''}
              {@const lastKg = lastSession.sets[0]?.kg ?? ''}
              {@const sameWeight = !!(lastKg && curKg && !isNaN(parseFloat(curKg)) && parseFloat(curKg) === parseFloat(lastKg))}
              {@const hasDone = ex.sets.some(s => s.done)}
              <div class="last-session">
                <span class="last-label">W{lastSession.week - $weekOffset} {DAY_SHORT[lastSession.day]}</span>
                <span class="last-sets">
                  {#each lastSession.sets as s, i}
                    <span class="last-set">{s.kg || '—'} × {s.reps || '—'}{i < lastSession.sets.length - 1 ? ' ·' : ''}</span>
                  {/each}
                </span>
                {#if sameWeight && hasDone}
                  <span class="overload-hint">→ Try {parseFloat(lastKg) + 2.5}kg?</span>
                {/if}
              </div>
            {/if}

            {#if ex.note}
              <div class="ex-note">{ex.note}</div>
            {/if}

            {#if ex.conditioning}
              <!-- Conditioning: done toggle + textarea + previous session -->
              <button
                class="recovery-toggle"
                class:recovery-done={ex.conditioningDone}
                on:click={() => toggleConditioningDone(week, day, ex.id)}
              >
                {ex.conditioningDone ? '✓ Done' : 'Tap to mark done'}
              </button>
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
                      <div class="kg-adj">
                        <button class="kg-adj-btn" on:click|stopPropagation={() => adjustKg(week, day, ex.id, i, -2.5)}>−</button>
                        <button class="kg-adj-btn" on:click|stopPropagation={() => adjustKg(week, day, ex.id, i, +2.5)}>+</button>
                      </div>
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
                      <div class="kg-adj">
                        <button class="kg-adj-btn" on:click|stopPropagation={() => adjustReps(week, day, ex.id, i, -1)}>−</button>
                        <button class="kg-adj-btn" on:click|stopPropagation={() => adjustReps(week, day, ex.id, i, +1)}>+</button>
                      </div>
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

      <!-- #2 Rest timer presets — shown when no timer is running and block has strength exercises -->
      {#if !restActive && block.exercises.some(e => !e.recovery && !e.conditioning)}
        <div class="rest-presets">
          <span class="rest-presets-lbl">REST</span>
          {#each [[60,"1'"],[90,'1:30'],[120,"2'"],[150,'2:30'],[180,"3'"]] as [secs, label]}
            <button class="rest-preset-btn" on:click={() => startRestSecs(secs as number)}>{label}</button>
          {/each}
        </div>
      {/if}

      <!-- #5 Add exercise within workout mode -->
      {#if showAddEx}
        <div class="wm-addex-row">
          <input
            class="wm-addex-input"
            type="text"
            bind:value={addExName}
            use:focusOnMount
            placeholder="Exercise name"
            autocomplete="off"
            on:keydown={e => { if (e.key === 'Enter') handleAddExInWorkout(); if (e.key === 'Escape') { showAddEx = false; addExName = ''; } }}
          />
          <button class="wm-addex-confirm" on:click={handleAddExInWorkout}>Add</button>
          <button class="wm-addex-cancel" on:click={() => { showAddEx = false; addExName = ''; }}>✕</button>
        </div>
      {:else}
        <button class="wm-addex-trigger" on:click={() => showAddEx = true}>+ Add exercise</button>
      {/if}

      <!-- #3 Day session note -->
      <div class="day-note-section">
        {#if showDayNote}
          <textarea
            class="day-note-area"
            bind:value={localDayNote}
            on:blur={commitDayNote}
            placeholder="Session notes — how it felt, new PRs, observations…"
            rows="3"
          ></textarea>
          <button class="day-note-close" on:click={() => { commitDayNote(); showDayNote = false; }}>✓ Done</button>
        {:else}
          <button class="day-note-toggle" on:click={openDayNote}>
            {localDayNote ? '📝 ' + localDayNote.slice(0, 48) + (localDayNote.length > 48 ? '…' : '') : '+ Session note'}
          </button>
        {/if}
      </div>

      <!-- Rest timer -->
      {#if restActive && $uiState.restStartTime !== null && $uiState.restTotal !== null}
        <RestTimer
          startTime={$uiState.restStartTime}
          totalSeconds={$uiState.restTotal}
          on:done={clearRest}
          on:skip={clearRest}
          on:reset={resetRest}
        />
      {/if}
    </div>
  {/if}

  <!-- #8 Undo toast -->
  {#if undoPending}
    <div class="undo-toast">
      <span class="undo-label">{undoPending.label}</span>
      <button class="undo-btn" on:click={execUndo}>Undo</button>
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

<!-- ===== Completion Flash ===== -->
{#if showCompletionFlash}
  <div class="completion-flash">
    <span class="completion-check">✓</span>
  </div>
{/if}

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
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
    border-bottom: 1px solid rgba(65,100,170,0.16);
    flex-shrink: 0;
  }

  .wm-header-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px 10px;
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

  .wm-mid {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .wm-blk-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.38);
  }

  .wm-progress {
    font-size: 20px;
    font-weight: 900;
    color: #ffffff;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .wm-progress-bar {
    height: 3px;
    background: rgba(20,35,70,0.85);
    margin: 0 16px 12px;
    border-radius: 2px;
    overflow: hidden;
  }

  .wm-progress-fill {
    height: 100%;
    border-radius: 2px;
    background: #c49230;
    transition: width 0.3s ease;
  }

  .wm-clock {
    font-size: 15px;
    font-weight: 800;
    color: #ffffff;
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
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.20);
    color: rgba(255,255,255,0.70);
  }

  .block-badge.single {
    background: rgba(14,25,55,0.65);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.45);
  }

  .block-badge.cond {
    background: rgba(196,148,46,0.08);
    border: 1px solid rgba(196,148,46,0.22);
    color: #c49230;
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
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.28);
    color: #ffffff;
    font-size: 13px;
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

  /* ---- #1 kg adjust buttons ---- */
  .kg-adj {
    display: flex;
    gap: 4px;
    margin-top: 5px;
  }

  .kg-adj-btn {
    flex: 1;
    height: 22px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.45);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s, color 0.1s;
    line-height: 1;
  }

  .kg-adj-btn:active { background: rgba(196,148,46,0.18); color: #c49230; }

  /* ---- #2 rest presets ---- */
  .rest-presets {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }

  .rest-presets-lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.28);
    flex-shrink: 0;
  }

  .rest-preset-btn {
    flex: 1;
    padding: 8px 4px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.45);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    text-align: center;
  }

  .rest-preset-btn:active {
    background: rgba(196,148,46,0.14);
    border-color: rgba(196,148,46,0.30);
    color: #c49230;
  }

  /* ---- #5 add exercise in workout ---- */
  .wm-addex-trigger {
    width: 100%;
    padding: 11px;
    border-radius: 12px;
    border: 1px dashed rgba(75,115,195,0.20);
    background: transparent;
    color: rgba(255,255,255,0.28);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .wm-addex-trigger:active {
    background: rgba(14,25,55,0.65);
    color: rgba(255,255,255,0.55);
    border-color: rgba(255,255,255,0.18);
  }

  .wm-addex-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .wm-addex-input {
    flex: 1;
    background: rgba(13,24,52,0.85);
    border: 1px solid rgba(196,148,46,0.40);
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    font-family: inherit;
    outline: none;
    min-width: 0;
  }

  .wm-addex-input::placeholder { color: rgba(255,255,255,0.22); }
  .wm-addex-input:focus { border-color: rgba(196,148,46,0.70); }

  .wm-addex-confirm {
    padding: 12px 16px;
    border-radius: 12px;
    border: none;
    background: rgba(196,148,46,0.18);
    border: 1px solid rgba(196,148,46,0.35);
    color: #c49230;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .wm-addex-confirm:active { background: rgba(196,148,46,0.30); }

  .wm-addex-cancel {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: transparent;
    color: rgba(255,255,255,0.35);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .wm-addex-cancel:active { background: rgba(255,80,80,0.12); color: #ff6060; }

  /* ---- #3 day session note ---- */
  .day-note-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .day-note-toggle {
    width: 100%;
    padding: 11px 14px;
    border-radius: 12px;
    border: 1px dashed rgba(70,110,185,0.16);
    background: transparent;
    color: rgba(255,255,255,0.28);
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .day-note-toggle:active { background: rgba(14,25,55,0.65); color: rgba(255,255,255,0.55); }

  .day-note-area {
    width: 100%;
    box-sizing: border-box;
    background: rgba(14,26,55,0.70);
    border: 1px solid rgba(70,110,185,0.24);
    border-radius: 14px;
    padding: 14px 16px;
    font-size: 15px;
    font-weight: 500;
    color: #ffffff;
    font-family: inherit;
    line-height: 1.55;
    resize: none;
    outline: none;
    transition: border-color 0.12s;
    min-height: 90px;
  }

  .day-note-area:focus { border-color: rgba(70,110,185,0.45); }
  .day-note-area::placeholder { color: rgba(255,255,255,0.20); }

  .day-note-close {
    align-self: flex-end;
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.55);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .day-note-close:active { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); }

  /* ---- #6 overload hint ---- */
  .overload-hint {
    font-size: 12px;
    font-weight: 800;
    color: #c49230;
    letter-spacing: 0.02em;
    flex-shrink: 0;
    animation: hint-pop 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes hint-pop {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* ---- #8 undo toast ---- */
  .undo-toast {
    position: absolute;
    bottom: 0;
    left: 14px;
    right: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(18,30,60,0.96);
    border: 1px solid rgba(70,110,185,0.30);
    border-radius: 14px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: toast-in 0.2s ease;
    z-index: 10;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .undo-label {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.55);
  }

  .undo-btn {
    padding: 7px 14px;
    border-radius: 9px;
    border: 1px solid rgba(196,148,46,0.35);
    background: rgba(196,148,46,0.12);
    color: #c49230;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .undo-btn:active { background: rgba(196,148,46,0.25); }

  .ex-name-edit {
    flex: 1;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(196,148,46,0.50);
    border-radius: 10px;
    padding: 6px 12px;
    font-size: 18px;
    font-weight: 900;
    color: #ffffff;
    letter-spacing: -0.02em;
    outline: none;
    font-family: inherit;
    min-width: 0;
    transition: border-color 0.12s;
  }

  .ex-name-edit:focus { border-color: rgba(196,148,46,0.80); }

  .ex-rename-btn {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.20);
    font-size: 15px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 8px;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
    transition: color 0.12s, background 0.12s;
    line-height: 1;
  }

  .ex-rename-btn:active { color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.08); }

  .ex-rest {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.40);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
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
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.09);
  }

  .cond-prev-lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
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

  .cond-textarea:focus { border-color: rgba(255,255,255,0.25); }
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

  .set-row.done { background: rgba(255,255,255,0.03); }

  .set-n {
    font-size: 16px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    text-align: center;
    user-select: none;
  }

  .set-row.done .set-n { color: rgba(255,255,255,0.55); }

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
    border-color: rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.05);
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

  .set-row.done .set-inp { color: rgba(255,255,255,0.90); }
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
    background: rgba(255,255,255,0.10);
    border-color: rgba(255,255,255,0.30);
    color: rgba(255,255,255,0.92);
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
    background: rgba(255,255,255,0.10);
    border-color: rgba(255,255,255,0.30);
    color: rgba(255,255,255,0.92);
  }

  .recovery-toggle:active { background: rgba(15,28,58,0.80); }
  .recovery-toggle.recovery-done:active { background: rgba(255,255,255,0.16); }

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
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.14);
  }

  .sex-check {
    font-size: 13px;
    font-weight: 900;
    color: rgba(255,255,255,0.25);
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  .summary-ex-row.sdone .sex-check { color: rgba(255,255,255,0.80); }

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

  .summary-ex-row.sdone .sex-sets { color: rgba(255,255,255,0.55); }

  .sex-tag {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.40);
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

  /* ===== Completion Flash ===== */
  .completion-flash {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: flash-in 0.55s ease forwards;
    pointer-events: none;
  }

  @keyframes flash-in {
    0%   { opacity: 0; background: rgba(255,255,255,0.18); }
    20%  { opacity: 1; background: rgba(255,255,255,0.10); }
    100% { opacity: 0; background: rgba(255,255,255,0.00); }
  }

  .completion-check {
    font-size: 96px;
    color: #ffffff;
    animation: check-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards;
  }

  @keyframes check-pop {
    0%   { transform: scale(0.3); opacity: 0; }
    60%  { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1);   opacity: 0.9; }
  }
</style>
