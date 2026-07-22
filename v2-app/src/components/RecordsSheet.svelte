<script lang="ts">
  import { appState } from '../stores/app';
  import { normalizeExerciseName } from '../data/exercises';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  interface ExRecord {
    name: string;
    /** Heaviest weight actually lifted (done set). */
    bestKg: number;
    /** Rep count of that best set. */
    bestReps: number;
  }

  // Best set per exercise = heaviest done set (max kg).
  // This is what the user means by "1RM" — the heaviest weight they have
  // actually lifted, not a theoretical Epley estimate.
  $: records = (() => {
    const map = new Map<string, ExRecord>();
    for (const wd of $appState.weeks) {
      for (const ex of wd.exercises) {
        if (ex.recovery || ex.conditioning) continue;
        for (const s of ex.sets) {
          if (!s.done) continue;
          const kg = parseFloat(String(s.kg).replace(',', '.'));
          if (isNaN(kg) || kg <= 0) continue;
          const canonical = normalizeExerciseName(ex.name);
          const key = canonical.toLowerCase();
          const cur = map.get(key);
          if (!cur || kg > cur.bestKg) {
            map.set(key, { name: canonical, bestKg: kg, bestReps: 0 });
          }
        }
      }
    }
    return [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name));
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
            <span class="record-best">{r.bestKg} <span class="record-unit">kg</span></span>
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
    background: rgba(0,0,0,0.60);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 110;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .records-sheet {
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border-radius: 20px 20px 0 0;
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    padding: 0 0 env(safe-area-inset-bottom, 16px);
    border-top: 2px solid rgba(var(--c-accent), 0.55);
  }

  .records-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 12px;
    border-bottom: 0.5px solid rgba(var(--c-accent), 0.12);
    flex-shrink: 0;
  }

  .records-title {
    font-size: 16px;
    font-weight: 800;
    color: var(--c-accent-solid);
    letter-spacing: -0.02em;
  }

  .records-close {
    background: rgba(var(--c-accent), 0.08);
    border: none;
    color: rgba(var(--c-accent), 0.55);
    font-size: 14px;
    cursor: pointer;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    padding: 0;
  }
  .records-close:active { background: rgba(var(--c-accent), 0.15); }

  .records-empty {
    padding: 32px 18px;
    color: rgba(var(--c-fg), 0.45);
    font-size: 14px;
    text-align: center;
  }

  .records-list {
    overflow-y: auto;
    flex: 1;
    padding: 4px 0 12px;
  }

  .record-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 18px;
    border-bottom: 0.5px solid rgba(var(--c-accent), 0.07);
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


  @media (min-width: 900px) {
    .records-backdrop { align-items: center; }
    .records-sheet { border-radius: 20px; max-height: 80vh; }
  }
</style>
