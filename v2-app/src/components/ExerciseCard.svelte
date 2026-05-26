<script lang="ts">
  import type { Exercise, DayOfWeek } from '../types/workout';
  import { addSet, deleteExercise, updateExerciseMeta } from '../stores/app';
  import SetRow from './SetRow.svelte';

  export let exercise: Exercise;
  export let week: number;
  export let day: DayOfWeek;

  $: doneCount = exercise.sets.filter(s => s.done).length;
  $: totalCount = exercise.sets.length;
  $: allDone = doneCount === totalCount && totalCount > 0;
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

  function openEdit() {
    editName = exercise.name;
    editRest = exercise.rest;
    editNote = exercise.note;
    editType = exercise.type;
    editCode = exercise.code;
    editOpen = true;
  }

  function closeEdit() { editOpen = false; }

  function saveEdit() {
    const name = editName.trim();
    if (!name) return;
    const type = editType;
    const code = type === 'superset' ? editCode.trim().toUpperCase() : '';
    updateExerciseMeta(week, day, exercise.id, {
      name,
      rest: editRest.trim(),
      note: editNote.trim(),
      type,
      code,
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
      <span class="exercise-type">{exercise.type === 'superset' ? 'Superset' : 'Weighted'}</span>
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
            class:active={editType === 'single'}
            on:click={() => { editType = 'single'; editCode = ''; }}
          >Single</button>
          <button
            class="type-btn"
            class:active={editType === 'superset'}
            on:click={() => editType = 'superset'}
          >Superset</button>
        </div>
      </div>

      {#if editType === 'superset'}
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

  {#if !exercise.recovery}
    <div class="sets-list">
      {#each exercise.sets as set, i (i)}
        <SetRow {set} index={i} {week} {day} exId={exercise.id} />
      {/each}
    </div>
    <button class="add-set-btn" on:click={() => addSet(week, day, exercise.id)}>
      + Set
    </button>
  {:else}
    <div class="recovery-row">
      <span class="recovery-label">Recovery block</span>
      <span class="recovery-status">{exercise.recoveryDone ? 'Done ✓' : 'Not done'}</span>
    </div>
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
    background: linear-gradient(180deg, #0f1c30, #0b1726);
    border: 1px solid rgba(255,255,255,0.07);
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
    font-size: 15px;
    font-weight: 800;
    color: #e8f2ff;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .exercise-type {
    font-size: 11px;
    font-weight: 600;
    color: #4a6a8a;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .progress-chip {
    flex: 0 0 auto;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    color: #7fa8d4;
  }

  .progress-chip.complete {
    background: rgba(79,192,141,0.12);
    border-color: rgba(79,192,141,0.30);
    color: #4fc08d;
  }

  .edit-btn {
    flex: 0 0 auto;
    height: 28px;
    width: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #2a4a6a;
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
    color: #2a4a6a;
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

  /* Type toggle */
  .type-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .type-btn {
    padding: 9px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.03);
    color: #4a6a8a;
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
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #3a5a7a;
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
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #3a5a7a;
    flex: 0 0 38px;
  }

  .meta-value { font-size: 13px; font-weight: 600; color: #7fa8d4; }

  .recovery-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .recovery-label { font-size: 13px; color: #7fa8d4; }
  .recovery-status { font-size: 13px; font-weight: 700; color: #4fc08d; }

  .add-set-btn {
    width: 100%;
    padding: 11px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.03);
    color: #7fa8d4;
    font-size: 13px;
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
