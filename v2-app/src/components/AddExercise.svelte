<script lang="ts">
  import type { DayOfWeek } from '../types/workout';
  import { appState, addExercise } from '../stores/app';
  import { searchExercises } from '../data/exercises';

  export let week: number;
  export let day: DayOfWeek;

  let open = false;
  let name = '';
  let inputEl: HTMLInputElement;
  let page = 0;          // current suggestion page (0-indexed)

  const PAGE_SIZE = 3;

  // ── Suggestions ────────────────────────────────────────────
  $: trimmed = name.trim();
  $: allMatches = trimmed.length >= 1 ? searchExercises(trimmed) : [];
  $: totalPages = Math.ceil(allMatches.length / PAGE_SIZE);
  $: pageSuggestions = allMatches.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Reset page when query changes
  $: if (trimmed) page = 0;

  function prevPage() { if (page > 0) page -= 1; }
  function nextPage() { if (page < totalPages - 1) page += 1; }

  // ── History hint ────────────────────────────────────────────
  $: history = trimmed.length >= 2 ? findLastOccurrence(trimmed, $appState) : null;

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

  // ── Actions ─────────────────────────────────────────────────
  function openPanel() {
    open = true;
    name = '';
    page = 0;
    setTimeout(() => inputEl?.focus(), 50);
  }

  // Public: let a parent (e.g. the empty-state CTA) open the add panel.
  export function openNow() {
    openPanel();
  }

  function cancel() {
    open = false;
    name = '';
    page = 0;
  }

  function confirm() {
    const n = name.trim();
    if (!n) return;
    addExercise(week, day, n);
    cancel();
  }

  function pickSuggestion(n: string) {
    addExercise(week, day, n);
    cancel();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') cancel();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage(); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); prevPage(); }
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

    <!-- Suggestions -->
    {#if allMatches.length > 0}
      <div class="suggestions">
        {#if totalPages > 1}
          <div class="sugg-nav">
            <button
              class="nav-arrow"
              on:click={prevPage}
              disabled={page === 0}
              aria-label="Previous suggestions"
            >‹</button>
            <span class="nav-count">{page + 1} / {totalPages}</span>
            <button
              class="nav-arrow"
              on:click={nextPage}
              disabled={page >= totalPages - 1}
              aria-label="Next suggestions"
            >›</button>
          </div>
        {/if}

        {#each pageSuggestions as entry}
          <button class="sugg-item" on:click={() => pickSuggestion(entry.name)}>
            {entry.name}
          </button>
        {/each}
      </div>
    {/if}

    <!-- History hint -->
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
    border: 1px dashed rgba(var(--c-w), 0.14);
    background: transparent;
    color: rgba(var(--c-w), 0.40);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .add-ex-trigger:active {
    background: var(--c-12-22-48-0_55);
    border-color: rgba(var(--c-w), 0.25);
    color: rgba(var(--c-w), 0.75);
  }

  .add-ex-panel {
    background: linear-gradient(180deg, var(--h-0f1c30), var(--h-0b1726));
    border: 1px solid rgba(var(--c-w), 0.10);
    border-radius: 18px;
    padding: 14px;
    display: grid;
    gap: 10px;
  }

  /* ── Input ── */
  .add-ex-input {
    width: 100%;
    background: rgba(var(--c-ink-c), 0.65);
    border: 1px solid rgba(var(--c-blue-d), 0.20);
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 700;
    color: var(--h-e8f2ff);
    outline: none;
    box-sizing: border-box;
    letter-spacing: -0.01em;
    transition: border-color 0.12s;
  }

  .add-ex-input::placeholder { color: rgba(var(--c-w), 0.20); }
  .add-ex-input:focus { border-color: rgba(var(--c-w), 0.25); }

  /* ── Suggestions ── */
  .suggestions {
    display: grid;
    gap: 5px;
  }

  /* Pagination row */
  .sugg-nav {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    padding-bottom: 2px;
  }

  .nav-count {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--c-w), 0.30);
    min-width: 28px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .nav-arrow {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    border: 1px solid rgba(var(--c-w), 0.10);
    background: rgba(var(--c-w), 0.04);
    color: rgba(var(--c-w), 0.50);
    font-size: 16px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s, color 0.1s;
    padding: 0;
  }

  .nav-arrow:disabled {
    opacity: 0.25;
    cursor: default;
  }

  .nav-arrow:not(:disabled):active {
    background: rgba(var(--c-w), 0.10);
    color: rgba(var(--c-w), 0.85);
  }

  /* Suggestion item */
  .sugg-item {
    width: 100%;
    text-align: left;
    padding: 10px 13px;
    border-radius: 10px;
    border: 1px solid rgba(var(--c-w), 0.08);
    background: rgba(var(--c-w), 0.04);
    color: rgba(var(--c-w), 0.80);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s, border-color 0.1s;
    letter-spacing: -0.01em;
  }

  .sugg-item:active {
    background: rgba(var(--c-w), 0.10);
    border-color: rgba(var(--c-w), 0.20);
    color: var(--h-ffffff);
  }

  /* ── History hint ── */
  .history-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(var(--c-w), 0.04);
    border: 1px solid rgba(var(--c-w), 0.10);
  }

  .history-label {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(var(--c-w), 0.35);
    flex: 0 0 auto;
  }

  .history-val {
    font-size: 13px;
    font-weight: 700;
    color: rgba(var(--c-w), 0.80);
    flex: 1 1 0;
  }

  .history-sets {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--c-w), 0.35);
    flex: 0 0 auto;
  }

  /* ── Actions ── */
  .add-ex-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .btn-cancel {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-w), 0.10);
    background: rgba(var(--c-ink-a), 0.50);
    color: rgba(var(--c-w), 0.45);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-cancel:active { background: rgba(var(--c-ink-b), 0.85); }

  .btn-confirm {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-w), 0.20);
    background: rgba(var(--c-w), 0.08);
    color: rgba(var(--c-w), 0.90);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-confirm:not(:disabled):active {
    background: rgba(var(--c-w), 0.14);
    border-color: rgba(var(--c-w), 0.35);
  }

  .btn-confirm:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
