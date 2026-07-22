<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser, appState, updateState, showToast, theme, toggleTheme, canUsePresentation } from '../stores/app';
  import { displayName } from '../stores/ui-state';
  import { signOut, sendPasswordReset } from '../services/auth';
  import { setDisplayName } from '../services/profile';
  import { saveLocal } from '../services/storage';
  import { emptyAppState } from '../types/workout';
  import type { AppState } from '../types/workout';
  import { supabase } from '../services/supabase';
  import CoachInviteSection from './CoachInviteSection.svelte';
  import { getPushState, enablePush, disablePush, type PushReason } from '../services/push';
  import { biometricSupported, registerBiometric } from '../services/biometric';
  import { lockEnabled, setLockEnabledForUser, readLockEnabled } from '../stores/app';

  const dispatch = createEventDispatcher<{ close: void }>();

  let confirmClear = false;
  let resetSent = false;
  let loading = false;
  let nameValue = '';
  let nameEditing = false;
  $: if (!nameEditing) nameValue = $displayName;
  function focusNameInput(el: HTMLElement) { el.focus(); }

  $: initial = ((nameEditing ? nameValue : $displayName)?.[0] ?? $currentUser?.email?.[0] ?? '?').toUpperCase();

  function startEdit() { nameEditing = true; nameValue = $displayName; }
  function cancelName() { nameEditing = false; nameValue = $displayName; }

  // Push notifications
  let pushReady = false;
  let pushOn = false;
  let pushBusy = false;
  function refreshPushState() {
    const st = getPushState();
    pushReady = st.configured && st.supported;
    pushOn = st.permission === 'granted';
  }
  const PUSH_MSG: Record<PushReason, string> = {
    'ok': 'Notifications on',
    'not-configured': 'Notifications not set up yet',
    'unsupported': "This browser can't do notifications",
    'not-standalone': 'Add the app to your Home Screen first',
    'denied': 'Notifications were blocked — enable them in Settings',
    'error': 'Could not enable notifications',
  };
  async function togglePush() {
    const user = $currentUser;
    if (!user || pushBusy) return;
    pushBusy = true;
    try {
      if (pushOn) {
        await disablePush(user.id);
        showToast('Notifications off', 'info');
      } else {
        const reason = await enablePush(user.id);
        showToast(PUSH_MSG[reason], reason === 'ok' ? 'success' : 'error');
      }
      refreshPushState();
    } finally {
      pushBusy = false;
    }
  }
  onMount(refreshPushState);

  // ── Biometric app-open lock ──
  const bioSupported = biometricSupported();
  let bioBusy = false;
  // Reflects the persisted per-user pref; kept in sync with the store.
  $: bioOn = $lockEnabled;
  onMount(() => {
    const uid = $currentUser?.id;
    // Seed the store's enabled flag from storage in case this sheet opens before boot seeded it.
    if (uid && $lockEnabled !== readLockEnabled(uid)) {
      setLockEnabledForUser(uid, readLockEnabled(uid));
    }
  });
  async function toggleBioLock() {
    const uid = $currentUser?.id;
    if (!uid || bioBusy) return;
    bioBusy = true;
    try {
      if (bioOn) {
        setLockEnabledForUser(uid, false);
        showToast('Face ID lock off', 'info');
      } else {
        const reason = await registerBiometric(uid, $currentUser?.email ?? 'Training App');
        if (reason === 'ok') {
          setLockEnabledForUser(uid, true);
          showToast('Face ID lock on', 'success');
        } else if (reason === 'cancelled') {
          showToast('Cancelled', 'info');
        } else if (reason === 'unsupported') {
          showToast("Face ID isn't available on this device", 'error');
        } else {
          showToast('Could not set up Face ID lock', 'error');
        }
      }
    } finally {
      bioBusy = false;
    }
  }

  async function handlePasswordReset() {
    const email = $currentUser?.email;
    if (!email) return;
    loading = true;
    try {
      await sendPasswordReset(email);
      resetSent = true;
      showToast('Password reset email sent', 'success');
    } catch {
      showToast('Failed to send reset email', 'error');
    } finally {
      loading = false;
    }
  }

  async function handleClearData() {
    if (!confirmClear) { confirmClear = true; return; }
    const user = $currentUser;
    if (!user) return;
    loading = true;
    try {
      const empty = emptyAppState();
      updateState(() => empty);
      // saveLocal is called synchronously by updateState → scheduleSave.
      // We do NOT call saveCloud here: hasData() guards it (empty state has no
      // exercises), so the cloud intentionally retains the last blob as a
      // recovery net. A reinstall will restore data — this is by design.
      saveLocal(user.id, empty);
      showToast('All training data cleared', 'info');
      dispatch('close');
    } catch {
      showToast('Failed to clear data', 'error');
    } finally {
      loading = false;
      confirmClear = false;
    }
  }

  async function handleSignOut() {
    await signOut();
    dispatch('close');
  }

  async function saveName() {
    const trimmed = nameValue.trim();
    const uid = $currentUser?.id;
    nameEditing = false;
    if (!uid) return;
    displayName.set(trimmed);
    try {
      await setDisplayName(uid, trimmed);
    } catch {
      displayName.set($displayName);
      showToast('Failed to save name — try again', 'error');
    }
  }

  function close() { dispatch('close'); confirmClear = false; }

  // ── Restore from backup ──
  type BackupRow = { id: string; captured_at: string; reason: string; state_json: unknown };
  let showBackups = false;
  let loadingBackups = false;
  let backups: BackupRow[] = [];
  let confirmRestoreId: string | null = null;
  let backupsLoaded = false;

  function formatBackupTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  async function toggleBackups() {
    showBackups = !showBackups;
    confirmRestoreId = null;
    if (showBackups && !backupsLoaded) {
      loadingBackups = true;
      try {
        const uid = $currentUser?.id;
        if (!uid) return;
        const { data, error } = await supabase
          .from('app_state_history')
          .select('id, captured_at, reason, state_json')
          .eq('user_id', uid)
          .order('captured_at', { ascending: false })
          .limit(5);
        if (error) throw error;
        backups = (data ?? []) as BackupRow[];
        backupsLoaded = true;
      } catch {
        showToast('Could not load backups', 'error');
        showBackups = false;
      } finally {
        loadingBackups = false;
      }
    }
  }

  async function restoreBackup(snap: BackupRow) {
    if (confirmRestoreId !== snap.id) {
      confirmRestoreId = snap.id;
      return;
    }
    // Second tap — confirmed
    confirmRestoreId = null;
    try {
      updateState(() => snap.state_json as AppState, true);
      showToast('Training data restored', 'success');
      showBackups = false;
      dispatch('close');
    } catch {
      showToast('Restore failed — try again', 'error');
    }
  }
