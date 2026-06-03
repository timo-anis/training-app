<script lang="ts">
  // Presentational in-workout "add exercise" control. The parent owns all state
  // (name, paging, suggestions, history) and passes it down; this only renders
  // and reports intents via callbacks.
  interface Suggestion { name: string }
  interface History { kg: string; reps: string; sets: number }
  export let open: boolean;
  export let name: string;
  export let suggestions: Suggestion[];
  export let pages: number;
  export let page: number;
  export let history: History | null;
  export let trimmed: string;
  export let onOpen: () => void;
  export let onCancel: () => void;
  export let onNameInput: (value: string) => void;
  export let onPrevPage: () => void;
  export let onNextPage: () => void;
  export let onPickSuggestion: (exerciseName: string) => void;
  export let onConfirm: () => void;

  // Auto-focus + select-all when the input mounts.
  function focusOnMount(node: HTMLElement) {
    node.focus();
    (node as HTMLInputElement).select();
  }
</script>

{#if open}
  <div class="wm-addex-panel">
    <div class="wm-addex-row">
      <input
        class="wm-addex-input"
        type="text"
        value={name}
        on:input={(e) => onNameInput((e.currentTarget as HTMLInputElement).value)}
        use:focusOnMount
        placeholder="Exercise name…"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        on:keydown={(e) => {
          if (e.key === 'Enter') onConfirm();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button class="wm-addex-cancel" on:click={onCancel}>✕</button>
    </div>

    {#if suggestions.length > 0}
      <div class="wm-addex-suggestions">
        {#if pages > 1}
          <div class="wm-sugg-nav">
            <button class="wm-nav-arrow" on:click={onPrevPage} disabled={page === 0}>‹</button>
            <span class="wm-nav-count">{page + 1} / {pages}</span>
            <button class="wm-nav-arrow" on:click={onNextPage} disabled={page >= pages - 1}>›</button>
          </div>
        {/if}
        {#each suggestions as entry}
          <button class="wm-sugg-item" on:click={() => onPickSuggestion(entry.name)}>
            {entry.name}
          </button>
        {/each}
      </div>
    {/if}

    {#if history}
      <div class="wm-addex-history">
        <span class="wm-hist-lbl">Last time</span>
        <span class="wm-hist-val">{history.kg ? `${history.kg} kg` : '—'} × {history.reps || '—'}</span>
        <span class="wm-hist-sets">{history.sets} sets</span>
      </div>
    {/if}

    <button class="wm-addex-confirm" on:click={onConfirm} disabled={!trimmed}>Add "{trimmed}"</button>
  </div>
{:else}
  <button class="wm-addex-trigger" on:click={onOpen}>+ Add exercise</button>
{/if}

<style>
/* ---- #5 add exercise in workout ---- */
.wm-addex-trigger {
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  border: 1px dashed var(--c-75-115-195-0_20);
  background: transparent;
  color: rgba(var(--c-fg), 0.28);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.wm-addex-trigger:active {
  background: rgba(var(--c-surface-c), 0.65);
  color: rgba(var(--c-fg), 0.55);
  border-color: rgba(var(--c-fg), 0.18);
}

.wm-addex-panel {
  background: linear-gradient(180deg, var(--h-0f1c30), var(--h-0b1726));
  border: 1px solid rgba(var(--c-fg), 0.10);
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wm-addex-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.wm-addex-input {
  flex: 1;
  background: rgba(var(--c-surface-b), 0.85);
  border: 1px solid rgba(var(--c-edge-d), 0.22);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 16px;
  font-weight: 600;
  color: var(--h-ffffff);
  font-family: inherit;
  outline: none;
  min-width: 0;
  transition: border-color 0.12s;
}

.wm-addex-input::placeholder { color: rgba(var(--c-fg), 0.22); }
.wm-addex-input:focus { border-color: rgba(var(--c-fg), 0.25); }

.wm-addex-cancel {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(var(--c-fg), 0.10);
  background: transparent;
  color: rgba(var(--c-fg), 0.35);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}

.wm-addex-cancel:active { background: var(--c-255-80-80-0_12); color: var(--h-ff6060); }

.wm-addex-suggestions { display: flex; flex-direction: column; gap: 5px; }

.wm-sugg-nav {
  display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding-bottom: 2px;
}

.wm-nav-count { font-size: 11px; font-weight: 700; color: rgba(var(--c-fg), 0.30); min-width: 28px; text-align: center; }

.wm-nav-arrow {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid rgba(var(--c-fg), 0.10);
  background: rgba(var(--c-fg), 0.04); color: rgba(var(--c-fg), 0.50);
  font-size: 16px; cursor: pointer; -webkit-tap-highlight-color: transparent; padding: 0;
}
.wm-nav-arrow:disabled { opacity: 0.25; cursor: default; }
.wm-nav-arrow:not(:disabled):active { background: rgba(var(--c-fg), 0.10); color: rgba(var(--c-fg), 0.85); }

.wm-sugg-item {
  width: 100%; text-align: left; padding: 10px 13px;
  border-radius: 10px; border: 1px solid rgba(var(--c-fg), 0.08);
  background: rgba(var(--c-fg), 0.04); color: rgba(var(--c-fg), 0.80);
  font-size: 14px; font-weight: 600; cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: background 0.1s;
}
.wm-sugg-item:active { background: rgba(var(--c-fg), 0.10); color: var(--h-ffffff); }

.wm-addex-history {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-radius: 10px; background: rgba(var(--c-fg), 0.04);
  border: 1px solid rgba(var(--c-fg), 0.08);
}
.wm-hist-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(var(--c-fg), 0.35); flex-shrink: 0; }
.wm-hist-val { font-size: 13px; font-weight: 700; color: rgba(var(--c-fg), 0.80); flex: 1; }
.wm-hist-sets { font-size: 11px; font-weight: 700; color: rgba(var(--c-fg), 0.35); flex-shrink: 0; }

.wm-addex-confirm {
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(var(--c-accent), 0.14);
  border: 1px solid rgba(var(--c-accent), 0.32);
  color: var(--c-accent-solid);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.12s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wm-addex-confirm:not(:disabled):active { background: rgba(var(--c-accent), 0.28); }
.wm-addex-confirm:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
