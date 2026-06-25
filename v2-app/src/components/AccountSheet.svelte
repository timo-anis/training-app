<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser, appState, updateState, showToast, theme, toggleTheme, canUsePresentation } from '../stores/app';
  import { displayName } from '../stores/ui-state';
  import { signOut, sendPasswordReset } from '../services/auth';
  import { setDisplayName } from '../services/profile';
  import { saveLocal, saveCloud } from '../services/storage';
  import { emptyAppState } from '../types/workout';
  import CoachInviteSection from './CoachInviteSection.svelte';
  import { getPushState, enablePush, disablePush, type PushReason } from '../services/push';

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
      saveLocal(user.id, empty);
      await saveCloud(user.id, empty);
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
</style>
