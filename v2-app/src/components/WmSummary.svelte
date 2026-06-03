<script lang="ts">
  // Presentational workout-summary overlay. All values are pre-computed by the
  // parent; this component only renders and reports the Done tap.
  interface SummaryExercise {
    name: string;
    done: boolean;
    conditioning: boolean;
    recovery: boolean;
    setsDone: number;
    setsTotal: number;
  }
  export let duration: string;
  export let setsDone: number;
  export let volume: string;
  export let exercises: SummaryExercise[];
  export let onDone: () => void;
</script>

<div class="summary-overlay">
  <div class="summary-card">
    <div class="summary-header">
      <span class="summary-icon">🏁</span>
      <span class="summary-title">Workout Done</span>
    </div>

    <!-- Duration -->
    <div class="summary-stat-row">
      <div class="summary-stat">
        <span class="sstat-val">{duration}</span>
        <span class="sstat-lbl">Duration</span>
      </div>
      <div class="summary-stat">
        <span class="sstat-val">{setsDone}</span>
        <span class="sstat-lbl">Sets done</span>
      </div>
      <div class="summary-stat">
        <span class="sstat-val">{volume}</span>
        <span class="sstat-lbl">Volume</span>
      </div>
    </div>

    <!-- Exercise list -->
    <div class="summary-ex-list">
      {#each exercises as ex}
        <div class="summary-ex-row" class:sdone={ex.done}>
          <span class="sex-check">{ex.done ? '✓' : '○'}</span>
          <span class="sex-name">{ex.name}</span>
          {#if !ex.conditioning && !ex.recovery}
            <span class="sex-sets">{ex.setsDone}/{ex.setsTotal}</span>
          {:else if ex.conditioning}
            <span class="sex-tag">Cardio</span>
          {:else}
            <span class="sex-tag">Recovery</span>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Done button -->
    <button class="summary-done-btn" on:click={onDone}>
      Done
    </button>
  </div>
</div>

<style>
/* ===== Summary Overlay ===== */
.summary-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(var(--c-shadow), 0.78);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 0 env(safe-area-inset-bottom);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: sfade 0.2s ease;
}

@keyframes sfade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.summary-card {
  width: 100%;
  max-width: 640px;
  background: var(--h-0d1828);
  border: 1px solid rgba(var(--c-edge-e), 0.28);
  border-radius: 28px 28px 0 0;
  padding: 28px 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: sslide 0.25s ease;
}

@keyframes sslide {
  from { transform: translateY(60px); opacity: 0.4; }
  to   { transform: translateY(0);    opacity: 1; }
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-icon { font-size: 28px; line-height: 1; }

.summary-title {
  font-size: 22px;
  font-weight: 900;
  color: var(--h-ffffff);
  letter-spacing: -0.03em;
}

.summary-stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.summary-stat {
  background: var(--c-12-22-48-0_55);
  border: 1px solid rgba(var(--c-edge-c), 0.16);
  border-radius: 16px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sstat-val {
  font-size: 22px;
  font-weight: 900;
  color: var(--c-accent-solid);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.sstat-lbl {
  font-size: 11px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.38);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.summary-ex-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
}

.summary-ex-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  background: rgba(var(--c-surface-a), 0.50);
  border: 1px solid rgba(var(--c-edge-a), 0.13);
}

.summary-ex-row.sdone {
  background: rgba(var(--c-fg), 0.05);
  border-color: rgba(var(--c-fg), 0.14);
}

.sex-check {
  font-size: 13px;
  font-weight: 900;
  color: rgba(var(--c-fg), 0.25);
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.summary-ex-row.sdone .sex-check { color: rgba(var(--c-fg), 0.80); }

.sex-name {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.60);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-ex-row.sdone .sex-name { color: rgba(var(--c-fg), 0.85); }

.sex-sets {
  font-size: 12px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.35);
  flex-shrink: 0;
}

.summary-ex-row.sdone .sex-sets { color: rgba(var(--c-fg), 0.55); }

.sex-tag {
  font-size: 11px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.40);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.summary-done-btn {
  width: 100%;
  padding: 18px;
  border-radius: 16px;
  border: none;
  background: var(--c-accent-solid);
  color: var(--h-0c0c0e);
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 4px 28px rgba(var(--c-accent), 0.30);
  transition: background 0.12s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}

.summary-done-btn:active { background: var(--h-b07e22); transform: scale(0.98); }
</style>
