<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import {
    uiState, appState, workoutBlocks, exitWorkout, closeWorkoutMode, weekOffset,
    setActiveBlock, toggleSetDone, updateSetField, updateSetRpe, suggestRpeForSet, findLastSession,
    findLastConditioningNote, toggleRecoveryDone, toggleConditioningDone, updateUI,
    addSet, deleteSet, insertSet, updateConditioningNote, markWorkoutComplete,
    renameExercise, updateDayNote, addExercise, deleteExercise, updateExerciseMeta,
    pushUndo, execUndo, undoAction, dayHasActivity,
  } from '../stores/app';
  import type { WorkoutBlock } from '../stores/app';
  import WmFooter from './WmFooter.svelte';
  import WmHeader from './WmHeader.svelte';
  import WmSummary from './WmSummary.svelte';
  import WmRestControls from './WmRestControls.svelte';
  import WmAddExercise from './WmAddExercise.svelte';
  import WmSetRow from './WmSetRow.svelte';
  import type { DayOfWeek, WorkoutSet, Exercise, WorkoutDay } from '../types/workout';
  import { DAY_ORDER } from '../types/workout';
  import { searchExercises } from '../data/exercises';
  import RestTimer from './RestTimer.svelte';
  import { nextSupersetIndex, firstUndoneIndex } from '../lib/state-helpers';

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
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      maybeRestoreRestTimer();
    }
  }

  onMount(() => {
    maybeRestoreRestTimer();
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

  // ---- Superset: show ONE exercise at a time + auto-advance on rest end ----
  let activeSubIndex = 0;
  let advanceAfterRest = false;
  $: visibleExercises = block
    ? (block.isSuperset ? [block.exercises[Math.min(activeSubIndex, block.exercises.length - 1)]] : block.exercises)
    : [];
  function advanceSuperset() {
    if (!block || !block.isSuperset) return;
    const nxt = nextSupersetIndex(block.exercises.map(exDone), activeSubIndex);
    if (nxt !== null) activeSubIndex = nxt;
  }
  function subGoto(i: number) {
    if (!block?.isSuperset) return;
    const n = block.exercises.length;
    activeSubIndex = ((i % n) + n) % n;
  }
  // Auto-advance when a set's rest ends (or is skipped); not on manual reset.
  function onRestEnd() {
    const advance = advanceAfterRest && (block?.isSuperset ?? false);
    clearRest();
    advanceAfterRest = false;
    if (advance) advanceSuperset();
  }

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

  // Format seconds back to "M:SS" (empty when zero → "no rest").
  function secsToRest(sec: number): string {
    if (sec <= 0) return '';
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  // Inline per-exercise rest editing inside workout mode (no need to exit).
  let restEditId: string | null = null;
  function adjustExRest(week: number, day: DayOfWeek, ex: Exercise, delta: number) {
    const next = Math.max(0, parseRestToSeconds(ex.rest) + delta);
    updateExerciseMeta(week, day, ex.id, { rest: secsToRest(next) });
  }

  $: restActive = $uiState.restStartTime !== null && $uiState.restTotal !== null && $uiState.restTotal > 0;
  // armed but not yet counting down: a duration is set but no start time
  $: restPending = $uiState.restStartTime === null && $uiState.restTotal !== null && $uiState.restTotal > 0;

  // ---- Rest timer persistence (survives Android screen-off / tab-kill) ----
  const REST_PERSIST_KEY = 'timo_training_v4_rest_timer';

  // Reactively persist timer whenever it's running; clear when stopped.
  $: {
    if ($uiState.restStartTime !== null && $uiState.restTotal !== null && $uiState.restTotal > 0) {
      try { localStorage.setItem(REST_PERSIST_KEY, JSON.stringify({ s: $uiState.restStartTime, t: $uiState.restTotal })); } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem(REST_PERSIST_KEY); } catch { /* ignore */ }
    }
  }

  // Restore timer from localStorage (called on mount and on screen wake).
  // Only restores if no timer is currently active in the store.
  function maybeRestoreRestTimer() {
    if ($uiState.restStartTime !== null) return; // already active
    try {
      const raw = localStorage.getItem(REST_PERSIST_KEY);
      if (!raw) return;
      const { s, t } = JSON.parse(raw) as { s: number; t: number };
      const elapsedSecs = (Date.now() - s) / 1000;
      if (elapsedSecs < t + 120) {
        // Restore: still running OR expired within last 2 minutes (show GO!)
        updateUI(ui => ({ ...ui, restStartTime: s, restTotal: t }));
      } else {
        localStorage.removeItem(REST_PERSIST_KEY);
      }
    } catch { /* ignore */ }
  }

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

  // Letter for conditioning block — groups by first letter of code (A1+A2+A3 = one A group)
  $: condLetterIndex = (() => {
    const seen = new Set<string>();
    for (let i = 0; i < activeIndex; i++) {
      const b = blocks[i];
      if (!b) continue;
      const key = b.isSuperset ? b.code[0] : `_${i}`;
      seen.add(key);
    }
    return seen.size;
  })();

  $: totalSetsAll = blocks.reduce((sum, b) => {
    return sum + b.exercises.reduce((s, ex) => {
      if (ex.recovery || ex.conditioning) return s + 1;
      return s + ex.sets.length;
    }, 0);
  }, 0);

  $: totalSetsDone = blocks.reduce((sum, b) => {
    return sum + b.exercises.reduce((s, ex) => {
      if (ex.recovery) return s + (ex.recoveryDone ? 1 : 0);
      if (ex.conditioning) return s + (ex.conditioningDone ? 1 : 0);
      return s + ex.sets.filter(set => set.done).length;
    }, 0);
  }, 0);

  function blockDone(b: WorkoutBlock): boolean {
    return b.exercises.every(exDone);
  }

  // Haptic feedback helper
  function vibrate(pattern: number | number[]) {
    try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch { /* ignore */ }
  }

  // PR detection: returns true if current kg > all previous sets for this exercise
  function isPR(exName: string, currentKg: string): boolean {
    const kg = parseFloat(currentKg.replace(',', '.'));
    if (isNaN(kg) || kg <= 0) return false;
    let max = 0;
    for (const wd of $appState.weeks) {
      if (wd.week === $uiState.week && wd.day === $uiState.day) continue;
      for (const ex of wd.exercises) {
        if (ex.name.toLowerCase() !== exName.toLowerCase()) continue;
        for (const s of ex.sets) {
          const v = parseFloat(s.kg);
          if (!isNaN(v) && v > max) max = v;
        }
      }
    }
    return max > 0 && kg > max;
  }

  let prFlashExId: string | null = null;
  let prFlashTimer: ReturnType<typeof setTimeout> | null = null;

  // Visual flash for set-done (iOS vibration substitute)
  let setDoneFlashKey: string | null = null;
  let setDoneFlashTimer: ReturnType<typeof setTimeout> | null = null;

  function handleSetDone(week: number, day: DayOfWeek, exId: string, setIndex: number, currentDone: boolean, exRestString: string, exName: string, kgVal: string) {
    commitKg(week, day, exId, setIndex);
    commitReps(week, day, exId, setIndex);
    toggleSetDone(week, day, exId, setIndex);
    if (!currentDone) {
      vibrate(10);
      const flashKey = `${exId}-${setIndex}`;
      setDoneFlashKey = flashKey;
      if (setDoneFlashTimer) clearTimeout(setDoneFlashTimer);
      setDoneFlashTimer = setTimeout(() => { setDoneFlashKey = null; }, 280);
      if (exRestString) startRest(exRestString);
      // Superset: advance to the next exercise — after the rest ends if there is
      // one, immediately if there is no rest. Cycles A1->A2->A3->A1 until done.
      if (block?.isSuperset) {
        if (parseRestToSeconds(exRestString) > 0) advanceAfterRest = true;
        else advanceSuperset();
      }
      // Undo toast — lets user quickly un-mark if tapped wrong set
      pushUndo({
        label: `Set ${setIndex + 1} marked done`,
        fn: () => toggleSetDone(week, day, exId, setIndex),
      });
      if (isPR(exName, kgVal)) {
        prFlashExId = exId;
        if (prFlashTimer) clearTimeout(prFlashTimer);
        prFlashTimer = setTimeout(() => { prFlashExId = null; }, 3000);
        vibrate([10, 80, 20, 80, 30]);
      }
    }
  }

  function prev() { if (!isFirst) { clearRest(); setActiveBlock(activeIndex - 1); } }
  function next() { if (!isLast) { clearRest(); setActiveBlock(activeIndex + 1); } }
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

  // ---- Premium summary extras (streak, volume delta, best set, PRs, next) ----
  // Pure read-only derivations from existing state — no mutation, no new schema.

  // Strength volume of a day (done sets only).
  function dayVolume(wd: WorkoutDay): number {
    let v = 0;
    for (const ex of wd.exercises) {
      if (ex.recovery || ex.conditioning) continue;
      for (const s of ex.sets) {
        if (!s.done) continue;
        const kg = parseFloat(s.kg);
        const reps = parseInt(s.reps);
        if (!isNaN(kg) && !isNaN(reps)) v += kg * reps;
      }
    }
    return v;
  }

  // Display week number (absolute -> user-facing).
  $: summaryWeekDisplay = $uiState.week - $weekOffset;

  // Streak: consecutive weeks (this week going back) with logged activity.
  $: summaryStreak = (() => {
    const active = new Set<number>();
    for (const wd of $appState.weeks) if (dayHasActivity(wd)) active.add(wd.week);
    active.add($uiState.week); // current session counts even before "completed" is set
    let streak = 0;
    let w = $uiState.week;
    while (active.has(w)) { streak++; w--; }
    return streak;
  })();

  // Volume of the most recent prior session that had strength volume.
  $: summaryPrevVolume = (() => {
    if (!summaryDay) return null;
    const curIdx = DAY_ORDER.indexOf($uiState.day);
    let best: { week: number; dayIdx: number; vol: number } | null = null;
    for (const wd of $appState.weeks) {
      if (wd.week === $uiState.week && wd.day === $uiState.day) continue;
      const dIdx = DAY_ORDER.indexOf(wd.day);
      const isBefore = wd.week < $uiState.week || (wd.week === $uiState.week && dIdx < curIdx);
      if (!isBefore) continue;
      const vol = dayVolume(wd);
      if (vol <= 0) continue;
      const better = !best || wd.week > best.week || (wd.week === best.week && dIdx > best.dayIdx);
      if (better) best = { week: wd.week, dayIdx: dIdx, vol };
    }
    return best ? best.vol : null;
  })();

  $: summaryVolumeDelta = (() => {
    if (summaryPrevVolume === null || summaryPrevVolume <= 0) return null;
    const abs = summaryVolume - summaryPrevVolume;
    if (Math.round(abs) === 0) return null;
    const pct = Math.round((abs / summaryPrevVolume) * 100);
    const sign = abs >= 0 ? '+' : '-';
    const dir: 'up' | 'down' = abs >= 0 ? 'up' : 'down';
    return { pct, dir, label: `${sign}${fmtVolume(Math.abs(abs))}` };
  })();

  // Best (heaviest) done set of the session.
  $: summaryBestSet = (() => {
    if (!summaryDay) return null;
    let best: { name: string; kg: number; reps: string } | null = null;
    for (const ex of summaryDay.exercises) {
      if (ex.recovery || ex.conditioning) continue;
      for (const s of ex.sets) {
        if (!s.done) continue;
        const kg = parseFloat(s.kg);
        if (isNaN(kg) || kg <= 0) continue;
        const reps = parseInt(s.reps) || 0;
        const bestReps = best ? (parseInt(best.reps) || 0) : -1;
        if (!best || kg > best.kg || (kg === best.kg && reps > bestReps)) {
          best = { name: ex.name, kg, reps: s.reps };
        }
      }
    }
    return best ? `${best.name} ${best.kg} × ${best.reps}` : null;
  })();

  // PRs hit this session: exercise whose top done kg beats its prior all-time max.
  $: summaryPRs = (() => {
    if (!summaryDay) return [] as { name: string; oldKg: number; newKg: number }[];
    const out: { name: string; oldKg: number; newKg: number }[] = [];
    for (const ex of summaryDay.exercises) {
      if (ex.recovery || ex.conditioning) continue;
      let newKg = 0;
      for (const s of ex.sets) {
        if (!s.done) continue;
        const v = parseFloat(s.kg);
        if (!isNaN(v) && v > newKg) newKg = v;
      }
      if (newKg <= 0) continue;
      let prevMax = 0;
      for (const wd of $appState.weeks) {
        if (wd.week === $uiState.week && wd.day === $uiState.day) continue;
        for (const e of wd.exercises) {
          if (e.name.toLowerCase() !== ex.name.toLowerCase()) continue;
          for (const s of e.sets) {
            const v = parseFloat(s.kg);
            if (!isNaN(v) && v > prevMax) prevMax = v;
          }
        }
      }
      if (prevMax > 0 && newKg > prevMax) out.push({ name: ex.name, oldKg: prevMax, newKg });
    }
    return out;
  })();

  // Next planned session (soonest day after the current one that has exercises).
  $: summaryNext = (() => {
    const curIdx = DAY_ORDER.indexOf($uiState.day);
    let best: { week: number; dayIdx: number; day: DayOfWeek; count: number } | null = null;
    for (const wd of $appState.weeks) {
      const dIdx = DAY_ORDER.indexOf(wd.day);
      const isAfter = wd.week > $uiState.week || (wd.week === $uiState.week && dIdx > curIdx);
      if (!isAfter) continue;
      const count = wd.exercises.filter(e => !e.recovery).length;
      if (count === 0) continue;
      const earlier = !best || wd.week < best.week || (wd.week === best.week && dIdx < best.dayIdx);
      if (earlier) best = { week: wd.week, dayIdx: dIdx, day: wd.day, count };
    }
    if (!best) return null;
    return { day: best.day, count: best.count, nextWeek: best.week > $uiState.week };
  })();

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

  // +15s: build up the rest duration in 15s steps. Does NOT start the
  // countdown on its own — when not running it only arms the duration.
  function addRestTime() {
    const STEP = 15;
    if (restActive) {
      updateUI(ui => ({ ...ui, restTotal: (ui.restTotal ?? STEP) + STEP }));
    } else {
      updateUI(ui => ({ ...ui, restStartTime: null, restTotal: (ui.restTotal ?? 0) + STEP }));
    }
  }

  // -15s: works while armed (pending) or running.
  // Running: floor at 15s. Pending: drop to 0 clears back to idle.
  function subRestTime() {
    const STEP = 15;
    updateUI(ui => {
      if (ui.restTotal === null) return ui;
      const next = ui.restTotal - STEP;
      if (ui.restStartTime !== null) {
        return { ...ui, restTotal: next < STEP ? STEP : next };
      }
      if (next <= 0) return { ...ui, restStartTime: null, restTotal: null };
      return { ...ui, restTotal: next };
    });
  }

  // Begin the countdown for an armed (pending) duration.
  function startPendingRest() {
    if (restPending) updateUI(ui => ({ ...ui, restStartTime: Date.now() }));
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

  const WM_PAGE_SIZE = 3;
  let addExPage = 0;
  $: addExTrimmed = addExName.trim();
  $: addExMatches = addExTrimmed.length >= 1 ? searchExercises(addExTrimmed) : [];
  $: addExPages = Math.ceil(addExMatches.length / WM_PAGE_SIZE);
  $: addExSuggestions = addExMatches.slice(addExPage * WM_PAGE_SIZE, addExPage * WM_PAGE_SIZE + WM_PAGE_SIZE);
  $: if (addExTrimmed) addExPage = 0;

  $: addExHistory = addExTrimmed.length >= 2 ? (() => {
    const lower = addExTrimmed.toLowerCase();
    let found: { kg: string; reps: string; sets: number } | null = null;
    for (const wd of $appState.weeks) {
      for (const ex of wd.exercises) {
        if (ex.name.toLowerCase().includes(lower) && ex.sets.length > 0) {
          const ds = ex.sets.filter(s => s.done || s.kg || s.reps);
          if (ds.length > 0) {
            const last = ds[ds.length - 1];
            found = { kg: last.kg, reps: last.reps, sets: ds.length };
          }
        }
      }
    }
    return found;
  })() : null;

  function addExOpen() { showAddEx = true; addExPage = 0; }
  function addExCancel() { showAddEx = false; addExName = ''; }
  function addExSetName(value: string) { addExName = value; }
  function addExPrevPage() { if (addExPage > 0) addExPage--; }
  function addExNextPage() { if (addExPage < addExPages - 1) addExPage++; }
  async function addExPick(exerciseName: string) {
    addExercise($uiState.week, $uiState.day, exerciseName);
    showAddEx = false; addExName = '';
    await tick(); setActiveBlock(blocks.length - 1);
  }

  async function handleAddExInWorkout() {
    const name = addExName.trim();
    if (!name) return;
    addExercise($uiState.week, $uiState.day, name);
    addExName = '';
    showAddEx = false;
    // Wait for blocks to update reactively, then jump to the new (last) block
    await tick();
    setActiveBlock(blocks.length - 1);
  }

  // ---- #8 undo — uses global undoAction store ----

  // ---- Local editable inputs (sets) ----
  let localKg: Record<string, string> = {};
  let localReps: Record<string, string> = {};
  let localCondNote: Record<string, string> = {};
  let localNote: Record<string, string> = {};
  let noteEditingId: string | null = null;

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
        // Exercise note: prefill from stored value (empty string if none)
        if (localNote[ex.id] === undefined) localNote[ex.id] = ex.note ?? '';
      }
    }
  }

  // Commit + reset locals on block navigation
  let prevActiveIndex = -1;
  $: if (activeIndex !== prevActiveIndex) {
    // Commit any uncommitted inputs from the previous block before navigating
    if (prevActiveIndex >= 0 && blocks[prevActiveIndex]) {
      const prevBlock = blocks[prevActiveIndex];
      const week = $uiState.week;
      const day = $uiState.day;
      for (const ex of prevBlock.exercises) {
        ex.sets.forEach((_s, i) => {
          const k = `${ex.id}-${i}`;
          if (localKg[k] !== undefined) commitKg(week, day, ex.id, i);
          if (localReps[k] !== undefined) commitReps(week, day, ex.id, i);
        });
        if (ex.conditioning && localCondNote[ex.id] !== undefined) {
          commitCondNote(week, day, ex.id);
        }
        if (localNote[ex.id] !== undefined) commitNote(week, day, ex.id);
      }
    }
    prevActiveIndex = activeIndex;
    const nb = blocks[activeIndex];
    activeSubIndex = nb?.isSuperset ? firstUndoneIndex(nb.exercises.map(exDone)) : 0;
    advanceAfterRest = false;
    localKg = {};
    localReps = {};
    localCondNote = {};
    localNote = {};
    noteEditingId = null;
    editingNameId = null;
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

  function commitNote(week: number, day: DayOfWeek, exId: string) {
    const ex = block?.exercises.find(e => e.id === exId);
    const val = (localNote[exId] ?? '').trim();
    localNote[exId] = val;
    if (!ex || val !== ex.note) updateExerciseMeta(week, day, exId, { note: val });
  }

  function startNote(exId: string) {
    if (localNote[exId] === undefined) localNote[exId] = '';
    noteEditingId = exId;
  }

  function focusEl(node: HTMLElement) { node.focus(); }

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
  <WmHeader
    setsDone={totalSetsDone}
    setsAll={totalSetsAll}
    index={activeIndex}
    count={blocks.length}
    clock={formatElapsed(elapsed)}
    onBack={backToNormal}
    onFinish={openSummary}
  />

  <!-- Block content -->
  {#if block}
    <div class="wm-content" role="group" aria-label="Current workout block (swipe to change)" on:touchstart={onTouchStart} on:touchend={onTouchEnd}>
      <!-- Block badge — only for supersets and conditioning blocks -->
      {#if block.isSuperset || block.exercises[0]?.conditioning}
        <div class="block-title">
          {#if block.isSuperset}
            <span class="block-badge superset">Superset {block.code}</span>
          {:else}
            <span class="block-badge superset">{String.fromCharCode(65 + condLetterIndex)} · No weights</span>
          {/if}
        </div>
      {/if}

      <!-- Superset stepper: one exercise at a time; auto-advances on rest end -->
      {#if block.isSuperset && block.exercises.length > 1}
        <div class="ss-stepper">
          <button class="ss-arrow" on:click={() => subGoto(activeSubIndex - 1)} aria-label="Previous superset exercise">‹</button>
          <div class="ss-dots">
            {#each block.exercises as e, i}
              <button class="ss-dot" class:active={i === activeSubIndex} class:done={exDone(e)} on:click={() => subGoto(i)}>{e.code || (i + 1)}</button>
            {/each}
          </div>
          <button class="ss-arrow" on:click={() => subGoto(activeSubIndex + 1)} aria-label="Next superset exercise">›</button>
        </div>
      {/if}

      <!-- Exercises in this block -->
      <div class="exercises-wrap">
        {#each visibleExercises as ex}
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
                {#if prFlashExId === ex.id}
                  <span class="pr-badge">PR 🏆</span>
                {/if}
                <button
                  class="ex-rename-btn"
                  on:click={() => startRename(ex.id, ex.name)}
                  aria-label="Rename exercise"
                  title="Rename exercise"
                >✎</button>
              {/if}
              {#if !ex.conditioning}
                {#if restEditId === ex.id}
                  <span class="ex-rest-edit">
                    <button class="ex-rest-step" on:click|stopPropagation={() => adjustExRest(week, day, ex, -15)} aria-label="Decrease rest 15 seconds">−</button>
                    <span class="ex-rest-val">{ex.rest || 'none'}</span>
                    <button class="ex-rest-step" on:click|stopPropagation={() => adjustExRest(week, day, ex, 15)} aria-label="Increase rest 15 seconds">＋</button>
                    <button class="ex-rest-ok" on:click|stopPropagation={() => (restEditId = null)} aria-label="Done editing rest">✓</button>
                  </span>
                {:else}
                  <button class="ex-rest ex-rest-btn" on:click|stopPropagation={() => (restEditId = ex.id)} aria-label="Edit rest time">
                    {ex.rest ? `Rest ${ex.rest}` : '+ Rest'}<span class="ex-rest-pencil">✎</span>
                  </button>
                {/if}
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

            <div class="ex-note-block">
              {#if noteEditingId === ex.id}
                <textarea
                  class="ex-note-input"
                  bind:value={localNote[ex.id]}
                  on:blur={() => { commitNote(week, day, ex.id); noteEditingId = null; }}
                  use:focusEl
                  placeholder="Add a note…"
                  rows="2"
                ></textarea>
              {:else if ex.note}
                <button class="ex-note filled" on:click={() => startNote(ex.id)} aria-label="Edit note">
                  <span class="ex-note-text">{ex.note}</span>
                  <span class="ex-note-hint">✎</span>
                </button>
              {:else}
                <button class="ex-note empty" on:click={() => startNote(ex.id)} aria-label="Add note">+ Note</button>
              {/if}
            </div>

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
                  <WmSetRow
                    {set}
                    index={i}
                    idBase={k}
                    bind:kg={localKg[k]}
                    bind:reps={localReps[k]}
                    flash={setDoneFlashKey === k}
                    onCommitKg={() => commitKg(week, day, ex.id, i)}
                    onCommitReps={() => commitReps(week, day, ex.id, i)}
                    onAdjustKg={(d) => adjustKg(week, day, ex.id, i, d)}
                    onAdjustReps={(d) => adjustReps(week, day, ex.id, i, d)}
                    onDone={() => handleSetDone(week, day, ex.id, i, set.done, ex.rest, ex.name, localKg[k] ?? set.kg)}
                    onDelete={() => handleDeleteSet(week, day, ex.id, i)}
                    rpeSuggestion={suggestRpeForSet($appState, ex.name, week, day, localKg[k] ?? set.kg, localReps[k] ?? set.reps)}
                    onPickRpe={(v) => updateSetRpe(week, day, ex.id, i, v)}
                    onClearRpe={() => updateSetRpe(week, day, ex.id, i, '')}
                  />
                {/each}
              </div>

              <button class="add-set-btn" on:click={() => handleAddSet(week, day, ex.id)}>
                + Add set
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Rest timer controls — always visible for strength blocks -->
      {#if block.exercises.some(e => !e.recovery && !e.conditioning)}
        <WmRestControls
          restTotal={$uiState.restTotal}
          {restPending}
          {restActive}
          onSub={subRestTime}
          onAdd={addRestTime}
          onStartPending={startPendingRest}
          onPreset={startRestSecs}
        />
      {/if}

      <!-- #5 Add exercise within workout mode -->
      <WmAddExercise
        open={showAddEx}
        name={addExName}
        suggestions={addExSuggestions}
        pages={addExPages}
        page={addExPage}
        history={addExHistory}
        trimmed={addExTrimmed}
        onOpen={addExOpen}
        onCancel={addExCancel}
        onNameInput={addExSetName}
        onPrevPage={addExPrevPage}
        onNextPage={addExNextPage}
        onPickSuggestion={addExPick}
        onConfirm={handleAddExInWorkout}
      />

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
        {#key $uiState.restStartTime}
          <RestTimer
            startTime={$uiState.restStartTime}
            totalSeconds={$uiState.restTotal}
            on:done={onRestEnd}
            on:skip={onRestEnd}
            on:reset={resetRest}
          />
        {/key}
      {/if}
    </div>
  {/if}

  <!-- #8 Undo toast -->
  {#if $undoAction}
    <div class="undo-toast">
      <span class="undo-label">{$undoAction.label}</span>
      <button class="undo-btn" on:click={execUndo}>Undo</button>
    </div>
  {/if}

  <!-- Footer nav — fixed above rest timer overlay (z-index 150) -->
  <div class="wm-footer-outer">
    <WmFooter {isFirst} {isLast} onPrev={prev} onNext={next} onBack={backToNormal} onFinish={openSummary} />
  </div>
</div>

<!-- ===== Completion Flash ===== -->
{#if showCompletionFlash}
  <div class="completion-flash">
    <span class="completion-check">✓</span>
  </div>
{/if}

<!-- ===== Workout Summary Overlay ===== -->
{#if showSummary}
  <WmSummary
    durationSeconds={summaryElapsed}
    setsDone={summarySetsDone}
    volumeKg={summaryVolume}
    weekDisplay={summaryWeekDisplay}
    streak={summaryStreak}
    volumeDelta={summaryVolumeDelta}
    bestSet={summaryBestSet}
    prs={summaryPRs}
    next={summaryNext}
    exercises={summaryExercises}
    onDone={confirmFinish}
  />
{/if}

<style>
  .wm-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    z-index: 100;
    display: flex;
    flex-direction: column;
    max-width: 640px;
    margin: 0 auto;
    overflow: hidden;
  }

  /* Content */
  .wm-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 14px calc(80px + env(safe-area-inset-bottom, 0px));
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
    background: rgba(var(--c-fg), 0.08);
    border: 1px solid rgba(var(--c-fg), 0.20);
    color: rgba(var(--c-fg), 0.70);
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
    background: rgba(var(--c-fg), 0.12);
    border: 1px solid rgba(var(--c-fg), 0.28);
    color: var(--h-ffffff);
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
    color: var(--h-ffffff);
    letter-spacing: -0.02em;
    flex: 1;
  }

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
    border: 1px dashed rgba(var(--c-edge-e), 0.16);
    background: transparent;
    color: rgba(var(--c-fg), 0.28);
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

  .day-note-toggle:active { background: rgba(var(--c-surface-c), 0.65); color: rgba(var(--c-fg), 0.55); }

  .day-note-area {
    width: 100%;
    box-sizing: border-box;
    background: var(--c-14-26-55-0_70);
    border: 1px solid rgba(var(--c-edge-e), 0.24);
    border-radius: 14px;
    padding: 14px 16px;
    font-size: 16px;
    font-weight: 500;
    color: var(--h-ffffff);
    font-family: inherit;
    line-height: 1.55;
    resize: none;
    outline: none;
    transition: border-color 0.12s;
    min-height: 90px;
  }

  .day-note-area:focus { border-color: rgba(var(--c-edge-e), 0.45); }
  .day-note-area::placeholder { color: rgba(var(--c-fg), 0.20); }

  .day-note-close {
    align-self: flex-end;
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: rgba(var(--c-fg), 0.06);
    color: rgba(var(--c-fg), 0.55);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .day-note-close:active { background: rgba(var(--c-fg), 0.12); color: rgba(var(--c-fg), 0.85); }

  /* ---- #6 overload hint ---- */
  .overload-hint {
    font-size: 12px;
    font-weight: 800;
    color: var(--c-accent-solid);
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
    background: var(--c-18-30-60-0_96);
    border: 1px solid rgba(var(--c-edge-e), 0.30);
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
    color: rgba(var(--c-fg), 0.55);
  }

  .undo-btn {
    padding: 7px 14px;
    border-radius: 9px;
    border: 1px solid rgba(var(--c-accent), 0.35);
    background: rgba(var(--c-accent), 0.12);
    color: var(--c-accent-solid);
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .undo-btn:active { background: rgba(var(--c-accent), 0.25); }

  .ex-name-edit {
    flex: 1;
    background: rgba(var(--c-fg), 0.06);
    border: 1px solid rgba(var(--c-accent), 0.50);
    border-radius: 10px;
    padding: 6px 12px;
    font-size: 18px;
    font-weight: 900;
    color: var(--h-ffffff);
    letter-spacing: -0.02em;
    outline: none;
    font-family: inherit;
    min-width: 0;
    transition: border-color 0.12s;
  }

  .ex-name-edit:focus { border-color: rgba(var(--c-accent), 0.80); }

  .ex-rename-btn {
    background: transparent;
    border: none;
    color: rgba(var(--c-fg), 0.20);
    font-size: 15px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 8px;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
    transition: color 0.12s, background 0.12s;
    line-height: 1;
  }

  .ex-rename-btn:active { color: rgba(var(--c-fg), 0.65); background: rgba(var(--c-fg), 0.08); }

  .pr-badge {
    font-size: 12px;
    font-weight: 900;
    color: var(--c-accent-solid);
    background: rgba(var(--c-accent), 0.18);
    border: 1px solid rgba(var(--c-accent), 0.40);
    border-radius: 8px;
    padding: 3px 8px;
    letter-spacing: 0.04em;
    animation: pr-pop 0.4s cubic-bezier(0.34,1.56,0.64,1);
    flex-shrink: 0;
  }

  @keyframes pr-pop {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }

  .ex-rest {
    font-size: 12px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.55);
    background: rgba(var(--c-fg), 0.05);
    border: 1px solid rgba(var(--c-fg), 0.10);
    border-radius: 8px;
    padding: 3px 8px;
    flex-shrink: 0;
    font-family: inherit;
  }

  .ex-rest-btn {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .ex-rest-btn:active { background: rgba(var(--c-fg), 0.10); }
  .ex-rest-pencil { font-size: 10px; opacity: 0.55; }

  .ex-rest-edit {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    background: rgba(var(--c-fg), 0.05);
    border: 1px solid rgba(var(--c-fg), 0.12);
    border-radius: 8px;
    padding: 2px 4px;
  }
  .ex-rest-val {
    font-size: 12px;
    font-weight: 800;
    color: var(--c-text);
    min-width: 36px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .ex-rest-step {
    width: 26px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(var(--c-fg), 0.14);
    background: rgba(var(--c-fg), 0.06);
    color: var(--c-text);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ex-rest-step:active { background: rgba(var(--c-fg), 0.16); }
  .ex-rest-ok {
    width: 26px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--c-79-192-141-0_45);
    background: var(--c-79-192-141-0_16);
    color: var(--h-4fc08d);
    font-size: 13px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .ex-note-block { width: 100%; }

  .ex-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    text-align: left;
    font-size: 14px;
    color: rgba(var(--c-fg), 0.55);
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(var(--c-surface-a), 0.50);
    border: 1px solid rgba(var(--c-edge-a), 0.13);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, border-color 0.12s;
  }

  .ex-note:active { background: rgba(var(--c-surface-a), 0.70); }
  .ex-note.empty {
    color: rgba(var(--c-fg), 0.40);
    font-weight: 700;
    letter-spacing: 0.03em;
    background: transparent;
    border-style: dashed;
  }

  .ex-note-text { flex: 1 1 auto; white-space: pre-wrap; word-break: break-word; }
  .ex-note-hint { flex: 0 0 auto; font-size: 13px; color: rgba(var(--c-fg), 0.28); }

  .ex-note-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(var(--c-surface-c), 0.65);
    border: 1px solid rgba(var(--c-edge-d), 0.20);
    border-radius: 12px;
    padding: 11px 14px;
    font-size: 16px;
    font-weight: 500;
    color: var(--h-e8f2ff);
    font-family: inherit;
    line-height: 1.5;
    resize: none;
    outline: none;
    transition: border-color 0.12s;
  }

  .ex-note-input:focus { border-color: rgba(var(--c-edge-d), 0.45); }
  .ex-note-input::placeholder { color: rgba(var(--c-fg), 0.28); }

  /* Last session (strength) */
  .last-session {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 10px;
    background: rgba(var(--c-accent), 0.06);
    border: 1px solid rgba(var(--c-accent), 0.14);
    flex-wrap: wrap;
  }

  .last-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--h-9a7828);
    flex-shrink: 0;
  }

  .last-sets { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }

  .last-set {
    font-size: 13px;
    font-weight: 700;
    color: var(--h-d4a838);
    font-variant-numeric: tabular-nums;
  }

  /* Conditioning: previous session */
  .cond-prev {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 13px;
    border-radius: 12px;
    background: rgba(var(--c-fg), 0.03);
    border: 1px solid rgba(var(--c-fg), 0.09);
  }

  .cond-prev-lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(var(--c-fg), 0.35);
  }

  .cond-prev-text {
    font-size: 13px;
    font-weight: 500;
    color: rgba(var(--c-fg), 0.55);
    line-height: 1.45;
  }

  /* Conditioning textarea */
  .cond-textarea {
    width: 100%;
    box-sizing: border-box;
    background: var(--c-14-26-55-0_70);
    border: 1px solid rgba(var(--c-edge-e), 0.24);
    border-radius: 14px;
    padding: 14px 16px;
    font-size: 16px;
    font-weight: 500;
    color: var(--h-ffffff);
    font-family: inherit;
    line-height: 1.55;
    resize: none;
    outline: none;
    transition: border-color 0.12s;
    min-height: 110px;
  }

  .cond-textarea:focus { border-color: rgba(var(--c-fg), 0.25); }
  .cond-textarea::placeholder { color: rgba(var(--c-fg), 0.22); }

  /* Sets */
  .sets-grid { display: flex; flex-direction: column; gap: 10px; }

  .add-set-btn {
    width: 100%;
    padding: 13px;
    border-radius: 12px;
    border: 1px dashed var(--c-75-115-195-0_26);
    background: transparent;
    color: rgba(var(--c-fg), 0.38);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .add-set-btn:active {
    background: rgba(var(--c-surface-c), 0.65);
    color: rgba(var(--c-fg), 0.65);
    border-color: rgba(var(--c-fg), 0.28);
  }

  /* Recovery toggle */
  .recovery-toggle {
    width: 100%;
    padding: 18px;
    border-radius: 16px;
    border: 1px solid rgba(var(--c-edge-d), 0.18);
    background: var(--c-12-22-48-0_55);
    color: rgba(var(--c-fg), 0.45);
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .recovery-toggle.recovery-done {
    background: rgba(var(--c-fg), 0.10);
    border-color: rgba(var(--c-fg), 0.30);
    color: rgba(var(--c-fg), 0.92);
  }

  .recovery-toggle:active { background: var(--c-15-28-58-0_80); }
  .recovery-toggle.recovery-done:active { background: rgba(var(--c-fg), 0.16); }

  /* ===== Completion Flash ===== */
  .completion-flash {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(var(--c-fg), 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: flash-in 0.55s ease forwards;
    pointer-events: none;
  }

  @keyframes flash-in {
    0%   { opacity: 0; background: rgba(var(--c-fg), 0.18); }
    20%  { opacity: 1; background: rgba(var(--c-fg), 0.10); }
    100% { opacity: 0; background: rgba(var(--c-fg), 0.00); }
  }

  .completion-check {
    font-size: 96px;
    color: var(--h-ffffff);
    animation: check-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards;
  }

  @keyframes check-pop {
    0%   { transform: scale(0.3); opacity: 0; }
    60%  { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1);   opacity: 0.9; }
  }

  /* Footer pinned above rest timer overlay */
  .wm-footer-outer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    max-width: 640px;
    margin: 0 auto;
    background: linear-gradient(0deg, var(--h-050508, #050508) 0%, rgba(8,9,15,0.97) 100%);
  }

  /* ---- Superset stepper (one exercise at a time) ---- */
  .ss-stepper { display: flex; align-items: center; gap: 8px; margin: 2px 0 10px; }
  .ss-arrow {
    flex: 0 0 auto; width: 34px; height: 34px; border-radius: 10px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: rgba(var(--c-surface-b), 0.50);
    color: rgba(var(--c-fg), 0.65); font-size: 18px; line-height: 1; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ss-arrow:active { background: rgba(var(--c-surface-b), 0.85); }
  .ss-dots { flex: 1 1 auto; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
  .ss-dot {
    min-width: 38px; height: 30px; padding: 0 10px; border-radius: 9px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: rgba(var(--c-surface-b), 0.40);
    color: rgba(var(--c-fg), 0.55); font-size: 13px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .ss-dot.done { color: var(--h-4fc08d, #4fc08d); border-color: rgba(79, 192, 141, 0.35); }
  .ss-dot.active {
    background: rgba(var(--c-accent), 0.18);
    border-color: rgba(var(--c-accent), 0.50);
    color: var(--c-accent-solid);
  }
  .ss-dot.active.done { color: var(--c-accent-solid); }
</style>
