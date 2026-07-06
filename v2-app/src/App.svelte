<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { onAuthChange } from './services/auth';
  import { logCaughtError } from './services/errorTracker';
  import { isRecoveryPending, clearRecoveryPending } from './services/supabase';
  import { currentUser, bootStatus, bootForUser, uiState, currentDayExercises, openWorkoutMode, exitWorkout, searchOpen, hintsOpen, recordsOpen, recoveryOpen, accountOpen, statsOpen, appState, sheetOpen, undoAction, execUndo, requestOnboarding } from './stores/app';
  import { clearStoredNavSnapshot } from './stores/ui-state';
  import { displayName } from './stores/ui-state';
  import { getDisplayName } from './services/profile';
  import RecordsSheet from './components/RecordsSheet.svelte';
  import StatsSheet   from './components/StatsSheet.svelte';
  import RecoverySheet from './components/RecoverySheet.svelte';
  import AccountSheet from './components/AccountSheet.svelte';
  import AuthView from './components/AuthView.svelte';
  import MainView from './components/MainView.svelte';
  import BootOverlay from './components/BootOverlay.svelte';
  import WorkoutMode from './components/WorkoutMode.svelte';
  import SearchOverlay from './components/SearchOverlay.svelte';
  import OnboardingOverlay from './components/OnboardingOverlay.svelte';
  import ToastNotification from './components/ToastNotification.svelte';

  let unsubscribeAuth: (() => void) | null = null;

  // Password-reset landing: show the set-new-password screen instead of booting.
  // Seeded from the recovery flag captured at client creation (supabase.ts),
  // which is reliable regardless of flow type (PKCE ?code= vs implicit hash)
  // and auth-event timing.
  let recoveryMode = isRecoveryPending();

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
      if (state.status === 'recovery') {
        // Reset link: hold at the set-new-password screen; do not boot yet.
        recoveryMode = true;
        currentUser.set(state.user);
        return;
      }
      if (state.status === 'signed_in') {
        currentUser.set(state.user);
        // While recovering, the session is valid but we wait for the new
        // password before entering the app. Re-check the persisted flag in case
        // PASSWORD_RECOVERY landed between init and this event.
        if (recoveryMode || isRecoveryPending()) { recoveryMode = true; return; }
        await bootForUser(state.user);
        // Load display name from profiles (fire-and-forget)
        getDisplayName(state.user.id).then(n => displayName.set(n)).catch(() => {});
        // Show onboarding only for users with no training data yet
        const hasData = $appState.weeks.some(w => w.exercises.length > 0);
        showOnboarding = !hasData && checkOnboarding(state.user.id);
      } else if (state.status === 'signed_out') {
        clearStoredNavSnapshot(); // next login always boots to today
        currentUser.set(null);
        displayName.set('');
        recoveryMode = false;
        clearRecoveryPending();
        bootStatus.set('idle');
      }
    });
  });

  async function handleRecovered() {
    recoveryMode = false;
    clearRecoveryPending();
    // Drop the recovery code/hash so a reload doesn't re-trigger the flow.
    try {
      history.replaceState(null, '', window.location.pathname);
    } catch { /* ignore */ }
    const user = $currentUser;
    if (user) {
      await bootForUser(user);
      const hasData = $appState.weeks.some(w => w.exercises.length > 0);
      showOnboarding = !hasData && checkOnboarding(user.id);
    }
  }

  onDestroy(() => {
    unsubscribeAuth?.();
    clearInterval(clockInterval);
  });

  $: showWorkoutBar = $currentDayExercises.length > 0 && !$uiState.workoutMode && !showOnboarding && !$sheetOpen;
</script>

<ToastNotification />

<svelte:boundary onerror={(e) => logCaughtError(e, 'app-root')}>
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

