<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser, showToast } from '../stores/app';
  import ChatView from './ChatView.svelte';
  import {
    listIncomingInvites, getMyCoach, acceptInvite, revokeMyCoach, listUnreadCounts,
    type IncomingInvite, type MyCoach,
  } from '../services/coach';

  let loading = true;
  let invites: IncomingInvite[] = [];
  let coach: MyCoach | null = null;
  let busy = false;
  let confirmRevoke = false;
  let showChat = false;
  let unreadCount = 0;

  async function refresh() {
    const u = $currentUser;
    if (!u) return;
    loading = true;
    try {
      [invites, coach] = await Promise.all([listIncomingInvites(), getMyCoach(u.id)]);
      if (coach) {
        try { const counts = await listUnreadCounts(u.id); unreadCount = counts[coach.linkId] ?? 0; }
        catch { /* badge is optional */ }
      }
    } catch {
      // Silent — coaching is an optional layer; never disrupt the account sheet.
    } finally {
      loading = false;
    }
  }

  async function accept(id: string) {
    busy = true;
    try {
      await acceptInvite(id);
      showToast('Coach connected', 'success');
      await refresh();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not accept', 'error');
    } finally {
      busy = false;
    }
  }

  async function revoke() {
    if (!coach) return;
    if (!confirmRevoke) { confirmRevoke = true; return; }
    confirmRevoke = false;
    busy = true;
    try {
      await revokeMyCoach(coach.linkId);
      showToast('Coach access removed', 'info');
      await refresh();
    } catch {
      showToast('Could not revoke', 'error');
    } finally {
      busy = false;
    }
  }

  function openChat() { unreadCount = 0; showChat = true; }
  function closeChat() { showChat = false; }

  onMount(refresh);
</script>

{#if !loading && (coach || invites.length > 0)}
  <div class="coach-sec">
    <span class="sec-label">Coaching</span>

    {#if coach}
      <div class="coach-line">
        <div class="coach-info">
          <span class="coach-name">{coach.coachEmail ?? 'Your coach'}</span>
          <span class="coach-sub">Can view your training (read-only)</span>
        </div>
        <button class="sec-btn danger" class:confirm={confirmRevoke} on:click={revoke} disabled={busy}>
          {confirmRevoke ? 'Confirm' : 'Revoke'}
        </button>
      </div>
      <button class="coach-chat-row" on:click={openChat}>
        <span class="ccr-icon">💬</span>
        <span class="ccr-text">Message your coach</span>
        {#if unreadCount > 0}<span class="ccr-badge">{unreadCount}</span>{/if}
        <span class="ccr-arrow">›</span>
      </button>
    {/if}

    {#each invites as inv (inv.id)}
      <div class="coach-line">
        <div class="coach-info">
          <span class="coach-name">{inv.coachEmail ?? 'A coach'} invited you</span>
          <span class="coach-sub">Accept to let them view your logged training</span>
        </div>
        <button class="sec-btn accept" on:click={() => accept(inv.id)} disabled={busy}>Accept</button>
      </div>
    {/each}
  </div>
{/if}


{#if showChat && coach}
  <div class="coach-chat-overlay">
    <ChatView
      linkId={coach.linkId}
      myUserId={$currentUser?.id ?? ''}
      peerName={coach.coachEmail ?? 'Your coach'}
      onClose={closeChat}
    />
  </div>
{/if}

<style>
  .coach-sec { padding: 6px 20px 10px; display: grid; gap: 8px; }
  .sec-label {
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    color: rgba(var(--c-fg), 0.35);
  }
  .coach-line {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 12px;
    border: 1px solid rgba(var(--c-edge-b), 0.16);
    background: rgba(var(--c-surface-b), 0.45);
  }
  .coach-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
  .coach-name {
    font-size: 14px; font-weight: 800; color: var(--h-e0ecff, #e0ecff);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .coach-sub { font-size: 11.5px; color: rgba(var(--c-fg), 0.42); }
  .sec-btn {
    flex: 0 0 auto; padding: 8px 14px; border-radius: 10px;
    font-size: 13px; font-weight: 800; cursor: pointer; border: 1px solid transparent;
    -webkit-tap-highlight-color: transparent;
  }
  .sec-btn:disabled { opacity: 0.5; }
  .sec-btn.accept {
    border-color: rgba(var(--c-accent), 0.50);
    background: rgba(var(--c-accent), 0.16);
    color: var(--c-accent-solid);
  }
  .sec-btn.danger {
    border-color: rgba(var(--c-fg), 0.12);
    background: transparent; color: rgba(var(--c-fg), 0.55);
  }
  .sec-btn.danger.confirm { background: var(--c-255-80-80-0_12); color: var(--h-ff6060); border-color: var(--c-255-80-80-0_25); }
  .coach-chat-row {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 12px; border-radius: 12px;
    border: 1px solid rgba(var(--c-accent), 0.30);
    background: rgba(var(--c-accent), 0.10);
    cursor: pointer; -webkit-tap-highlight-color: transparent;
    text-align: left; width: 100%;
  }
  .coach-chat-row:active { background: rgba(var(--c-accent), 0.18); }
  .ccr-icon { font-size: 16px; flex: 0 0 auto; }
  .ccr-text { flex: 1 1 auto; font-size: 14px; font-weight: 800; color: var(--c-accent-solid); }
  .ccr-badge {
    flex: 0 0 auto; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--h-ff6060, #ff6060); color: #fff; font-size: 11px; font-weight: 900; line-height: 1;
  }
  .ccr-arrow { flex: 0 0 auto; font-size: 18px; color: rgba(var(--c-accent), 0.55); }
  .coach-chat-overlay {
    position: fixed; inset: 0; z-index: 210;
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, var(--c-bg-1) 0%, var(--h-080c18) 100%);
  }
  @media (min-width: 640px) {
    .coach-chat-overlay { left: 50%; transform: translateX(-50%); width: 440px; right: auto; }
  }

</style>
