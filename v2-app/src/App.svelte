<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { onAuthChange } from './services/auth';
  import { currentUser, bootStatus, bootForUser, uiState, currentDayExercises, openWorkoutMode, exitWorkout, searchOpen, appState } from './stores/app';
  import AuthView from './components/AuthView.svelte';
  import MainView from './components/MainView.svelte';
  import BootOverlay from './components/BootOverlay.svelte';
  import WorkoutMode from './components/WorkoutMode.svelte';
  import SearchOverlay from './components/SearchOverlay.svelte';
  import OnboardingOverlay from './components/OnboardingOverlay.svelte';

  let unsubscribeAuth: (() => void) | null = null;

  // Onboarding — show once on first login, then as a floating chip until first workout done
  let showOnboarding = false;
  let onboardingDone = false; // true once user has clicked through the overlay at least once

  function onboardingKey(userId: string) {
    return `timo_training_v4_onboarded__${userId}`;
  }

  function checkOnboarding(userId: string) {
    try {
      return !localStorage.getItem(onboardingKey(userId));
    } catch { return false; }
  }

  function dismissOnboarding() {
    showOnboarding = false;
    onboardingDone = true;
    const user = $currentUser;
    if (user) {
      try { localStorage.setItem(onboardingKey(user.id), '1'); } catch { /* ignore */ }
    }
  }

  // Help chip visible after first dismissal, until the first workout is completed
  $: hasCompletedWorkout = $appState.weeks.some(w => w.completed === true);
  $: showHelpChip = onboardingDone && !hasCompletedWorkout && !showOnboarding;

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
        // Show onboarding for new users who haven't seen it yet
        showOnboarding = checkOnboarding(state.user.id);
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

  $: showWorkoutBar = $currentDayExercises.length > 0 && !$uiState.workoutMode && !showOnboarding;
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

  {#if $searchOpen}
    <SearchOverlay onClose={() => $searchOpen = false} />
  {/if}

  {#if showOnboarding}
    <OnboardingOverlay on:done={dismissOnboarding} />
  {/if}

  {#if showHelpChip}
    <button
      class="help-chip"
      class:above-bar={showWorkoutBar}
      on:click={() => showOnboarding = true}
      aria-label="Open help"
    >
      <span class="help-icon">?</span>
      <span class="help-label">Juhised</span>
    </button>
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
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.80);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
    white-space: nowrap;
  }

  .timer-btn:active { background: rgba(255,255,255,0.12); }

  .timer-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,0.70);
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

  /* ── Help chip ── */
  .help-chip {
    position: fixed;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    right: 16px;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid rgba(196, 148, 46, 0.45);
    background: rgba(10, 14, 28, 0.92);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #c49230;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.1s;
    box-shadow: 0 2px 16px rgba(0,0,0,0.40);
  }

  .help-chip.above-bar {
    bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  }

  .help-chip:active { background: rgba(196,148,46,0.14); transform: scale(0.96); }

  .help-icon {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1.5px solid rgba(196,148,46,0.70);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 900;
    line-height: 1;
    flex-shrink: 0;
  }

  .help-label {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  /* Desktop — constrain the bar and shrink the button */
  @media (min-width: 640px) {
    .workout-bar {
      justify-content: center;
      padding: 10px 24px;
      border-top-color: rgba(255,255,255,0.07);
    }

    .wm-btn {
      flex: 0 0 auto;
      max-width: 280px;
    }

    .wm-btn.full {
      padding: 12px 28px;
      font-size: 14px;
      border-radius: 14px;
      box-shadow: 0 2px 14px rgba(196,148,46,0.18);
    }
  }
</style>
