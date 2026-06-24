<script lang="ts">
  import { appState } from '../stores/app';
  import { epley1RM } from '../lib/rpe';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  interface ExRecord {
    name: string;
    e1rm: number;
  }

  // Compute estimated 1RM per exercise using the Epley formula.
  // Best 1RM across all done weighted sets (reps > 0).
  $: records = (() => {
    const map = new Map<string, ExRecord>();
    for (const wd of $appState.weeks) {
      for (const ex of wd.exercises) {
        if (ex.recovery || ex.conditioning) continue;
        for (const s of ex.sets) {
          if (!s.done) continue;
          const kg = parseFloat(s.kg);
          const reps = parseInt(s.reps, 10);
          if (isNaN(kg) || kg <= 0 || isNaN(reps) || reps <= 0) continue;
          const e1rm = Math.round(epley1RM(kg, reps));
          const key = ex.name.toLowerCase();
          const cur = map.get(key);
          if (!cur || e1rm > cur.e1rm) {
            map.set(key, { name: ex.name, e1rm });
          }
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="records-backdrop" on:click={() => dispatch('close')}>
  <div class="records-sheet" on:click|stopPropagation>
    <div class="records-header">
      <span class="records-title">Personal records</span>
      <button class="records-close" on:click={() => dispatch('close')} aria-label="Close records">✕</button>
    </div>

    {#if records.length === 0}
      <p class="records-empty">No records yet — log some weighted sets to see your bests here.</p>
    {:else}
      <div class="records-list">
        {#each records as r}
          <div class="record-row">
            <span class="record-name">{r.name}</span>
            <span class="record-best">{r.e1rm} <span class="record-unit">kg</span></span>
          </div>
        {/each}
      </div>
    {/if}
    <p class="records-hint">est. 1-rep max · Epley formula</p>
  </div>
</div>

<style>
  .records-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 110;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .records-sheet {
    background: var(--c-surface-b, #16181f);
    border-radius: 20px 20px 0 0;
    width: 100%;
    max-width: 640px;
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    padding: 0 0 env(safe-area-inset-bottom, 16px);
    box-shadow: 0 -8px 40px rgba(0,0,0,0.5);
  }

  .records-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 18px 12px;
    border-bottom: 1px solid rgba(var(--c-edge-c), 0.14);
    flex-shrink: 0;
  }

  .records-title {
    font-size: 16px;
    font-weight: 800;
    color: var(--c-accent-solid);
    letter-spacing: -0.02em;
  }

  .records-close {
    background: none;
    border: none;
    color: rgba(var(--c-fg), 0.45);
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    line-height: 1;
  }
  .records-close:active { background: rgba(var(--c-fg), 0.08); }

  .records-empty {
    padding: 32px 18px;
    color: rgba(var(--c-fg), 0.45);
    font-size: 14px;
    text-align: center;
  }

  .records-list {
    overflow-y: auto;
    flex: 1;
    padding: 8px 0 16px;
  }

  .record-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 18px;
    border-bottom: 1px solid rgba(var(--c-edge-c), 0.08);
  }
  .record-row:last-child { border-bottom: none; }

  .record-name {
    font-size: 14px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.88);
  }

  .record-best {
    font-size: 14px;
    font-weight: 800;
    color: var(--c-accent-solid);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .record-unit {
    font-weight: 500;
    color: rgba(var(--c-fg), 0.50);
    font-size: 13px;
  }

  .records-hint {
    text-align: center;
    font-size: 11px;
    color: rgba(var(--c-fg), 0.22);
    padding: 8px 18px 4px;
    flex-shrink: 0;
  }
</style>
