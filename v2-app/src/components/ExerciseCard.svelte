<script lang="ts">
  import type { Exercise, DayOfWeek } from '../types/workout';
  import { addSet, deleteExercise, updateExerciseMeta, moveExercise, toggleRecoveryDone, updateConditioningNote } from '../stores/app';
  import SetRow from './SetRow.svelte';

  export let exercise: Exercise;
  export let week: number;
  export let day: DayOfWeek;
  export let index: number = 0;
  export let total: number = 1;

  $: doneCount = exercise.conditioning ? (exercise.conditioningNote.trim() ? 1 : 0) : exercise.sets.filter(s => s.done).length;
  $: totalCount = exercise.conditioning ? 1 : exercise.sets.length;
  $: allDone = exercise.conditioning ? exercise.conditioningNote.trim().length > 0 : (doneCount === totalCount && totalCount > 0);
  $: supersetLabel = exercise.type === 'superset' ? exercise.code : '';

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
    const code = type === 'superset' ? editCode.trim().toUpperCase() : '';
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

<div class="exercise-card" class:all-done={allDone}>
  <div class="exercise-header">
    {#if supersetLabel}
      <span class="superset-badge">{supersetLabel}</span>
    {/if}
    <div class="exercise-meta">
      <span class="exercise-name">{exercise.name}</span>
      <span class="exercise-type">{exercise.conditioning ? 'Conditioning' : exercise.type === 'superset' ? 'Superset' : 'Weighted'}</span>
    </div>
    {#if totalCount > 0}
      <span class="progress-chip" class:complete={allDone}>
        {doneCount}/{totalCount}
      </span>
    {/if}
    <div class="order-btns">
      <button class="order-btn" disabled={index === 0} on:click={() => moveExercise(week, day, exercise.id, 'up')} aria-label="Move up">↑</button>
      <button class="order-btn" disabled={index === total - 1} on:click={() => moveExercise(week, day, exercise.id, 'down')} aria-label="Move down">↓</button>
    </div>
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

  <!-- Edit panel -->
  {#if editOpen}
    <div class="edit-panel">
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
      <!-- Type toggle -->
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
            on:click={() => { editConditioning = true; editType = 'single'; editCode = ''; }}
          >Cardio</button>
        </div>
      </div>

      {#if !editConditioning && editType === 'superset'}
        <div class="edit-field">
          <label class="edit-label" for="edit-code-{exercise.id}">Group code (A, B, C…)</label>
          <input
            id="edit-code-{exercise.id}"
            class="edit-input edit-code"
            type="text"
            maxlength="3"
            bind:value={editCode}
            placeholder="A"
            autocomplete="off"
          />
        </div>
      {/if}

      <div class="edit-row">
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
      <div class="edit-actions">
        <button class="btn-cancel" on:click={closeEdit}>Cancel</button>
        <button class="btn-save" on:click={saveEdit} disabled={!editName.trim()}>Save</button>
      </div>
    </div>
  {/if}

  {#if exercise.conditioning}
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

<style>
  .exercise-card {
    background: linear-gradient(180deg, #1a1a20, #141418);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 18px;
    padding: 16px 14px;
    display: grid;
    gap: 12px;
    transition: border-color 0.2s;
  }

  .exercise-card.all-done { border-color: rgba(79,192,141,0.25); }

  .exercise-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .superset-badge {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(127,178,255,0.12);
    border: 1px solid rgba(127,178,255,0.25);
    color: #7fb2ff;
    font-size: 12px;
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
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.13);
    color: rgba(255,255,255,0.65);
  }

  .progress-chip.complete {
    background: rgba(79,192,141,0.12);
    border-color: rgba(79,192,141,0.30);
    color: #4fc08d;
  }

  .order-btns {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  }

  .order-btn {
    width: 24px;
    height: 18px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: #4a7090;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
    padding: 0;
  }

  .order-btn:disabled { opacity: 0.2; cursor: not-allowed; }
  .order-btn:not(:disabled):active { background: rgba(255,255,255,0.08); color: #7fa8d4; }

  .edit-btn {
    flex: 0 0 auto;
    height: 28px;
    width: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #4a7090;
    font-size: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .edit-btn:active { background: rgba(127,178,255,0.12); color: #7fb2ff; }

  .del-ex-btn {
    flex: 0 0 auto;
    height: 28px;
    min-width: 28px;
    padding: 0 8px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #4a7090;
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

  /* Conditioning textarea */
  .cond-textarea {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
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

  .cond-textarea:focus { border-color: rgba(127,178,255,0.35); }
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
    border: 1px solid rgba(255,255,255,0.11);
    background: rgba(255,255,255,0.04);
    color: #6a8faa;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .type-btn.active {
    background: rgba(127,178,255,0.14);
    border-color: rgba(127,178,255,0.35);
    color: #7fb2ff;
  }

  .edit-code { text-transform: uppercase; letter-spacing: 0.1em; font-weight: 900; }

  /* Edit panel */
  .edit-panel {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    background: rgba(127,178,255,0.05);
    border: 1px solid rgba(127,178,255,0.15);
  }

  .edit-row { display: grid; grid-template-columns: 1fr; gap: 10px; }

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
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    font-weight: 600;
    color: #e8f2ff;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.12s;
  }

  .edit-input:focus { border-color: rgba(127,178,255,0.35); }
  .edit-input::placeholder { color: #2a4a6a; }

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
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.03);
    color: #4a6a8a;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-save {
    padding: 11px;
    border-radius: 11px;
    border: 1px solid rgba(127,178,255,0.3);
    background: rgba(127,178,255,0.12);
    color: #7fb2ff;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-save:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-save:not(:disabled):active { background: rgba(127,178,255,0.22); }

  .sets-list { display: grid; gap: 4px; }

  .meta-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
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
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .recovery-row.recovery-done {
    background: rgba(79,192,141,0.08);
    border-color: rgba(79,192,141,0.25);
  }

  .recovery-row:active { background: rgba(255,255,255,0.07); }
  .recovery-row.recovery-done:active { background: rgba(79,192,141,0.14); }

  .recovery-label { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.70); }

  .recovery-status {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.38);
  }

  .recovery-row.recovery-done .recovery-status { color: #4fc08d; }

  .add-set-btn {
    width: 100%;
    padding: 11px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.60);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: background 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .add-set-btn:active {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.14);
  }
</style>
