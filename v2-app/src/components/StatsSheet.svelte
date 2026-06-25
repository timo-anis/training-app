<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import StatsView from './StatsView.svelte';
  const dispatch = createEventDispatcher();
</script>

<div
  class="stats-backdrop"
  role="presentation"
  on:click={() => dispatch('close')}
  on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
>
  <div class="stats-sheet" role="dialog" aria-label="Statistics" tabindex="-1" on:click|stopPropagation on:keydown|stopPropagation>
    <div class="handle"></div>
    <div class="stats-header">
      <div class="stats-title-row">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--c-accent-solid, #d4a038)">
          <rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/>
          <rect x="2" y="13" width="4" height="8"/>
        </svg>
        <span class="stats-title">Statistics</span>
      </div>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close statistics">✕</button>
    </div>
    <div class="stats-scroll">
      <StatsView />
    </div>
  </div>
</div>

<style>
  .stats-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.60);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fade-in 0.15s ease;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .stats-sheet {
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border-radius: 22px 22px 0 0;
    border: 1px solid rgba(60, 90, 165, 0.28);
    border-bottom: none;
    width: 100%;
    max-width: 680px;
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    animation: slide-up 0.24s cubic-bezier(0.22, 1, 0.36, 1);
    border-top: 2px solid rgba(196, 146, 48, 0.45);
  }
  @keyframes slide-up {
    from { transform: translateY(48px); opacity: 0.5; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .handle {
    width: 36px;
    height: 4px;
    background: rgba(232, 240, 255, 0.14);
    border-radius: 2px;
    margin: 12px auto 0;
    flex-shrink: 0;
  }

  .stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px 12px;
    border-bottom: 1px solid rgba(60, 90, 165, 0.15);
    flex-shrink: 0;
  }

  .stats-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stats-title {
    font-size: 16px;
    font-weight: 900;
    color: var(--c-accent-solid, #d4a038);
    letter-spacing: -0.02em;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(232, 240, 255, 0.12);
    background: rgba(232, 240, 255, 0.05);
    color: rgba(232, 240, 255, 0.38);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }
  .close-btn:active { background: rgba(232, 240, 255, 0.10); }

  .stats-scroll {
    overflow-y: auto;
    flex: 1;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .stats-scroll::-webkit-scrollbar { width: 0; }

  /* Desktop: centered modal */
  @media (min-width: 640px) {
    .stats-backdrop {
      align-items: center;
      padding: 24px;
    }
    .stats-sheet {
      border-radius: 22px;
      border: 1px solid rgba(60, 90, 165, 0.28);
      max-height: 82dvh;
    }
  }
</style>
