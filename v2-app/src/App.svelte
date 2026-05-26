<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { onAuthChange } from './services/auth';
  import { currentUser, bootStatus, bootForUser, uiState } from './stores/app';
  import AuthView from './components/AuthView.svelte';
  import MainView from './components/MainView.svelte';
  import StatsView from './components/StatsView.svelte';
  import BootOverlay from './components/BootOverlay.svelte';
  import WorkoutMode from './components/WorkoutMode.svelte';

  let unsubscribeAuth: (() => void) | null = null;
  let activeTab: 'training' | 'stats' = 'training';

  onMount(() => {
    unsubscribeAuth = onAuthChange(async (state) => {
      if (state.status === 'signed_in') {
        currentUser.set(state.user);
        await bootForUser(state.user);
      } else if (state.status === 'signed_out') {
        currentUser.set(null);
        bootStatus.set('idle');
      }
    });
  });

  onDestroy(() => {
    unsubscribeAuth?.();
  });
</script>

{#if $bootStatus === 'loading'}
  <BootOverlay />
{:else if $currentUser && $bootStatus === 'ready'}
  <div class="app-shell">
    <div class="tab-content">
      {#if activeTab === 'training'}
        <MainView />
      {:else}
        <div class="stats-header">
          <span class="stats-title">Statistics</span>
        </div>
        <StatsView />
      {/if}
    </div>

    <!-- Bottom tab bar (hidden during workout) -->
    {#if !$uiState.workoutMode}
      <nav class="tab-bar">
        <button
          class="tab-btn"
          class:active={activeTab === 'training'}
          on:click={() => activeTab = 'training'}
        >
          <span class="tab-icon">💪</span>
          <span class="tab-label">Training</span>
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'stats'}
          on:click={() => activeTab = 'stats'}
        >
          <span class="tab-icon">📊</span>
          <span class="tab-label">Stats</span>
        </button>
      </nav>
    {/if}
  </div>

  {#if $uiState.workoutMode}
    <WorkoutMode />
  {/if}
{:else}
  <AuthView />
{/if}

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  .tab-content {
    flex: 1 1 0;
    overflow-y: auto;
  }

  .stats-header {
    padding: 16px 18px 4px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: #08172d;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .stats-title {
    font-size: 18px;
    font-weight: 900;
    color: #f0f6ff;
    letter-spacing: -0.03em;
  }

  .tab-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 640px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #08172d;
    border-top: 1px solid rgba(255,255,255,0.08);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    z-index: 50;
  }

  .tab-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 10px 0 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.12s;
  }

  .tab-icon {
    font-size: 20px;
    line-height: 1;
    filter: grayscale(1) opacity(0.4);
    transition: filter 0.15s;
  }

  .tab-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #2a4a6a;
    transition: color 0.15s;
  }

  .tab-btn.active .tab-icon { filter: none; }
  .tab-btn.active .tab-label { color: #ffc247; }
</style>
