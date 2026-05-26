<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { onAuthChange } from './services/auth';
  import { currentUser, bootStatus, bootForUser, uiState, currentDayExercises, openWorkoutMode, exitWorkout } from './stores/app';
  import AuthView from './components/AuthView.svelte';
  import MainView from './components/MainView.svelte';
  import BootOverlay from './components/BootOverlay.svelte';
  import WorkoutMode from './components/WorkoutMode.svelte';

  let unsubscribeAuth: (() => void) | null = null;

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

  $: showWorkoutBar = $currentDayExercises.length > 0 && !$uiState.workoutMode;
</script>

{#if $bootStatus === 'loading'}
  <BootOverlay />
{:else if $currentUser && $bootStatus === 'ready'}
  <div class="app-shell">

    <!-- ── Scrollable content ── -->
    <div class="scroll-content">
      <MainView />
    </div>

    <!-- ── Bottom workout bar ── -->
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
    background: radial-gradient(ellipse at 50% 0%, #0d1a2e 0%, #08090f 52%, #050508 100%);
  }

  /* ── Scrollable content ── */
  .scroll-content {
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
    background: rgba(7,9,18,0.94);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(60,90,165,0.16);
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
    border: 1px solid rgba(196,148,46,0.45);
    background: rgba(196,148,46,0.14);
    color: #c49230;
    font-size: 16px;
    font-weight: 900;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.1s;
  }

  .wm-btn.full {
    background: #c49230;
    color: #0c0c0e;
    border: none;
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 18px;
    border-radius: 18px;
    box-shadow: 0 4px 28px rgba(196,148,46,0.22);
  }

  .wm-btn:active { background: rgba(196,148,46,0.22); transform: scale(0.98); }
  .wm-btn.full:active { background: #b07e22; transform: scale(0.98); box-shadow: none; }
</style>
