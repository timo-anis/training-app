<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { onAuthChange } from './services/auth';
  import { currentUser, bootStatus, bootForUser, uiState, currentDayExercises, openWorkoutMode, exitWorkout, searchOpen, appState, sheetOpen, undoAction, execUndo, requestOnboarding } from './stores/app';
  import AuthView from './components/AuthView.svelte';
  import MainView from './components/MainView.svelte';
  import BootOverlay from './components/BootOverlay.svelte';
  import WorkoutMode from './components/WorkoutMode.svelte';
  import SearchOverlay from './components/SearchOverlay.svelte';
  import OnboardingOverlay from './components/OnboardingOverlay.svelte';
  import ToastNotification from './components/ToastNotification.svelte';

  let unsubscribeAuth: (() => void) | null = null;

  // Onboarding — show once on first login, then as a floating chip until first workout done
  let showOnboarding = false;

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
    const user = $currentUser;
    if (user) {
      try { localStorage.setItem(onboardingKey(user.id), '1'); } catch { /* ignore */ }
    }
  }

  // Re-open the walkthrough when requested from elsewhere (e.g. Quick guide)
  $: if ($requestOnboarding) { showOnboarding = true; requestOnboarding.set(false); }

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

  $: showWorkoutBar = $currentDayExercises.length > 0 && !$uiState.workoutMode && !showOnboarding && !$sheetOpen;
</script>

<ToastNotification />

<svelte:boundary>
  {#snippet failed(error: unknown)}
    <div class="error-boundary">
      <div class="error-card">
        <div class="error-icon">⚠</div>
        <p class="error-title">Something went wrong</p>
        <p class="error-msg">{error instanceof Error ? error.message : 'Unexpected error'}</p>
        <button class="error-reload" on:click={() => window.location.reload()}>Reload app</button>
      </div>
    </div>
  {/snippet}

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
    <SearchOverlay />
  {/if}

  {#if $undoAction && !$uiState.workoutMode}
    <div class="global-undo-toast">
      <span class="undo-label">{$undoAction.label}</span>
      <button class="undo-btn" on:click={execUndo}>Undo</button>
    </div>
  {/if}

  {#if showOnboarding}
    <OnboardingOverlay on:done={dismissOnboarding} />
  {/if}

{:else}
  <AuthView />
{/if}

</svelte:boundary>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: radial-gradient(ellipse at 50% 0%, var(--c-bg-1) 0%, var(--c-bg-2) 52%, var(--c-bg-3) 100%);
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
    background: var(--c-7-9-18-0_94);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(var(--c-edge-b), 0.16);
  }

  /* Timer chip */
  .timer-btn {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 15px 16px;
    border-radius: 16px;
    border: 1px solid rgba(var(--c-fg), 0.16);
    background: rgba(var(--c-fg), 0.06);
    color: rgba(var(--c-fg), 0.80);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
    white-space: nowrap;
  }

  .timer-btn:active { background: rgba(var(--c-fg), 0.12); }

  .timer-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(var(--c-fg), 0.70);
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
    border: 1px solid rgba(var(--c-accent), 0.45);
    background: rgba(var(--c-accent), 0.14);
    color: var(--c-accent-solid);
    font-size: 16px;
    font-weight: 900;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.1s;
  }

  .wm-btn.full {
    background: var(--c-accent-solid);
    color: var(--h-0c0c0e);
    border: none;
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 18px;
    border-radius: 18px;
    box-shadow: 0 4px 28px rgba(var(--c-accent), 0.22);
  }

  .wm-btn:active { background: rgba(var(--c-accent), 0.22); transform: scale(0.98); }
  .wm-btn.full:active { background: var(--h-b07e22); transform: scale(0.98); box-shadow: none; }

  /* ── Help chip ── */


  /* Desktop — constrain the bar and shrink the button */
  @media (min-width: 640px) {
    .workout-bar {
      justify-content: center;
      padding: 10px 24px;
      border-top-color: rgba(var(--c-fg), 0.07);
    }

    .wm-btn {
      flex: 0 0 auto;
      max-width: 280px;
    }

    .wm-btn.full {
      padding: 12px 28px;
      font-size: 14px;
      border-radius: 14px;
      box-shadow: 0 2px 14px rgba(var(--c-accent), 0.18);
    }
  }

  .global-undo-toast {
    position: fixed;
    bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    left: 14px;
    right: 14px;
    max-width: 612px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: var(--c-18-30-60-0_96);
    border: 1px solid rgba(var(--c-edge-e), 0.30);
    border-radius: 14px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 90;
    animation: toast-in 0.2s ease;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .undo-label {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.55);
  }

  .undo-btn {
    padding: 7px 14px;
    border-radius: 9px;
    border: 1px solid rgba(var(--c-accent), 0.35);
    background: rgba(var(--c-accent), 0.12);
    color: var(--c-accent-solid);
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .undo-btn:active { background: rgba(var(--c-accent), 0.25); }

  /* ── Error boundary fallback ── */
  .error-boundary {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at 50% 0%, var(--c-bg-1, #0d1a2e) 0%, var(--c-bg-3, #050508) 100%);
    padding: 24px;
    z-index: 9999;
  }

  .error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 320px;
    text-align: center;
  }

  .error-icon { font-size: 36px; opacity: 0.6; }

  .error-title {
    font-size: 18px;
    font-weight: 700;
    color: rgba(232, 240, 255, 0.9);
    margin: 0;
  }

  .error-msg {
    font-size: 13px;
    color: rgba(232, 240, 255, 0.45);
    margin: 0;
    word-break: break-word;
  }

  .error-reload {
    margin-top: 8px;
    padding: 12px 28px;
    border-radius: 14px;
    border: 1px solid rgba(196, 146, 48, 0.45);
    background: rgba(196, 146, 48, 0.14);
    color: #d4a038;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
  }
</style>