</script>

<div class="account-backdrop" on:click={close} aria-hidden="true"></div>
<div class="account-sheet" role="dialog" aria-label="Account">
  <div class="sheet-handle"></div>

  <div class="sheet-body">

    <!-- Identity card -->
    <div class="identity-card" class:editing={nameEditing}>
      <div class="id-avatar">{initial}</div>

      {#if !nameEditing}
        <button class="id-edit-btn" on:click={startEdit} aria-label="Edit name">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
      {/if}

      {#if nameEditing}
        <div class="id-name-label">YOUR NAME</div>
        <input
          class="id-name-input"
          type="text"
          bind:value={nameValue}
          on:keydown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') cancelName(); }}
          placeholder="Your name…"
          maxlength={40}
          use:focusNameInput
        />
        <div class="id-email">{$currentUser?.email ?? ''}</div>
        <div class="id-btn-row">
          <button class="id-btn-cancel" on:click={cancelName}>Cancel</button>
          <button class="id-btn-save" on:click={saveName}>Save</button>
        </div>
      {:else}
        <div class="id-name">{$displayName || 'Add your name'}</div>
        <div class="id-email">{$currentUser?.email ?? ''}</div>
        <div class="id-status">
          <span class="id-dot"></span>
          Signed in
        </div>
      {/if}
    </div>

    <div class="section-gap"></div>

    <!-- Change password -->
    <button class="action-row" on:click={handlePasswordReset} disabled={loading || resetSent}>
      <span class="action-icon">🔑</span>
      <div class="action-text">
        <span class="action-label">{resetSent ? 'Reset email sent' : 'Change password'}</span>
        <span class="action-sub">{resetSent ? 'Check your inbox' : 'Send password reset email'}</span>
      </div>
      {#if !resetSent}<span class="action-arrow">›</span>{/if}
    </button>

{#if $canUsePresentation}
    <!-- Presentation mode -->
    <button class="action-row" on:click={toggleTheme} aria-pressed={$theme === 'presentation'}>
      <span class="action-icon">{$theme === 'presentation' ? '☀️' : '🌙'}</span>
      <div class="action-text">
        <span class="action-label">Presentation mode</span>
        <span class="action-sub">{$theme === 'presentation' ? 'Light, high-contrast — for demos' : 'Dark theme (default)'}</span>
      </div>
      <span class="switch" class:on={$theme === 'presentation'}><span class="knob"></span></span>
    </button>
    {/if}

    <!-- Clear data -->
    <button
      class="action-row"
      class:danger={confirmClear}
      on:click={handleClearData}
      disabled={loading}
    >
      <span class="action-icon">🗑</span>
      <div class="action-text">
        <span class="action-label" class:danger-lbl={confirmClear}>
          {confirmClear ? 'Tap again to confirm' : 'Clear all training data'}
        </span>
        <span class="action-sub">
          {confirmClear ? 'This cannot be undone' : 'Removes all workouts permanently'}
        </span>
      </div>
      <span class="action-arrow">›</span>
    </button>

    <!-- Restore from backup -->
    <button class="action-row" on:click={toggleBackups} aria-expanded={showBackups}>
      <span class="action-icon">🔄</span>
      <div class="action-text">
        <span class="action-label">Restore from backup</span>
        <span class="action-sub">View recent auto-saved snapshots</span>
      </div>
      <span class="action-arrow" class:backup-arrow-open={showBackups}>›</span>
    </button>
    {#if showBackups}
      <div class="backup-panel">
        {#if loadingBackups}
          <div class="backup-empty">Loading…</div>
        {:else if backups.length === 0}
          <div class="backup-empty">No backups found</div>
        {:else}
          {#each backups as snap (snap.id)}
            {@const isConfirm = confirmRestoreId === snap.id}
            <button
              class="backup-row"
              class:backup-confirm={isConfirm}
              on:click={() => restoreBackup(snap)}
            >
              <div class="backup-info">
                <span class="backup-time">{formatBackupTime(snap.captured_at)}</span>
                <span class="backup-reason">{snap.reason}</span>
              </div>
              <span class="backup-cta">{isConfirm ? 'Confirm?' : 'Restore'}</span>
            </button>
          {/each}
        {/if}
      </div>
    {/if}

    <div class="divider"></div>

    {#if pushReady}
    <button class="action-row" on:click={togglePush} disabled={pushBusy} aria-pressed={pushOn}>
      <span class="action-icon">🔔</span>
      <div class="action-text">
        <span class="action-label">{pushOn ? 'Notifications on' : 'Enable notifications'}</span>
        <span class="action-sub">{pushOn ? 'New messages will ping this device' : 'Get pinged when your coach messages you'}</span>
      </div>
      <span class="switch" class:on={pushOn}><span class="knob"></span></span>
    </button>
    {/if}

    {#if bioSupported}
    <button class="action-row" on:click={toggleBioLock} disabled={bioBusy} aria-pressed={bioOn}>
      <span class="action-icon">🔒</span>
      <div class="action-text">
        <span class="action-label">{bioOn ? 'Face ID lock on' : 'Face ID lock'}</span>
        <span class="action-sub">{bioOn ? 'Unlock with Face ID each time you open the app' : 'Require Face ID to open the app'}</span>
      </div>
      <span class="switch" class:on={bioOn}><span class="knob"></span></span>
    </button>
    {/if}

    <!-- Coaching -->
    <CoachInviteSection />

    <!-- Sign out -->
    <button class="action-row signout" on:click={handleSignOut}>
      <span class="action-icon">👋</span>
      <div class="action-text">
        <span class="action-label">Sign out</span>
      </div>
      <span class="action-arrow">›</span>
    </button>
  </div>
</div>

<style>
  .account-backdrop {
    position: fixed;
    inset: 0;
    z-index: 199;
    background: rgba(var(--c-shadow), 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .account-sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 200;
    background: linear-gradient(180deg, var(--c-bg-1) 0%, var(--h-080c18) 100%);
    border: 1px solid rgba(var(--c-edge-d), 0.22);
    border-top: 1px solid rgba(var(--c-accent), 0.22);
    border-radius: 22px 22px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    animation: sheet-up 0.24s cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  @media (min-width: 640px) {
    .account-sheet {
      left: 50%;
      right: auto;
      bottom: 24px;
      width: 440px;
      transform: translateX(-50%);
      border-radius: 20px;
      border: 1px solid rgba(var(--c-accent), 0.25);
    }
  }

  @keyframes sheet-up {
    from { transform: translateY(30px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  @media (min-width: 640px) {
    @keyframes sheet-up {
      from { transform: translateX(-50%) translateY(30px); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
    }
  }

  .sheet-handle {
    width: 36px; height: 4px;
    background: rgba(var(--c-fg), 0.15);
    border-radius: 2px;
    margin: 10px auto 0;
  }

  .sheet-body { padding: 16px 0 8px; }

  /* ── Identity card ── */
  .identity-card {
    position: relative;
    margin: 0 14px;
    padding: 18px 16px 20px;
    background: linear-gradient(160deg, rgba(var(--c-edge-d), 0.18) 0%, rgba(var(--c-edge-d), 0.06) 100%);
    border: 1px solid rgba(var(--c-accent), 0.18);
    border-radius: 16px;
    transition: border-color 0.15s;
  }
  .identity-card.editing {
    border-color: rgba(var(--c-accent), 0.45);
  }

  .id-avatar {
    width: 60px; height: 60px;
    border-radius: 50%;
    background: rgba(var(--c-accent), 0.10);
    border: 1.5px solid rgba(var(--c-accent), 0.45);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 600;
    color: var(--c-accent-solid);
    margin-bottom: 14px;
  }

  .id-edit-btn {
    position: absolute;
    top: 14px; right: 14px;
    display: flex; align-items: center; gap: 5px;
    background: rgba(var(--c-accent), 0.08);
    border: 1px solid rgba(var(--c-accent), 0.25);
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 12px;
    color: var(--c-accent-solid);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s;
  }
  .id-edit-btn:active { background: rgba(var(--c-accent), 0.16); }

  .id-name {
    font-size: 22px; font-weight: 600;
    color: var(--h-e0ecff);
    letter-spacing: -0.01em;
    margin-bottom: 4px;
  }

  .id-email {
    font-size: 13px;
    color: rgba(var(--c-fg), 0.35);
    margin-bottom: 0;
  }

  .id-status {
    margin-top: 12px;
    display: flex; align-items: center; gap: 6px;
    font-size: 12px;
    color: rgba(79, 192, 141, 0.8);
  }

  .id-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--h-4fc08d);
    flex-shrink: 0;
  }

  /* Edit state */
  .id-name-label {
    font-size: 10px;
    color: rgba(var(--c-accent), 0.60);
    letter-spacing: 0.08em;
    margin-bottom: 6px;
    font-weight: 600;
  }

  .id-name-input {
    width: 100%;
    background: rgba(13, 26, 52, 0.85);
    border: 1px solid rgba(var(--c-accent), 0.50);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 17px;
    font-weight: 500;
    color: var(--h-e0ecff);
    outline: none;
    margin-bottom: 10px;
    box-sizing: border-box;
    caret-color: var(--c-accent-solid);
  }
  .id-name-input::placeholder { color: rgba(var(--c-fg), 0.25); font-weight: 400; }

  .id-btn-row {
    display: flex; gap: 8px;
    margin-top: 14px;
  }

  .id-btn-cancel, .id-btn-save {
    flex: 1;
    padding: 8px 0;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.1s;
  }
  .id-btn-cancel:active, .id-btn-save:active { opacity: 0.7; }

  .id-btn-cancel {
    background: transparent;
    border: 1px solid rgba(var(--c-fg), 0.12);
    color: rgba(var(--c-fg), 0.45);
  }

  .id-btn-save {
    background: rgba(var(--c-accent), 0.15);
    border: 1px solid rgba(var(--c-accent), 0.40);
    color: var(--c-accent-solid);
  }

  .section-gap { height: 12px; }

  .divider { height: 1px; background: rgba(var(--c-fg), 0.07); margin: 4px 0; }

  /* Action rows */
  .action-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s;
    text-align: left;
  }

  .action-row:active:not(:disabled) { background: rgba(var(--c-fg), 0.05); }
  .action-row:disabled { opacity: 0.5; }

  .action-icon { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; }

  .action-text { flex: 1 1 0; display: flex; flex-direction: column; gap: 2px; min-width: 0; }

  .action-label { font-size: 15px; font-weight: 700; color: rgba(var(--c-fg), 0.85); }
  .action-label.danger-lbl { color: var(--h-ff6b6b); }

  .action-sub { font-size: 12px; color: rgba(var(--c-fg), 0.35); }

  .action-arrow { font-size: 18px; color: rgba(var(--c-fg), 0.25); flex-shrink: 0; }

  .action-row.danger .action-arrow { color: var(--c-255-100-100-0_50); }

  .action-row.signout .action-label { color: rgba(var(--c-fg), 0.55); }

  /* Toggle switch */
  .switch {
    flex-shrink: 0;
    width: 44px; height: 26px;
    border-radius: 13px;
    background: rgba(var(--c-fg), 0.12);
    border: 1px solid rgba(var(--c-fg), 0.14);
    position: relative;
    transition: background 0.15s, border-color 0.15s;
  }
  .switch.on {
    background: rgba(var(--c-accent), 0.45);
    border-color: rgba(var(--c-accent), 0.55);
  }
  .knob {
    position: absolute;
    top: 2px; left: 2px;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--c-text);
    transition: transform 0.15s;
  }
  .switch.on .knob {
    transform: translateX(18px);
    background: var(--c-accent-solid);
  }

  /* Backup arrow rotation */
  .backup-arrow-open {
    display: inline-block;
    transform: rotate(90deg);
    transition: transform 0.15s;
  }

  /* Backup panel */
  .backup-panel {
    margin: 0 16px 4px;
    border: 1px solid rgba(var(--c-accent), 0.12);
    border-radius: 12px;
    overflow: hidden;
  }

  .backup-empty {
    padding: 14px 16px;
    font-size: 13px;
    color: rgba(var(--c-fg), 0.35);
    text-align: center;
  }

  .backup-row {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    background: transparent;
    border: none;
    border-top: 1px solid rgba(var(--c-fg), 0.06);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s;
    text-align: left;
    gap: 10px;
  }
  .backup-row:first-child { border-top: none; }
  .backup-row:active { background: rgba(var(--c-fg), 0.05); }
  .backup-row.backup-confirm { background: rgba(var(--c-accent), 0.07); }

  .backup-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 0;
    min-width: 0;
  }

  .backup-time {
    font-size: 13px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.75);
    white-space: nowrap;
  }

  .backup-reason {
    font-size: 11px;
    color: rgba(var(--c-fg), 0.35);
    background: rgba(var(--c-fg), 0.06);
    border-radius: 4px;
    padding: 1px 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .backup-cta {
    font-size: 12px;
    font-weight: 600;
    color: var(--c-accent-solid);
    flex-shrink: 0;
  }
  .backup-confirm .backup-cta { color: var(--h-ff6b6b); }
</style>