{#if recoveryMode}
  <AuthView recovery={true} onRecovered={handleRecovered} />
{:else if $bootStatus === 'loading'}
  <BootOverlay />
{:else if $currentUser && $bootStatus === 'ready'}
  <div class="app-shell">

    <!-- ── Scrollable content ── -->
    <div class="scroll-content" class:workout-blur={$uiState.workoutMode} class:overlay-blur={$hintsOpen || $recordsOpen || $recoveryOpen || $searchOpen || $accountOpen || $statsOpen}>
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

  {#if $hintsOpen}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="hints-backdrop" on:click={() => ($hintsOpen = false)}>
      <div class="hints-sheet" on:click|stopPropagation>
        <div class="hints-header">
          <span class="hints-title">Quick guide</span>
          <button class="hints-close" on:click={() => ($hintsOpen = false)}>✕</button>
        </div>
        <div class="hints-grid">
          <div class="hint-card">
            <div class="hint-header"><span class="hint-num">1</span><span class="hint-title">Calendar</span></div>
            <p class="hint-desc">Tap any day to view or add exercises for that day</p>
          </div>
          <div class="hint-card">
            <div class="hint-header"><span class="hint-num">2</span><span class="hint-title">Coach chat</span></div>
            <p class="hint-desc">If you have a coach connected to the app, use the chat to communicate — ask questions, get feedback on sessions, or discuss your plan. Find it under <em>Coaching</em> in your account.</p>
          </div>
          <div class="hint-card">
            <div class="hint-header"><span class="hint-num">3</span><span class="hint-title">Rest timer</span></div>
            <p class="hint-desc">Auto-starts after each set, or set it manually: ＋/－ adjusts in 15s steps, then tap Start. Presets: 1′ / 1:30 / 2′ / 3′</p>
          </div>
          <div class="hint-card">
            <div class="hint-header"><span class="hint-num">4</span><span class="hint-title">RPE — rate of perceived exertion</span></div>
            <p class="hint-desc">After each set, tap the RPE chip to rate effort on a <strong>6–10 scale</strong> (10 = absolute max). The app suggests a value based on your history — confirm or adjust. Helps track intensity over time.</p>
          </div>
          <div class="hint-card">
            <div class="hint-header"><span class="hint-num">5</span><span class="hint-title">Session note</span></div>
            <p class="hint-desc">Tap <em>+ Session note</em> during workout to log how it felt</p>
          </div>
          <div class="hint-card">
            <div class="hint-header"><span class="hint-num">6</span><span class="hint-title">Statistics</span></div>
            <p class="hint-desc">Tap Statistics to see volume, weekly breakdown and progress charts</p>
          </div>
          <div class="hint-card">
            <div class="hint-header"><span class="hint-num">7</span><span class="hint-title">Training</span></div>
            <p class="hint-desc">Expand day → add exercises → tap <em>▶ Start Workout</em></p>
          </div>
          <div class="hint-card">
            <div class="hint-header"><span class="hint-num">8</span><span class="hint-title">Workout mode</span></div>
            <p class="hint-desc">Swipe left/right between exercises. Tap ○ to mark a set done</p>
          </div>
        </div>
        <button class="hints-walkthrough" on:click={() => { $hintsOpen = false; requestOnboarding.set(true); }}>
          ▶ Replay walkthrough
        </button>
      </div>
    </div>
  {/if}

  {#if $statsOpen}
    <StatsSheet on:close={() => ($statsOpen = false)} />
  {/if}
  {#if $recordsOpen}
    <RecordsSheet on:close={() => ($recordsOpen = false)} />
  {/if}

  {#if $recoveryOpen}
    <RecoverySheet on:close={() => ($recoveryOpen = false)} />
  {/if}

  {#if $accountOpen}
    <AccountSheet on:close={() => ($accountOpen = false)} />
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

{:else if $currentUser && $bootStatus === 'error'}
  <!-- Authenticated but boot failed: show a recoverable error, not the
       sign-in form (which wrongly implies the user is signed out). -->
  <div class="error-boundary">
    <div class="error-card">
      <div class="error-icon">⚠</div>
      <p class="error-title">Couldn’t load your training data</p>
      <p class="error-msg">Check your connection and try again.</p>
      <button class="error-reload" on:click={() => window.location.reload()}>Reload app</button>
    </div>
  </div>
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
    font-variant-numeric: tabular-nums;
  }

  /* ── Scrollable content ── */
  .scroll-content {
    flex: 1 1 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* ── Bottom workout bar ── */
  .workout-bar {
    position: relative;
    z-index: 1;
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
    color: rgba(var(--c-fg), 0.9);
    margin: 0;
  }

  .error-msg {
    font-size: 13px;
    color: rgba(var(--c-fg), 0.45);
    margin: 0;
    word-break: break-word;
  }

  .error-reload {
    margin-top: 8px;
    padding: 12px 28px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-accent), 0.45);
    background: rgba(var(--c-accent), 0.14);
    color: var(--c-accent-solid);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
  }

  /* ============================================================
     Desktop framing (>=900px): turn the centered column into a
     defined app panel on an ambient "desk". Mobile/PWA untouched.
     ============================================================ */
  @media (min-width: 900px) {
    .scroll-content.workout-blur { filter: blur(12px); pointer-events: none; transition: filter 0.25s; }
    .scroll-content.overlay-blur { filter: blur(10px); pointer-events: none; transition: filter 0.20s; }
    .app-shell {
      background:
        radial-gradient(125% 85% at 50% -10%, rgba(var(--c-accent), 0.07), transparent 50%),
        radial-gradient(130% 110% at 50% 42%, transparent 58%, rgba(var(--c-shadow), 0.30)),
        radial-gradient(ellipse at 50% 0%, var(--c-bg-1) 0%, var(--c-bg-2) 45%, var(--c-bg-3) 100%);
    }
    /* Desktop: the Start/Resume/Stop control moves into the session pane
       (MainView). Hide the bottom workout-bar on desktop; mobile keeps it. */
    .workout-bar { display: none; }
  }

</style>
