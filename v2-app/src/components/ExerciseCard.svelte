<script lang="ts">
  import { onMount } from 'svelte';
  import type { Exercise, DayOfWeek } from '../types/workout';
  import { addSet, deleteExercise, updateExerciseMeta, moveExercise, toggleRecoveryDone, toggleConditioningDone, updateConditioningNote, uiState, updateUI } from '../stores/app';
  import SetRow from './SetRow.svelte';

  export let exercise: Exercise;
  export let week: number;
  export let day: DayOfWeek;
  export let index: number = 0;
  export let total: number = 1;

  // Scroll into view + brief highlight when navigated to from search
  let cardEl: HTMLDivElement;
  let highlighted = false;

  onMount(() => {
    if ($uiState.highlightExercise === exercise.name) {
      // Clear flag immediately so only first card reacts
      updateUI(ui => ({ ...ui, highlightExercise: null }));
      // Small delay so the DOM is fully painted
      setTimeout(() => {
        cardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlighted = true;
        setTimeout(() => { highlighted = false; }, 1200);
      }, 80);
    }
  });

  $: doneCount = exercise.conditioning ? (exercise.conditioningDone ? 1 : 0) : exercise.sets.filter(s => s.done).length;
  $: totalCount = exercise.conditioning ? 1 : exercise.sets.length;
  $: allDone = exercise.conditioning ? exercise.conditioningDone === true : (doneCount === totalCount && totalCount > 0);
  $: supersetLabel = exercise.code || '';

  // 2-tap delete confirm
  let confirmDelete = false;
  let confirmTimer: ReturnType<typeof setTimeout>;

  function onDeleteTap() {
    if (confirmDelete) {
      clearTimeout(confirmTimer);
      deleteExercise(week, day, exercise.id);
    } else {
      confirmDelete = true;
      confirmTimer = setTimeout(() => { confirmDelete = false; }, 3000);
    }
  }

  // Edit panel
  let editOpen = false;
  let editName = '';
  let editRest = '';
  let editNote = '';
  let editType: 'single' | 'superset' = 'single';
  let editCode = '';
  let editConditioning = false;

  // Local conditioning note (editable directly in card, not in edit panel)
  let localCondNote = exercise.conditioningNote;
  $: localCondNote = exercise.conditioningNote;

  function onCondNoteBlur() {
    updateConditioningNote(week, day, exercise.id, localCondNote);
  }

  function openEdit() {
    editName = exercise.name;
    editRest = exercise.rest;
    editNote = exercise.note;
    editType = exercise.type;
    editCode = exercise.code;
    editConditioning = exercise.conditioning;
    editOpen = true;
  }

  function closeEdit() { editOpen = false; }

  function saveEdit() {
    const name = editName.trim();
    if (!name) return;
    const type = editConditioning ? 'single' : editType;
    const code = editCode.trim().toUpperCase();
    updateExerciseMeta(week, day, exercise.id, {
      name,
      rest: editRest.trim(),
      note: editNote.trim(),
      type,
      code,
      conditioning: editConditioning,
    });
    editOpen = false;
  }
</script>

