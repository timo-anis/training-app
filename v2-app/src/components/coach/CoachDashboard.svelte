<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { User } from '@supabase/supabase-js';
  import { showToast } from '../../stores/app';
  import {
    listTrainees, listPendingInvites, inviteTrainee, cancelInvite, revokeLink,
    listUnreadCounts, subscribeToAllMessages, relativeAge, type TraineeRow, type PendingInvite,
  } from '../../services/coach';

  export let user: User | null = null;
  export let onOpenTrainee: (t: TraineeRow) => void = () => {};

  let loading = true;
  let trainees: TraineeRow[] = [];
  let pending: PendingInvite[] = [];
  let inviteEmail = '';
  let inviting = false;
  let now = Date.now();
  let confirmRevoke: string | null = null;
  let unreadMap: Record<string, number> = {};
  let unreadUnsub: (() => void) | null = null;

  async function refresh() {
    if (!user) return;
    loading = true;
    try {
      [trainees, pending] = await Promise.all([
        listTrainees(user.id),
        listPendingInvites(user.id),
      ]);
      now = Date.now();
      try { unreadMap = await listUnreadCounts(user.id); } catch { unreadMap = {}; }
    } catch (e) {
      showToast('Could not load trainees', 'error');
    } finally {
      loading = false;
    }
  }

  async function handleInvite() {
    if (!user) return;
    const email = inviteEmail.trim();
    if (!email) return;
    inviting = true;
    try {
      await inviteTrainee(user.id, user.email ?? '', email);
      inviteEmail = '';
      showToast('Invite sent', 'success');
      await refresh();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not send invite', 'error');
    } finally {
      inviting = false;
    }
  }

  async function handleCancel(id: string) {
    try { await cancelInvite(id); await refresh(); showToast('Invite cancelled', 'info'); }
    catch { showToast('Could not cancel invite', 'error'); }
  }

  async function handleRevoke(t: TraineeRow) {
    if (confirmRevoke !== t.linkId) { confirmRevoke = t.linkId; return; }
    confirmRevoke = null;
    try {
      await revokeLink(t.linkId);
      showToast(`Access to ${t.email} revoked`, 'info');
      await refresh();
    } catch { showToast('Could not revoke', 'error'); }
  }

  async function refreshUnread() {
    if (!user) return;
    try { unreadMap = await listUnreadCounts(user.id); } catch { /* optional */ }
  }

  onMount(() => {
    refresh();
    // Live: any message on any of the coach's links refreshes the badges.
    unreadUnsub = subscribeToAllMessages(
      { onInsert: refreshUnread, onUpdate: refreshUnread },
      'messages-dashboard'
    );
  });
  onDestroy(() => unreadUnsub?.());
</script>

