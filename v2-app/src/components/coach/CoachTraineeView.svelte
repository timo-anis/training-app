<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { DAY_ORDER, emptyAppState, type AppState } from '../../types/workout';
  import {
    appState, uiState, currentDayExercises, weekOffset,
    goToAdjacentDay, updateUI, showToast, currentUser,
  } from '../../stores/app';
  import { loadTraineeState, relativeAge, listUnreadCounts, subscribeToMessages, type TraineeRow } from '../../services/coach';
  import MonthCalendar from '../MonthCalendar.svelte';
  import ExerciseCard from '../ExerciseCard.svelte';
  import CoachNote from '../CoachNote.svelte';
  import { setCoachNotesContext, clearCoachNotes, loadCoachNotesFor } from '../../stores/coachNotes';
  import AssignmentEditor from './AssignmentEditor.svelte';
  import ChatView from '../ChatView.svelte';
  import { setAssignmentContext, clearAssignments, loadAssignmentsFor } from '../../stores/assignments';

  export let trainee: TraineeRow;

  let loading = true;
  let updatedAt: string | null = null;
  let now = Date.now();
  let showChat = false;
  let unreadCount = 0;
  let unreadUnsub: (() => void) | null = null;

  // Block index map — groups supersets as one block (A, B, C…). Same rule as MainView.
  $: blockIndices = (() => {
    const result: Record<string, number> = {};
    let blockIdx = -1;
    let lastGroupKey = '';
    for (const ex of $currentDayExercises) {
      const groupKey = (ex.type === 'superset' && ex.code) ? ex.code[0] : ex.id;
      if (groupKey !== lastGroupKey) { blockIdx++; lastGroupKey = groupKey; }
      result[ex.id] = blockIdx;
    }
    return result;
  })();

  function pickInitialDay(state: AppState) {
    const populated = state.weeks.filter((w) => w.exercises.length > 0);
    if (populated.length === 0) return;
    const weeks = [...new Set(populated.map((w) => w.week))].sort((a, b) => a - b);
    const wk = weeks[weeks.length - 1];
    const days = DAY_ORDER.filter((d) => populated.some((w) => w.week === wk && w.day === d));
    const day = days[days.length - 1] ?? $uiState.day;
    updateUI((u) => ({ ...u, week: wk, day }));
  }

  async function load() {
    loading = true;
    try {
      const res = await loadTraineeState(trainee.traineeId);
      const state = res.state ?? emptyAppState();
      appState.set(state);
      updatedAt = res.updatedAt;
      now = Date.now();
      pickInitialDay(state);
      const coachId = $currentUser?.id ?? null;
      setCoachNotesContext({ coachId, traineeId: trainee.traineeId, canEdit: !!coachId });
      try { await loadCoachNotesFor(trainee.traineeId); } catch { /* notes are optional */ }
      setAssignmentContext({ coachId, traineeId: trainee.traineeId, canEdit: !!coachId });
      try { await loadAssignmentsFor(trainee.traineeId); } catch { /* plan is optional */ }
      try {
        const counts = await listUnreadCounts(coachId ?? '');
        unreadCount = counts[trainee.linkId] ?? 0;
      } catch { /* badge is optional */ }
    } catch {
      showToast('Could not load trainee data', 'error');
      appState.set(emptyAppState());
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function refreshUnread() {
    if (showChat) return; // chat open => messages are being read live
    try {
      const counts = await listUnreadCounts($currentUser?.id ?? '');
      unreadCount = counts[trainee.linkId] ?? 0;
    } catch { /* badge is optional */ }
  }
  function openChat() { unreadCount = 0; showChat = true; }
  function closeChat() { showChat = false; refreshUnread(); }

  // Live: a new message from this trainee bumps the Chat badge without a refresh.
  onMount(() => {
    unreadUnsub = subscribeToMessages(
      trainee.linkId,
      { onInsert: refreshUnread, onUpdate: refreshUnread },
      `messages-coachview:${trainee.linkId}`
    );
  });

  // Leave the shared store clean when the coach navigates away.
  onDestroy(() => { unreadUnsub?.(); appState.set(emptyAppState()); clearCoachNotes(); clearAssignments(); });
</script>

<div class="trainee-view">
  <div class="tv-head">
    <div class="tv-id">
      <span class="tv-name">{trainee.email}</span>
      <span class="tv-fresh">
        {#if loading}Loading…{:else if updatedAt}Updated {relativeAge(updatedAt, now)} · read-only{:else}No cloud data yet{/if}
      </span>
    </div>
    <button class="tv-chat" on:click={openChat} aria-label="Open chat">
      💬<span class="tv-chat-lbl">Chat</span>
      {#if unreadCount > 0}<span class="tv-badge">{unreadCount}</span>{/if}
    </button>
    <button class="tv-refresh" on:click={load} disabled={loading} aria-label="Refresh">↻</button>
  </div>

  {#if !loading}
    <section class="section">
      <MonthCalendar />
    </section>

    <section class="section">
      <div class="day-heading-row">
        <button class="day-nav-arrow" on:click={() => goToAdjacentDay(-1)} aria-label="Previous day">‹</button>
        <div class="day-heading">
          <span class="day-label">{$uiState.day}</span>
          <span class="day-week-num">Week {$uiState.week - $weekOffset}</span>
        </div>
        <button class="day-nav-arrow" on:click={() => goToAdjacentDay(1)} aria-label="Next day">›</button>
      </div>

      <CoachNote week={$uiState.week} day={$uiState.day} exerciseId={null} authoring={true} />

      {#if $currentDayExercises.length === 0}
        <!-- Untouched day -> coach owns it: author the prescribed plan (§3.4). -->
        <AssignmentEditor week={$uiState.week} day={$uiState.day} />
      {:else}
        <p class="actual-hint">Started by the trainee — this is their actual log. You comment only; you can’t overwrite it.</p>
        <div class="exercise-list">
          {#each $currentDayExercises as exercise, i (exercise.id)}
            <ExerciseCard
              {exercise}
              week={$uiState.week}
              day={$uiState.day}
              index={i}
              blockIndex={blockIndices[exercise.id] ?? i}
              total={$currentDayExercises.length}
              readonly={true}
              coachAuthoring={true}
            />
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if showChat}
    <div class="chat-overlay">
      <ChatView
        linkId={trainee.linkId}
        myUserId={$currentUser?.id ?? ''}
        peerName={trainee.email}
        onClose={closeChat}
      />
    </div>
  {/if}
</div>

<style>
  .trainee-view { padding-bottom: 24px; }

  .tv-head {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 14px 4px;
  }
  .tv-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 auto; }
  .tv-name {
    font-size: 18px; font-weight: 900; color: var(--c-text); letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .tv-fresh { font-size: 12px; color: rgba(var(--c-fg), 0.45); font-weight: 600; }
  .tv-refresh {
    flex: 0 0 auto; width: 34px; height: 34px; border-radius: 9px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: rgba(var(--c-surface-b), 0.55);
    color: rgba(var(--c-fg), 0.55); font-size: 16px; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .tv-refresh:disabled { opacity: 0.5; }

  .section { padding: 12px 14px 0; }

  .day-heading-row { display: flex; align-items: stretch; gap: 8px; }
  .day-nav-arrow {
    flex: 0 0 auto; width: 44px; border-radius: 14px;
    border: 1px solid rgba(var(--c-fg), 0.07);
    background: rgba(var(--c-surface-b), 0.50);
    color: var(--c-232-240-255-0_65, rgba(232,240,255,0.65));
    font-size: 20px; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .day-nav-arrow:active { background: rgba(var(--c-surface-b), 0.85); }
  .day-heading {
    flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    padding: 10px 12px; border-radius: 14px;
    border: 1px solid rgba(var(--c-fg), 0.07);
    background: rgba(var(--c-surface-b), 0.50);
  }
  .day-label { font-size: 20px; font-weight: 900; color: var(--c-text); letter-spacing: -0.03em; line-height: 1; }
  .day-week-num { font-size: 11px; font-weight: 600; color: rgba(var(--c-fg), 0.35); }

  .exercise-list { display: grid; gap: 10px; margin-top: 10px; }

  .actual-hint {
    margin: 4px 0 0; padding: 9px 12px;
    font-size: 12px; font-weight: 600; line-height: 1.5;
    color: rgba(var(--c-fg), 0.50);
    border: 1px solid rgba(var(--c-fg), 0.08); border-radius: 11px;
    background: rgba(var(--c-fg), 0.03);
  }

  .tv-chat {
    flex: 0 0 auto; position: relative;
    display: inline-flex; align-items: center; gap: 5px;
    height: 34px; padding: 0 11px; border-radius: 9px;
    border: 1px solid rgba(var(--c-accent), 0.35);
    background: rgba(var(--c-accent), 0.12);
    color: var(--c-accent-solid); font-size: 13px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .tv-chat:active { background: rgba(var(--c-accent), 0.22); }
  .tv-chat-lbl { font-size: 13px; }
  .tv-badge {
    position: absolute; top: -6px; right: -6px;
    min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--h-ff6060, #ff6060); color: #fff;
    font-size: 11px; font-weight: 900; line-height: 1;
  }
  .chat-overlay {
    position: fixed; inset: 0; z-index: 120;
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, var(--c-bg-1) 0%, var(--c-bg-2) 60%, var(--c-bg-3) 100%);
  }
  @media (min-width: 640px) {
    .chat-overlay {
      left: 50%; transform: translateX(-50%);
      width: 480px; right: auto;
      border-left: 1px solid rgba(var(--c-fg), 0.08);
      border-right: 1px solid rgba(var(--c-fg), 0.08);
    }
  }

  </style>