<div class="exercise-card" class:all-done={allDone} class:highlighted bind:this={cardEl}>
  <div class="exercise-header">
    {#if supersetLabel}
      <span class="superset-badge">{supersetLabel}</span>
    {/if}
    <div class="exercise-meta">
      <span class="exercise-name">{exercise.name}</span>
      {#if exercise.conditioning || exercise.type === 'superset'}
        <span class="exercise-type">
          {exercise.conditioning ? 'No weights' : `Superset${exercise.code ? ' · ' + exercise.code : ''}`}
        </span>
      {/if}
    </div>
    {#if totalCount > 0}
      <span class="progress-chip" class:complete={allDone}>
        {doneCount}/{totalCount}
      </span>
    {/if}
    <button class="edit-btn" on:click={openEdit} aria-label="Edit exercise">✎</button>
    <button
      class="del-ex-btn"
      class:confirm={confirmDelete}
      on:click={onDeleteTap}
      aria-label={confirmDelete ? 'Confirm delete exercise' : 'Delete exercise'}
    >
      {confirmDelete ? 'Delete?' : '×'}
    </button>
  </div>

  {#if exercise.conditioning}
    <button
      class="cond-done-btn"
      class:cond-done={exercise.conditioningDone}
      on:click={() => toggleConditioningDone(week, day, exercise.id)}
    >
      {exercise.conditioningDone ? '✓ Done' : 'Tap to mark done'}
    </button>
    <textarea
      class="cond-textarea"
      bind:value={localCondNote}
      on:blur={onCondNoteBlur}
      placeholder="Log your session — e.g. 10 min @ 150W avg, felt strong"
      rows="3"
    ></textarea>
  {:else if !exercise.recovery}
    <div class="sets-list">
      {#each exercise.sets as set, i (i)}
        <SetRow {set} index={i} {week} {day} exId={exercise.id} />
      {/each}
    </div>
    <button class="add-set-btn" on:click={() => addSet(week, day, exercise.id)}>
      + Set
    </button>
  {:else}
    <button
      class="recovery-row"
      class:recovery-done={exercise.recoveryDone}
      on:click={() => toggleRecoveryDone(week, day, exercise.id)}
    >
      <span class="recovery-label">Recovery</span>
      <span class="recovery-status">{exercise.recoveryDone ? 'Done ✓' : 'Tap to mark done'}</span>
    </button>
  {/if}

  {#if exercise.rest}
    <div class="meta-row">
      <span class="meta-label">Rest</span>
      <span class="meta-value">{exercise.rest}</span>
    </div>
  {/if}

  {#if exercise.note}
    <div class="meta-row note">
      <span class="meta-label">Note</span>
      <span class="meta-value">{exercise.note}</span>
    </div>
  {/if}
</div>

<!-- ── Edit bottom sheet ── -->
{#if editOpen}
  <div class="edit-backdrop" on:click={closeEdit} aria-hidden="true"></div>
  <div class="edit-sheet" role="dialog" aria-label="Edit exercise">
    <div class="sheet-handle"></div>
    <div class="sheet-body">

      <div class="edit-field">
        <label class="edit-label" for="edit-name-{exercise.id}">Name</label>
        <input
          id="edit-name-{exercise.id}"
          class="edit-input"
          type="text"
          bind:value={editName}
          on:keydown={e => e.key === 'Enter' && saveEdit()}
          autocomplete="off"
        />
      </div>

      <div class="edit-field">
        <span class="edit-label">Type</span>
        <div class="type-toggle">
          <button
            class="type-btn"
            class:active={!editConditioning && editType === 'single'}
            on:click={() => { editConditioning = false; editType = 'single'; editCode = ''; }}
          >Weighted</button>
          <button
            class="type-btn"
            class:active={!editConditioning && editType === 'superset'}
            on:click={() => { editConditioning = false; editType = 'superset'; }}
          >Superset</button>
          <button
            class="type-btn"
            class:active={editConditioning}
            on:click={() => { editConditioning = true; editType = 'single'; }}
          >No weights</button>
        </div>
        <span class="type-hint">
          {#if editConditioning}Done toggle + log field — no sets{:else if editType === 'superset'}Grouped sets — uses group code{:else}Individual sets with kg / reps{/if}
        </span>
      </div>

      <div class="edit-field">
        <label class="edit-label" for="edit-code-{exercise.id}">Group code (A, B, C…)</label>
        <input
          id="edit-code-{exercise.id}"
          class="edit-input edit-code"
          type="text"
          maxlength="3"
          bind:value={editCode}
          placeholder="—"
          autocomplete="off"
        />
      </div>

      <div class="edit-field">
        <label class="edit-label" for="edit-rest-{exercise.id}">Rest</label>
        <input
          id="edit-rest-{exercise.id}"
          class="edit-input"
          type="text"
          bind:value={editRest}
          placeholder="e.g. 90s"
          autocomplete="off"
        />
      </div>

      <div class="edit-field">
        <label class="edit-label" for="edit-note-{exercise.id}">Note</label>
        <textarea
          id="edit-note-{exercise.id}"
          class="edit-input edit-textarea"
          bind:value={editNote}
          placeholder="Optional note…"
          rows="2"
        ></textarea>
      </div>

      <!-- Order buttons -->
      {#if total > 1}
        <div class="edit-field">
          <span class="edit-label">Order</span>
          <div class="order-row">
            <button
              class="order-sheet-btn"
              disabled={index === 0}
              on:click={() => { moveExercise(week, day, exercise.id, 'up'); closeEdit(); }}
            >↑ Move up</button>
            <button
              class="order-sheet-btn"
              disabled={index === total - 1}
              on:click={() => { moveExercise(week, day, exercise.id, 'down'); closeEdit(); }}
            >↓ Move down</button>
          </div>
        </div>
      {/if}

    </div>
    <div class="sheet-actions">
      <button class="btn-cancel" on:click={closeEdit}>Cancel</button>
      <button class="btn-save" on:click={saveEdit} disabled={!editName.trim()}>Save</button>
    </div>
  </div>
{/if}

<style>
  .exercise-card {
    background: linear-gradient(160deg, #0d1a30, #080e1c);
    border: 1px solid rgba(65,100,175,0.18);
    border-radius: 18px;
    padding: 16px 14px;
    display: grid;
    gap: 12px;
    transition: border-color 0.2s;
  }

  .exercise-card.all-done { border-color: rgba(255,255,255,0.20); }

  /* Search navigation highlight — brief gold pulse */
  .exercise-card.highlighted {
    border-color: rgba(196,148,46,0.65);
    box-shadow: 0 0 0 2px rgba(196,148,46,0.18);
    animation: highlight-pulse 1.2s ease forwards;
  }

  @keyframes highlight-pulse {
    0%   { border-color: rgba(196,148,46,0.80); box-shadow: 0 0 0 3px rgba(196,148,46,0.22); }
    60%  { border-color: rgba(196,148,46,0.55); box-shadow: 0 0 0 2px rgba(196,148,46,0.12); }
    100% { border-color: rgba(65,100,175,0.18);  box-shadow: none; }
  }

  .exercise-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .superset-badge {
    flex: 0 0 auto;
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
  }

  .exercise-meta {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .exercise-name {
    font-size: 16px;
    font-weight: 800;
    color: #e8f2ff;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .exercise-type {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.38);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .progress-chip {
    flex: 0 0 auto;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    background: rgba(14,26,55,0.70);
    border: 1px solid rgba(255,255,255,0.13);
    color: rgba(255,255,255,0.65);
  }

  .progress-chip.complete {
    background: rgba(255,255,255,0.09);
    border-color: rgba(255,255,255,0.22);
    color: rgba(255,255,255,0.90);
  }

  .edit-btn {
    flex: 0 0 auto;
    height: 28px;
    width: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.38);
    font-size: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .edit-btn:active { background: rgba(255,255,255,0.08); color: #ffffff; }

  .del-ex-btn {
    flex: 0 0 auto;
    height: 28px;
    min-width: 28px;
    padding: 0 8px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.38);
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .del-ex-btn.confirm {
    background: rgba(255,80,80,0.12);
    color: #ff6060;
    font-size: 12px;
    border: 1px solid rgba(255,80,80,0.25);
    border-radius: 10px;
    padding: 0 10px;
  }

  .del-ex-btn:active { background: rgba(255,80,80,0.18); color: #ff6060; }

  /* Conditioning done toggle */
  .cond-done-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(12,20,44,0.50);
    border: 1px solid rgba(255,255,255,0.10);
    color: rgba(255,255,255,0.45);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .cond-done-btn.cond-done {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.20);
    color: rgba(255,255,255,0.85);
  }

  .cond-done-btn:active { background: rgba(13,24,52,0.85); }
  .cond-done-btn.cond-done:active { background: rgba(255,255,255,0.12); }

  /* Conditioning textarea */
  .cond-textarea {
    width: 100%;
    box-sizing: border-box;
    background: rgba(14,25,55,0.65);
    border: 1px solid rgba(65,100,175,0.20);
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 15px;
    font-weight: 500;
    color: #e8f2ff;
    font-family: inherit;
    line-height: 1.5;
    resize: none;
    outline: none;
    transition: border-color 0.12s;
  }

  .cond-textarea:focus { border-color: rgba(255,255,255,0.25); }
  .cond-textarea::placeholder { color: rgba(255,255,255,0.22); }

  /* Type toggle */
  .type-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
  }

  .type-btn {
    padding: 9px;
    border-radius: 10px;
    border: 1px solid rgba(70,110,185,0.22);
    background: rgba(12,22,48,0.55);
    color: #6a8faa;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .type-btn.active {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.30);
    color: #ffffff;
  }

  .type-hint {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.28);
    text-align: center;
    letter-spacing: 0.01em;
  }

  .edit-code { text-transform: uppercase; letter-spacing: 0.1em; font-weight: 900; }

  /* ── Edit bottom sheet ── */
  .edit-backdrop {
    position: fixed;
    inset: 0;
    z-index: 94;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .edit-sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 95;
    height: min(88dvh, 600px);
    max-height: 90dvh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #0d1a2e 0%, #080c18 100%);
    border-top: 1px solid rgba(65,100,175,0.22);
    border-radius: 22px 22px 0 0;
    animation: sheet-up 0.24s cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  @keyframes sheet-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.14);
    margin: 10px auto 4px;
    flex-shrink: 0;
  }

  .sheet-body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 12px 16px 4px;
    display: grid;
    gap: 14px;
  }

  .sheet-actions {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  /* Desktop: center sheet */
  @media (min-width: 640px) {
    .edit-sheet {
      left: 50%;
      right: auto;
      bottom: auto;
      top: 50%;
      transform: translateX(-50%) translateY(-50%);
      width: 480px;
      border-radius: 22px;
      max-height: 80vh;
      animation: sheet-scale 0.18s ease both;
    }
    @keyframes sheet-scale {
      from { opacity: 0; transform: translateX(-50%) translateY(-50%) scale(0.96); }
      to   { opacity: 1; transform: translateX(-50%) translateY(-50%) scale(1); }
    }
  }

  /* Order in edit sheet */
  .order-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .order-sheet-btn {
    padding: 10px;
    border-radius: 10px;
    border: 1px solid rgba(70,110,185,0.22);
    background: rgba(12,22,48,0.55);
    color: rgba(255,255,255,0.55);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .order-sheet-btn:disabled { opacity: 0.22; cursor: not-allowed; }
  .order-sheet-btn:not(:disabled):active { background: rgba(255,255,255,0.09); color: #ffffff; }

  .edit-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .edit-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.38);
  }

  .edit-input {
    background: rgba(14,25,55,0.65);
    border: 1px solid rgba(65,100,175,0.18);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 16px;
    font-weight: 600;
    color: #e8f2ff;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.12s;
  }

  .edit-input:focus { border-color: rgba(255,255,255,0.25); }
  .edit-input::placeholder { color: rgba(255,255,255,0.20); }

  .edit-textarea {
    resize: none;
    font-family: inherit;
    line-height: 1.5;
  }

  .edit-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .btn-cancel {
    padding: 11px;
    border-radius: 11px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(12,20,44,0.50);
    color: rgba(255,255,255,0.45);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-save {
    padding: 11px;
    border-radius: 11px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.10);
    color: #ffffff;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-save:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-save:not(:disabled):active { background: rgba(255,255,255,0.18); }

  .sets-list { display: grid; gap: 4px; }

  .meta-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(12,20,44,0.50);
    border: 1px solid rgba(255,255,255,0.07);
  }

  .meta-row.note { align-items: flex-start; }

  .meta-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    flex: 0 0 38px;
  }

  .meta-value { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.65); }

  .recovery-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(12,20,44,0.50);
    border: 1px solid rgba(255,255,255,0.08);
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .recovery-row.recovery-done {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.20);
  }

  .recovery-row:active { background: rgba(13,24,52,0.85); }
  .recovery-row.recovery-done:active { background: rgba(255,255,255,0.12); }

  .recovery-label { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.70); }

  .recovery-status {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.38);
  }

  .recovery-row.recovery-done .recovery-status { color: rgba(255,255,255,0.85); }

  .add-set-btn {
    width: 100%;
    padding: 11px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(12,22,48,0.55);
    color: rgba(255,255,255,0.45);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: background 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .add-set-btn:active {
    background: rgba(13,24,52,0.85);
    border-color: rgba(255,255,255,0.18);
  }
</style>