<section class="dash">
  <!-- Invite -->
  <div class="card invite-card">
    <span class="card-title">Invite a trainee</span>
    <span class="card-sub">They accept via their own app — their training syncs here automatically.</span>
    <form class="invite-row" on:submit|preventDefault={handleInvite}>
      <input
        class="invite-input"
        type="email"
        inputmode="email"
        autocomplete="off"
        placeholder="trainee@email.com"
        bind:value={inviteEmail}
        disabled={inviting}
      />
      <button class="invite-btn" type="submit" disabled={inviting || !inviteEmail.trim()}>
        {inviting ? '…' : 'Invite'}
      </button>
    </form>
  </div>

  <!-- Pending invites -->
  {#if pending.length > 0}
    <div class="group">
      <span class="group-label">Pending invites</span>
      {#each pending as p (p.id)}
        <div class="row pending">
          <div class="row-main">
            <span class="row-name">{p.email}</span>
            <span class="row-meta">Waiting for them to accept · sent {relativeAge(p.createdAt, now)}</span>
          </div>
          <button class="row-action ghost" on:click={() => handleCancel(p.id)}>Cancel</button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Trainees -->
  <div class="group">
    <div class="group-head">
      <span class="group-label">Trainees{#if trainees.length} · {trainees.length}{/if}</span>
      <button class="refresh-btn" on:click={refresh} aria-label="Refresh" disabled={loading}>↻</button>
    </div>

    {#if loading}
      <div class="empty">Loading…</div>
    {:else if trainees.length === 0}
      <div class="empty">
        <span class="empty-title">No trainees yet</span>
        <span class="empty-sub">Invite someone above. Once they accept, you'll see their training here.</span>
      </div>
    {:else}
      {#each trainees as t (t.linkId)}
        <div class="row trainee">
          <button class="row-open" on:click={() => onOpenTrainee(t)}>
            <span class="dot" class:active={t.thisWeekActive} aria-hidden="true"></span>
            <span class="row-main">
              <span class="row-name">{t.email}</span>

            </span>
            {#if unreadMap[t.linkId] > 0}<span class="row-unread">{unreadMap[t.linkId]}</span>{/if}
            <span class="row-arrow">›</span>
          </button>
          <button
            class="row-action danger"
            class:confirm={confirmRevoke === t.linkId}
            on:click={() => handleRevoke(t)}
          >{confirmRevoke === t.linkId ? 'Confirm' : 'Revoke'}</button>
        </div>
      {/each}
    {/if}
  </div>

</section>

<style>
  .dash { padding: 16px 14px; display: grid; gap: 18px; box-sizing: border-box; width: 100%; overflow: hidden; }

  .card {
    border-radius: 16px;
    border: 1px solid rgba(var(--c-edge-b), 0.18);
    background: rgba(var(--c-surface-b), 0.55);
    padding: 16px 14px;
    display: grid; gap: 6px;
  }
  .card-title { font-size: 15px; font-weight: 900; color: var(--c-text); }
  .card-sub { font-size: 12.5px; color: rgba(var(--c-fg), 0.50); line-height: 1.5; }

  .invite-row { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .invite-input {
    flex: 1 1 auto; min-width: 0;
    background: rgba(var(--c-surface-c), 0.65);
    border: 1px solid rgba(var(--c-edge-d), 0.20);
    border-radius: 11px; padding: 11px 13px;
    font-size: 16px; font-weight: 600; color: var(--h-e8f2ff);
    outline: none; transition: border-color 0.12s;
  }
  .invite-input:focus { border-color: rgba(var(--c-accent), 0.45); }
  .invite-input::placeholder { color: rgba(var(--c-fg), 0.28); }
  .invite-btn {
    width: 100%; padding: 11px 12px; border-radius: 11px;
    border: 1px solid rgba(var(--c-accent), 0.50);
    background: rgba(var(--c-accent), 0.16);
    color: var(--c-accent-solid); font-size: 14px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .invite-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .invite-btn:not(:disabled):active { background: rgba(var(--c-accent), 0.26); }

  .group { display: grid; gap: 8px; }
  .group-head { display: flex; align-items: center; justify-content: space-between; }
  .group-label {
    font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    color: rgba(var(--c-fg), 0.42);
  }
  .refresh-btn {
    width: 30px; height: 30px; border-radius: 8px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: rgba(var(--c-surface-b), 0.55);
    color: rgba(var(--c-fg), 0.55); font-size: 15px; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .refresh-btn:disabled { opacity: 0.5; }

  .row {
    display: flex; align-items: stretch; gap: 8px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-edge-b), 0.16);
    background: rgba(var(--c-surface-b), 0.45);
    overflow: hidden;
  }
  .row.pending { padding: 12px 14px; align-items: center; }

  .row-open {
    flex: 1 1 auto; min-width: 0;
    display: flex; align-items: center; gap: 11px;
    padding: 13px 14px;
    background: transparent; border: none; cursor: pointer; text-align: left;
    -webkit-tap-highlight-color: transparent;
  }
  .row-open:active { background: rgba(var(--c-fg), 0.04); }

  .dot {
    flex: 0 0 auto; width: 9px; height: 9px; border-radius: 50%;
    border: 1.5px solid rgba(var(--c-fg), 0.30);
  }
  .dot.active { background: var(--c-accent-solid); border-color: var(--c-accent-solid); box-shadow: 0 0 0 3px rgba(var(--c-accent), 0.18); }

  .row-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 auto; }
  .row-name {
    font-size: 15px; font-weight: 800; color: var(--h-e8f2ff);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .row-arrow { flex: 0 0 auto; font-size: 18px; color: rgba(var(--c-fg), 0.28); }
  .row-unread {
    flex: 0 0 auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(var(--c-accent), 0.20); border: 1px solid rgba(var(--c-accent), 0.45);
    color: var(--c-accent-solid); font-size: 11px; font-weight: 900; line-height: 1;
  }

  .row-action {
    flex: 0 0 auto; padding: 0 10px; font-size: 12px; border: none; cursor: pointer;
    font-size: 12.5px; font-weight: 800;
    background: transparent; color: rgba(var(--c-fg), 0.45);
    border-left: 1px solid rgba(var(--c-fg), 0.07);
    -webkit-tap-highlight-color: transparent;
  }
  .row-action.ghost { color: rgba(var(--c-fg), 0.50); }
  .row-action.danger { color: var(--h-ff8585, #ff8585); }
  .row-action.danger.confirm { background: var(--c-255-80-80-0_12); color: var(--h-ff6060); }
  .row-action:active { background: rgba(var(--c-fg), 0.06); }

  .empty {
    border: 1px dashed rgba(var(--c-fg), 0.10);
    border-radius: 14px; padding: 28px 18px; text-align: center;
    display: flex; flex-direction: column; gap: 6px;
  }
  .empty-title { font-size: 15px; font-weight: 800; color: rgba(var(--c-fg), 0.40); }
  .empty-sub { font-size: 12.5px; color: rgba(var(--c-fg), 0.45); line-height: 1.5; }

</style>
