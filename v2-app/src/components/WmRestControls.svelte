<script lang="ts">
  // Presentational rest-timer controls (adjust / start / presets). All state is
  // owned by the parent; this only renders and reports taps.
  export let restTotal: number | null;
  export let restPending: boolean;
  export let restActive: boolean;
  export let onSub: () => void;
  export let onAdd: () => void;
  export let onStartPending: () => void;
  export let onPreset: (secs: number) => void;
</script>

<div class="rest-controls">
  <div class="rest-adjust-row">
    <button class="rest-step-btn" on:click={onSub} disabled={restTotal === null} aria-label="Remove 15 seconds">－</button>
    <button class="add-rest-btn" on:click={onAdd}>
      <span class="add-rest-icon">＋</span>
      <span class="add-rest-label">15s rest</span>
      {#if restTotal !== null && restTotal > 0}
        <span class="add-rest-current" class:pending={restPending}>{Math.floor(restTotal / 60)}:{String((restTotal ?? 0) % 60).padStart(2,'0')}</span>
      {/if}
    </button>
  </div>
  {#if restPending && restTotal !== null}
    <button class="rest-start-btn" on:click={onStartPending}>
      Start · {Math.floor(restTotal / 60)}:{String(restTotal % 60).padStart(2,'0')}
    </button>
  {/if}
  {#if !restActive && !restPending}
    <div class="rest-presets-row">
      {#each [[60,"1′"],[90,"1:30"],[120,"2′"],[180,"3′"]] as [secs, label]}
        <button class="rest-preset-sm" on:click={() => onPreset(secs as number)}>{label}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
/* ---- rest controls ---- */
.rest-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-rest-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(var(--c-fg), 0.16);
  background: rgba(var(--c-fg), 0.06);
  color: rgba(var(--c-fg), 0.80);
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s, transform 0.08s;
  letter-spacing: 0.02em;
}

.add-rest-btn:active {
  background: rgba(var(--c-fg), 0.12);
  transform: scale(0.97);
}

.rest-adjust-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.rest-adjust-row .add-rest-btn { flex: 1; }

.rest-step-btn {
  flex: 0 0 auto;
  width: 56px;
  border-radius: 14px;
  border: 1px solid rgba(var(--c-fg), 0.16);
  background: rgba(var(--c-fg), 0.06);
  color: rgba(var(--c-fg), 0.80);
  font-size: 24px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s, transform 0.08s;
}

.rest-step-btn:active:not(:disabled) {
  background: rgba(var(--c-fg), 0.12);
  transform: scale(0.97);
}

.rest-step-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.rest-start-btn {
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(var(--c-accent), 0.55);
  background: rgba(var(--c-accent), 0.16);
  color: var(--h-d4a038);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s, transform 0.08s;
  font-variant-numeric: tabular-nums;
}

.rest-start-btn:active {
  background: rgba(var(--c-accent), 0.26);
  transform: scale(0.98);
}

.add-rest-current.pending {
  color: rgba(var(--c-fg), 0.55);
  background: rgba(var(--c-fg), 0.06);
  border-color: rgba(var(--c-fg), 0.16);
}

.add-rest-icon {
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  color: rgba(var(--c-fg), 0.55);
}

.add-rest-label { font-size: 16px; font-weight: 800; }

.add-rest-current {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-accent-solid);
  font-variant-numeric: tabular-nums;
  background: rgba(var(--c-accent), 0.12);
  border: 1px solid rgba(var(--c-accent), 0.28);
  border-radius: 8px;
  padding: 2px 8px;
  margin-left: 4px;
}

.rest-presets-row {
  display: flex;
  gap: 6px;
}

.rest-preset-sm {
  flex: 1;
  padding: 8px 4px;
  border-radius: 10px;
  border: 1px solid rgba(var(--c-fg), 0.08);
  background: rgba(var(--c-fg), 0.03);
  color: rgba(var(--c-fg), 0.38);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s, color 0.1s;
  text-align: center;
}

.rest-preset-sm:active {
  background: rgba(var(--c-accent), 0.12);
  color: var(--c-accent-solid);
  border-color: rgba(var(--c-accent), 0.25);
}
</style>
