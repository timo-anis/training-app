<script lang="ts">
  // Presentational header for the focused workout overlay: progress, clock,
  // segment dots, back + finish actions.
  export let setsDone: number;
  export let setsAll: number;
  export let index: number;   // active block index (0-based)
  export let count: number;   // total blocks
  export let clock: string;   // pre-formatted elapsed time
  export let onBack: () => void;
  export let onFinish: () => void;
</script>

<header class="wm-header">
  <div class="wm-header-row">
    <button class="wm-exit" on:click={onBack} title="Back to normal view">‹</button>
    <div class="wm-mid">
      <span class="wm-blk-label">{setsDone}/{setsAll} sets</span>
      <span class="wm-progress">{index + 1} / {count}</span>
    </div>
    <span class="wm-clock">{clock}</span>
    <button class="wm-finish-early" on:click={onFinish} title="Finish workout">✓</button>
  </div>
  <div class="wm-progress-bar">
    <div class="wm-progress-fill" style="width: {((index + 1) / count) * 100}%"></div>
  </div>
  {#if count > 1}
    <div class="swipe-dots" aria-hidden="true">
      {#each Array(count) as _, i}
        <span class="swipe-dot" class:active={i === index}></span>
      {/each}
    </div>
  {/if}
</header>

<style>
  /* Header */
  .wm-header {
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
    border-bottom: 1px solid rgba(var(--c-edge-c), 0.16);
    flex-shrink: 0;
  }

  .wm-header-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px 10px;
  }

  .wm-exit {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(var(--c-edge-e), 0.24);
    background: rgba(var(--c-surface-c), 0.65);
    color: rgba(var(--c-fg), 0.65);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .wm-mid {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .wm-blk-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(var(--c-fg), 0.38);
  }

  .wm-progress {
    font-size: 20px;
    font-weight: 900;
    color: var(--h-ffffff);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .wm-progress-bar {
    height: 3px;
    background: var(--c-20-35-70-0_85);
    margin: 0 16px 12px;
    border-radius: 2px;
    overflow: hidden;
  }

  .wm-progress-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--c-accent-solid);
    transition: width 0.3s ease;
  }

  .swipe-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 0 16px 10px;
  }

  .swipe-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(var(--c-fg), 0.18);
    transition: background 0.2s, transform 0.2s;
    flex-shrink: 0;
  }

  .swipe-dot.active {
    background: var(--c-accent-solid);
    transform: scale(1.3);
  }

  .wm-clock {
    font-size: 15px;
    font-weight: 800;
    color: var(--h-ffffff);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .wm-finish-early {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(var(--c-accent), 0.35);
    background: rgba(var(--c-accent), 0.10);
    color: var(--c-accent-solid);
    font-size: 16px;
    font-weight: 900;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .wm-finish-early:active { background: rgba(var(--c-accent), 0.22); }
</style>
