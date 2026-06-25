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

  import { COACH_EMAILS } from './data/config';

  function isCoachAllowed(u: User | null): boolean {
    return u?.email ? COACH_EMAILS.includes(u.email.toLowerCase()) : false;
  }

  /** sessionStorage key for restoring selected trainee across refreshes. */
  const RESTORE_KEY = 'coach_sel_trainee_id';

  type View = 'loading' | 'auth' | 'dashboard' | 'trainee' | 'denied';
  let view: View = 'loading';
  let user: User | null = null;
  let selected: TraineeRow | null = null;
  let unsub: (() => void) | null = null;
  /** ID to restore after trainee list loads; set on auth, consumed by CoachDashboard. */
  let restoreTraineeId: string | null = null;

  onMount(() => {
    unsub = onAuthChange((state) => {
      if (state.status === 'signed_in' || state.status === 'recovery') {
        user = state.user;
        currentUser.set(state.user);
        if (view === 'loading' || view === 'auth') {
          restoreTraineeId = sessionStorage.getItem(RESTORE_KEY);
          view = 'dashboard';
        }
      } else if (state.status === 'signed_out') {
        user = null;
        currentUser.set(null);
        selected = null;
        restoreTraineeId = null;
        sessionStorage.removeItem(RESTORE_KEY);
        view = 'auth';
      }
    });
    return () => unsub?.();
  });

  function openTrainee(t: TraineeRow) {
    selected = t;
    view = 'trainee';
    sessionStorage.setItem(RESTORE_KEY, t.traineeId);
  }
  function backToDashboard() {
    selected = null;
    view = 'dashboard';
    sessionStorage.removeItem(RESTORE_KEY);
  }
  async function handleSignOut() { await signOut(); }
</script>

<div class="coach-root">
  {#if view === 'loading'}
    <div class="coach-loading"><span class="spinner"></span></div>
  {:else if view === 'auth'}
    <AuthView coachMode={true} />
  {:else if view === 'denied'}
    <div class="coach-denied">
      <div class="denied-card">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        <span class="denied-title">Juurdepääs puudub</span>
        <span class="denied-sub">{user?.email} ei ole lisatud treeneri kontode nimekirja.</span>
        <button class="denied-signout" on:click={handleSignOut}>Logi välja</button>
      </div>
    </div>
  {:else}
    <header class="coach-header">
      <div class="ch-left">
        <span class="brand-badge sm">COACH</span>
        {#if view === 'trainee'}
          <button class="back-btn desktop-hidden" on:click={backToDashboard} aria-label="Back to trainees">‹ Trainees</button>
        {/if}
      </div>
      <div class="ch-right">
        <button class="ch-signout" on:click={handleSignOut} aria-label="Sign out" title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </header>

    <div class="coach-columns">
      <!-- Sidebar: trainee list. On mobile hidden when a trainee is open. -->
      <aside class="coach-sidebar" class:mobile-hidden={view === 'trainee'}>
        <CoachDashboard {user} onOpenTrainee={openTrainee} {restoreTraineeId} />
      </aside>
      <!-- Main panel: trainee detail. On mobile hidden on dashboard. -->
      <main class="coach-panel" class:mobile-hidden={view === 'dashboard'}>
        {#if selected}
          <CoachTraineeView trainee={selected} />
        {:else}
          <div class="coach-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p>Select a trainee to view their training</p>
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<ToastNotification />

<style>
  .coach-root {
    min-height: 100dvh;
    background: var(--c-app-bg, transparent);
    color: var(--c-text);
  }

  .coach-denied {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--c-bg-3);
    padding: 24px;
  }
  .denied-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 28px;
    border-radius: 20px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: rgba(var(--c-surface-b), 0.60);
    max-width: 360px;
    text-align: center;
  }
  .denied-card svg { color: rgba(var(--c-fg), 0.30); }
  .denied-title {
    font-size: 17px;
    font-weight: 900;
    color: rgba(var(--c-fg), 0.85);
  }
  .denied-sub {
    font-size: 13px;
    color: rgba(var(--c-fg), 0.50);
    line-height: 1.55;
  }
  .denied-signout {
    margin-top: 8px;
    padding: 10px 24px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-fg), 0.18);
    background: rgba(var(--c-fg), 0.06);
    color: rgba(var(--c-fg), 0.70);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .denied-signout:hover { background: rgba(var(--c-fg), 0.10); }

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
  .back-btn {
    padding: 6px 12px; border-radius: 10px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: rgba(var(--c-surface-b), 0.55);
    color: var(--c-text); font-size: 13px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .back-btn:active { background: rgba(var(--c-surface-b), 0.85); }
  .ch-signout {
    width: 32px; height: 32px; border-radius: 10px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: transparent; color: rgba(var(--c-fg), 0.45);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .ch-signout:active { background: rgba(var(--c-fg), 0.06); color: rgba(var(--c-fg), 0.70); }

  /* ── Mobile layout: sequential dashboard → trainee ── */
  .coach-columns { display: flex; flex-direction: column; min-height: calc(100dvh - 54px); }
  .coach-sidebar, .coach-panel { min-width: 0; }
  .mobile-hidden { display: none; }
  .coach-panel { flex: 1; }

  .coach-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 60vh;
    color: rgba(var(--c-fg), 0.32);
    text-align: center;
    padding: 32px;
  }
  .coach-empty-state svg { opacity: 0.35; }
  .coach-empty-state p { font-size: 14px; font-weight: 600; max-width: 200px; line-height: 1.5; }

  /* ── Desktop layout (≥900px): 2-column sidebar + main panel ── */
  @media (min-width: 900px) {
    .coach-root {
      background:
        radial-gradient(110% 70% at 50% -8%, rgba(var(--c-accent), 0.05), transparent 55%),
        radial-gradient(ellipse at 50% 0%, var(--c-bg-1) 0%, var(--c-bg-2) 45%, var(--c-bg-3) 100%);
    }
    .coach-columns {
      display: grid;
      grid-template-columns: 300px 1fr;
      max-width: 1160px;
      margin: 0 auto;
      min-height: calc(100dvh - 54px);
      gap: 0;
    }
    .mobile-hidden { display: revert; }
    .desktop-hidden { display: none; }
    .coach-sidebar {
      border-right: 1px solid rgba(var(--c-edge-b), 0.18);
      background: rgba(var(--c-surface-b), 0.30);
      overflow: hidden auto;
      width: 300px;
      box-sizing: border-box;
    }
    .coach-panel {
      border-left: none;
      background: linear-gradient(180deg, rgba(var(--c-fg), 0.016), transparent 280px);
      box-shadow: inset 1px 0 0 rgba(var(--c-edge-b), 0.10);
      overflow-y: auto;
    }
    .coach-header {
      max-width: 1160px;
      margin: 0 auto;
    }
  }

</style>
