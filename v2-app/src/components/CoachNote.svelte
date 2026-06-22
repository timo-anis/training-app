<script lang="ts">
  // Unified coach-annotation UI (Track 2). ONE component renders both day-level
  // (exerciseId === null) and exercise-level notes, in two modes:
  //   authoring=true  -> coach can add / edit / remove
  //   authoring=false -> trainee sees it read-only, clearly attributed to coach
  import { coachNotes, anchorKey, writeCoachNote } from '../stores/coachNotes';
  import { showToast } from '../stores/app';

  export let week: number;
  export let day: string;
  export let exerciseId: string | null = null;  // null => day-level
  export let authoring = false;

  $: key = anchorKey(week, day, exerciseId);
  $: note = $coachNotes[key] ?? null;
  $: isDay = exerciseId === null;

  let editing = false;
  let draft = '';
  let fieldEl: HTMLTextAreaElement;

  function startEdit() {
    draft = note?.body ?? '';
    editing = true;
    setTimeout(() => fieldEl?.focus(), 0);
  }

  async function commit() {
    editing = false;
    const body = draft.trim();
    if (body === (note?.body ?? '')) return;
    try {
      await writeCoachNote(week, day, exerciseId, body);
    } catch {
      showToast('Could not save coach note', 'error');
    }
  }

  async function remove() {
    try {
      await writeCoachNote(week, day, exerciseId, '');
    } catch {
      showToast('Could not remove coach note', 'error');
    }
  }
</script>

{#if authoring}
  <div class="coach-note authoring" class:day={isDay}>
    <div class="cn-head">
      <span class="cn-label">Coach note{isDay ? ' · day' : ''}</span>
      {#if note && !editing}
        <button class="cn-remove" on:click={remove} aria-label="Remove coach note">Remove</button>
      {/if}
    </div>
    {#if editing}
      <textarea
        class="cn-input"
        bind:this={fieldEl}
        bind:value={draft}
        on:blur={commit}
        placeholder={isDay ? 'Note for the whole day…' : 'Feedback on this exercise…'}
        rows="2"
      ></textarea>
    {:else if note}
      <button class="cn-body" on:click={startEdit} aria-label="Edit coach note">
        <span class="cn-text">{note.body}</span>
        <span class="cn-edit">✎</span>
      </button>
    {:else}
      <button class="cn-add" on:click={startEdit}>+ Add coach note</button>
    {/if}
  </div>
{:else if note}
  <div class="coach-note read" class:day={isDay}>
    <span class="cn-label">Coach{isDay ? ' · day' : ''}</span>
    <span class="cn-text">{note.body}</span>
  </div>
{/if}

<style>
  .coach-note {
    border-radius: 12px;
    border: 1px solid rgba(var(--c-accent), 0.32);
    background: rgba(var(--c-accent), 0.07);
    padding: 9px 11px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .coach-note.day { margin-top: 10px; }

  .cn-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

  .cn-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--c-accent-solid);
    flex: 0 0 auto;
  }

  .cn-remove {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.45);
    background: transparent;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    padding: 2px 4px;
  }
  .cn-remove:active { color: var(--h-ff6060, #ff6060); }

  .cn-text {
    flex: 1 1 auto;
    font-size: 14px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.78);
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.45;
  }

  /* Read mode (trainee): label + text inline */
  .coach-note.read { flex-direction: row; align-items: baseline; gap: 10px; }
  .coach-note.read .cn-label { padding-top: 1px; }

  .cn-body {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .cn-edit { flex: 0 0 auto; font-size: 13px; color: rgba(var(--c-accent), 0.70); }

  .cn-add {
    align-self: flex-start;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--c-accent-solid);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 0;
    -webkit-tap-highlight-color: transparent;
  }

  .cn-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(var(--c-surface-c), 0.65);
    border: 1px solid rgba(var(--c-accent), 0.35);
    border-radius: 10px;
    padding: 9px 11px;
    font-size: 16px;
    font-weight: 500;
    color: var(--h-e8f2ff, #e8f2ff);
    font-family: inherit;
    line-height: 1.45;
    resize: none;
    outline: none;
  }
  .cn-input:focus { border-color: rgba(var(--c-accent), 0.55); }
  .cn-input::placeholder { color: rgba(var(--c-fg), 0.30); }
</style>
