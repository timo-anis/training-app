<script lang="ts">
  import type { DayOfWeek } from '../types/workout';
  import { appState, uiState, addExercise } from '../stores/app';

  export let week: number;
  export let day: DayOfWeek;

  let open = false;
  let name = '';
  let inputEl: HTMLInputElement;

  // History: find last occurrence of this exercise name in appState
  $: trimmed = name.trim();
  $: history = trimmed.length >= 2
    ? findLastOccurrence(trimmed, $appState)
    : null;

  function findLastOccurrence(search: string, state: typeof $appState) {
    const lower = search.toLowerCase();
    let found: { kg: string; reps: string; sets: number } | null = null;
    for (const wd of state.weeks) {
      for (const ex of wd.exercises) {
        if (ex.name.toLowerCase().includes(lower) && ex.sets.length > 0) {
          const doneSets = ex.sets.filter(s => s.done || s.kg || s.reps);
          if (doneSets.length > 0) {
            const last = doneSets[doneSets.length - 1];
            found = { kg: last.kg, reps: last.reps, sets: doneSets.length };
          }
        }
      }
    }
    return found;
  }

  function openPanel() {
    open = true;
    name = '';
    setTimeout(() => inputEl?.focus(), 50);
  }

  function cancel() {
    open = false;
    name = '';
  }

  function confirm() {
    const n = name.trim();
    if (!n) return;
    addExercise(week, day, n);
    cancel();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') cancel();
  }
</script>

{#if !open}
  <button class="add-ex-trigger" on:click={openPanel}>
    + Add exercise
  </button>
{:else}
  <div class="add-ex-panel">
    <input
      bind:this={inputEl}
      class="add-ex-input"
      type="text"
      placeholder="Exercise name…"
      bind:value={name}
      on:keydown={onKeydown}
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
    />

    {#if history}
      <div class="history-hint">
        <span class="history-label">Last time</span>
        <span class="history-val">{history.kg ? `${history.kg} kg` : '—'} × {history.reps || '—'}</span>
        <span class="history-sets">{history.sets} sets</span>
      </div>
    {/if}

    <div class="add-ex-actions">
      <button class="btn-cancel" on:click={cancel}>Cancel</button>
      <button class="btn-confirm" on:click={confirm} disabled={!name.trim()}>Add</button>
    </div>
  </div>
{/if}

<style>
  .add-ex-trigger {
    width: 100%;
    padding: 14px;
    border-radius: 14px;
    border: 1px dashed rgba(255,255,255,0.14);
    background: transparent;
    color: rgba(255,255,255,0.40);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .add-ex-trigger:active {
    background: rgba(12,22,48,0.55);
    border-color: rgba(255,255,255,0.25);
    color: rgba(255,255,255,0.75);
  }

  .add-ex-panel {
    background: linear-gradient(180deg, #0f1c30, #0b1726);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 18px;
    padding: 14px;
    display: grid;
    gap: 10px;
  }

  .add-ex-input {
    width: 100%;
    background: rgba(14,25,55,0.65);
    border: 1px solid rgba(65,100,175,0.20);
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 700;
    color: #e8f2ff;
    outline: none;
    box-sizing: border-box;
    letter-spacing: -0.01em;
    transition: border-color 0.12s;
  }

  .add-ex-input::placeholder { color: #1e3870; }

  .add-ex-input:focus {
    border-color: rgba(255,255,255,0.25);
  }

  .history-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
  }

  .history-label {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.35);
    flex: 0 0 auto;
  }

  .history-val {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.80);
    flex: 1 1 0;
  }

  .history-sets {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    flex: 0 0 auto;
  }

  .add-ex-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .btn-cancel {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(12,20,44,0.50);
    color: rgba(255,255,255,0.45);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-cancel:active { background: rgba(13,24,52,0.85); }

  .btn-confirm {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.20);
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.90);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-confirm:not(:disabled):active {
    background: rgba(255,255,255,0.14);
    border-color: rgba(255,255,255,0.35);
  }

  .btn-confirm:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
