<script lang="ts">
  import { onMount } from 'svelte';
  import { onAuthChange, signOut } from './services/auth';
  import { currentUser } from './stores/app';
  import type { User } from '@supabase/supabase-js';
  import AuthView from './components/AuthView.svelte';
  import CoachDashboard from './components/coach/CoachDashboard.svelte';
  import CoachTraineeView from './components/coach/CoachTraineeView.svelte';
  import ToastNotification from './components/ToastNotification.svelte';
  import type { TraineeRow } from './services/coach';

  type View = 'loading' | 'auth' | 'dashboard' | 'trainee';
  let view: View = 'loading';
  let user: User | null = null;
  let selected: TraineeRow | null = null;
  let unsub: (() => void) | null = null;

  onMount(() => {
    unsub = onAuthChange((state) => {
      if (state.status === 'signed_in' || state.status === 'recovery') {
        user = state.user;
        currentUser.set(state.user);
        if (view === 'loading' || view === 'auth') view = 'dashboard';
      } else if (state.status === 'signed_out') {
        user = null;
        currentUser.set(null);
        selected = null;
        view = 'auth';
      }
    });
    return () => unsub?.();
  });

  function openTrainee(t: TraineeRow) { selected = t; view = 'trainee'; }
  function backToDashboard() { selected = null; view = 'dashboard'; }
  async function handleSignOut() { await signOut(); }
</script>

<div class="coach-root">
  {#if view === 'loading'}
    <div class="coach-loading"><span class="spinner"></span></div>
  {:else if view === 'auth'}
    <div class="auth-wrap">
      <div class="coach-brand">
        <span class="brand-badge">COACH</span>
        <span class="brand-sub">Sign in to view your trainees</span>
      </div>
      <AuthView />
    </div>
  {:else}
    <header class="coach-header">
      <div class="ch-left">
        <span class="brand-badge sm">COACH</span>
        {#if view === 'trainee'}
          <button class="back-btn" on:click={backToDashboard} aria-label="Back to trainees">‹ Trainees</button>
        {/if}
      </div>
      <div class="ch-right">
        <span class="ch-email">{user?.email ?? ''}</span>
        <button class="ch-signout" on:click={handleSignOut}>Sign out</button>
      </div>
    </header>

    <main class="coach-main">
      {#if view === 'dashboard'}
        <CoachDashboard {user} onOpenTrainee={openTrainee} />
      {:else if view === 'trainee' && selected}
        <CoachTraineeView trainee={selected} />
      {/if}
    </main>
  {/if}
</div>

<ToastNotification />

<style>
  .coach-root {
    min-height: 100dvh;
    background: var(--c-app-bg, transparent);
    color: var(--c-text);
  }

  .coach-loading {
    min-height: 100dvh;
    display: flex; align-items: center; justify-content: center;
  }
  .spinner {
    width: 26px; height: 26px; border-radius: 50%;
    border: 3px solid rgba(var(--c-fg), 0.15);
    border-top-color: var(--c-accent-solid);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .auth-wrap { max-width: 460px; margin: 0 auto; padding: 24px 16px; }
  .coach-brand { text-align: center; margin-bottom: 8px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .brand-sub { font-size: 13px; color: rgba(var(--c-fg), 0.50); }

  .brand-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(var(--c-accent), 0.16);
    border: 1px solid rgba(var(--c-accent), 0.40);
    color: var(--c-accent-solid);
    font-size: 12px; font-weight: 900; letter-spacing: 0.14em;
  }
  .brand-badge.sm { font-size: 11px; padding: 3px 10px; letter-spacing: 0.12em; }

  .coach-header {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(var(--c-bg-1), 0.86);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(var(--c-edge-b), 0.18);
  }
  .ch-left, .ch-right { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .ch-email {
    font-size: 12px; color: rgba(var(--c-fg), 0.55); font-weight: 600;
    max-width: 38vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .back-btn {
    padding: 6px 12px; border-radius: 10px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: rgba(var(--c-surface-b), 0.55);
    color: var(--c-text); font-size: 13px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .back-btn:active { background: rgba(var(--c-surface-b), 0.85); }
  .ch-signout {
    padding: 6px 12px; border-radius: 10px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: transparent; color: rgba(var(--c-fg), 0.60);
    font-size: 13px; font-weight: 700; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ch-signout:active { background: rgba(var(--c-fg), 0.06); }

  .coach-main { max-width: 640px; margin: 0 auto; padding: 0 0 40px; }
</style>
