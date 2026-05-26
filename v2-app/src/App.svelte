<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { onAuthChange } from './services/auth';
  import { currentUser, bootStatus, bootForUser, uiState, currentDayExercises, openWorkoutMode, exitWorkout } from './stores/app';
  import AuthView from './components/AuthView.svelte';
  import MainView from './components/MainView.svelte';
  import StatsView from './components/StatsView.svelte';
  import BootOverlay from './components/BootOverlay.svelte';
  import WorkoutMode from './components/WorkoutMode.svelte';

  let unsubscribeAuth: (() => void) | null = null;
  let activeTab: 'training' | 'stats' = 'training';

  // Elapsed timer for the bottom workout bar
  let elapsed = 0;
  const clockInterval = setInterval(() => {
    const start = $uiState.workoutStartTime;
    elapsed = start ? Math.floor((Date.now() - start) / 1000) : 0;
  }, 1000);

  function fmtElapsed(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

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
    clearInterval(clockInterval);
  });

  // Show workout bar only: training tab, exercises exist, overlay not open
  $: showWorkoutBar = activeTab === 'training' && $currentDayExercises.length > 0 && !$uiState.workoutMode;
</script>

{#if $bootStatus === 'loading'}
  <BootOverlay />
{:else if $currentUser && $bootStatus === 'ready'}
  <div class="app-shell">

    <!-- ── Top tab toggle (Training / Stats) ── -->
    <div class="top-tab-bar">
      <button
        class="top-tab"
        class:active={activeTab === 'training'}
        on:click={() => activeTab = 'training'}
      >Training</button>
      <button
        class="top-tab"
        class:active={activeTab === 'stats'}
        on:click={() => activeTab = 'stats'}
      >Stats</button>
    </div>

    <!-- ── Scrollable content ── -->
    <div class="tab-content">
      {#if activeTab === 'training'}
        <MainView />
      {:else}
        <StatsView />
      {/if}
    </div>

    <!-- ── Bottom workout bar (training tab only) ── -->
    {#if showWorkoutBar}
      <div class="workout-bar">
        {#if $uiState.workoutActive}
          <button class="timer-btn" on:click={exitWorkout} title="Stop workout">
            <span class="timer-dot"></span>
            <span class="timer-val">{fmtElapsed(elapsed)}</span>
            <span class="timer-stop">■</span>
          </button>
          <button class="wm-btn" on:click={openWorkoutMode}>Resume →</button>
        {:else}
          <button class="wm-btn full" on:click={openWorkoutMode}>▶ Start Workout</button>
        {/if}
      </div>
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
    height: 100dvh;
    background: #0c0c0e;
  }

  /* ── Top tab bar ── */
  .top-tab-bar {
    flex-shrink: 0;
    display: flex;
    gap: 6px;
    padding: env(safe-area-inset-top, 0px) 14px 10px;
    padding-top: max(env(safe-area-inset-top, 0px), 10px);
    background: #0c0c0e;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    z-index: 10;
  }

  .top-tab {
    flex: 1;
    padding: 10px 0;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.38);
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .top-tab.active {
    background: rgba(255,194,71,0.12);
    border-color: rgba(255,194,71,0.32);
    color: #ffc247;
  }

  .top-tab:not(.active):active {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.60);
  }

  /* ── Scrollable content ── */
  .tab-content {
    flex: 1 1 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* ── Bottom workout bar ── */
  .workout-bar {
    flex-shrink: 0;
    display: flex;
    gap: 8px;
    padding: 10px 14px;
    padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
    background: #0c0c0e;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  /* Timer chip */
  .timer-btn {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 15px 16px;
    border-radius: 16px;
    border: 1px solid rgba(79,192,141,0.28);
    background: rgba(79,192,141,0.08);
    color: #4fc08d;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
    white-space: nowrap;
  }

  .timer-btn:active { background: rgba(79,192,141,0.16); }

  .timer-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4fc08d;
    animation: blink 1.2s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  .timer-val { font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .timer-stop { font-size: 10px; opacity: 0.5; }

  /* Resume / Start Workout */
  .wm-btn {
    flex: 1 1 0;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid rgba(255,194,71,0.45);
    background: rgba(255,194,71,0.14);
    color: #ffc247;
    font-size: 16px;
    font-weight: 900;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.1s;
  }

  .wm-btn.full {
    background: #ffc247;
    color: #0c0c0e;
    border: none;
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 18px;
    border-radius: 18px;
    box-shadow: 0 4px 28px rgba(255,194,71,0.26);
  }

  .wm-btn:active { background: rgba(255,194,71,0.22); transform: scale(0.98); }
  .wm-btn.full:active { background: #e8b030; transform: scale(0.98); box-shadow: none; }
</style>
