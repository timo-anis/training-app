<script lang="ts">
  // Presentational footer nav for the focused workout overlay.
  export let isFirst: boolean;
  export let isLast: boolean;
  export let onPrev: () => void;
  export let onNext: () => void;
  export let onBack: () => void;
  export let onFinish: () => void;
</script>

<footer class="wm-footer">
  {#if isLast}
    <!-- Last block: always show Finish Workout -->
    <button class="btn-nav" on:click={onPrev} disabled={isFirst}>‹ Prev</button>
    <button class="btn-end" on:click={onBack}>← Back</button>
    <button class="btn-finish-wod" on:click={onFinish}>Finish ✓</button>
  {:else}
    <button class="btn-nav" on:click={onPrev} disabled={isFirst}>‹ Prev</button>
    <button class="btn-end" on:click={onBack}>← Back</button>
    <button class="btn-nav primary" on:click={onNext}>Next ›</button>
  {/if}
</footer>

<style>
  /* Footer */
  .wm-footer {
    padding: 12px 14px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    border-top: 1px solid rgba(var(--c-edge-a), 0.13);
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .btn-nav {
    flex: 1;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid var(--c-75-115-195-0_26);
    background: var(--c-14-26-55-0_70);
    color: rgba(var(--c-fg), 0.65);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-nav.primary {
    background: rgba(var(--c-accent), 0.12);
    border-color: rgba(var(--c-accent), 0.30);
    color: var(--c-accent-solid);
  }

  .btn-nav:disabled { opacity: 0.25; cursor: not-allowed; }
  .btn-nav:not(:disabled):active { background: rgba(var(--c-fg), 0.11); }
  .btn-nav.primary:not(:disabled):active { background: rgba(var(--c-accent), 0.22); }

  .btn-end {
    flex: 0 0 auto;
    padding: 16px 14px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-edge-e), 0.24);
    background: rgba(var(--c-surface-c), 0.65);
    color: rgba(var(--c-fg), 0.50);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .btn-end:active { background: rgba(var(--c-fg), 0.09); color: rgba(var(--c-fg), 0.70); }

  /* Finish Workout — solid gold, last block footer */
  .btn-finish-wod {
    flex: 2;
    padding: 16px;
    border-radius: 14px;
    border: none;
    background: var(--c-accent-solid);
    color: var(--h-0c0c0e);
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow: 0 4px 24px rgba(var(--c-accent), 0.25);
    transition: background 0.12s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-finish-wod:active { background: var(--h-b07e22); transform: scale(0.98); }
</style>
