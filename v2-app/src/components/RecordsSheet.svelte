<script lang="ts">
  import { appState } from '../stores/app';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  interface ExRecord {
    name: string;
    bestKg: number;
    bestReps: string;
  }

  // Compute all-time best kg per exercise from the full state.
  // Only considers weighted (non-conditioning, non-recovery) exercises with done sets.
  $: records = (() => {
    const map = new Map<string, ExRecord>();
    for (const wd of $appState.weeks) {
      for (const ex of wd.exercises) {
        if (ex.recovery || ex.conditioning) continue;
        for (const s of ex.sets) {
          if (!s.done) continue;
          const kg = parseFloat(s.kg);
          if (isNaN(kg) || kg <= 0) continue;
          const key = ex.name.toLowerCase();
          const cur = map.get(key);
          if (!cur || kg > cur.bestKg) {
            map.set(key, { name: ex.name, bestKg: kg, bestReps: s.reps });
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
            <span class="record-best">{r.bestKg} kg <span class="record-reps">× {r.bestReps}</span></span>
          </div>
        {/each}
      </div>
    {/if}
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

  .record-reps {
    font-weight: 500;
    color: rgba(var(--c-fg), 0.50);
    font-size: 13px;
  }
</style>
