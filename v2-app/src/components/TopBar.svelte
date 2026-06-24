<script lang="ts">
  import type { SyncStatus } from '../stores/app';
  // Presentational top bar: title, cloud-sync indicator, quick-guide / search /
  // account actions. Parent owns the state behind the actions.
  export let syncStatus: SyncStatus;
  export let onGuide: () => void;
  export let onSearch: () => void;
  export let onAccount: () => void;
  /** Show a dot on the account icon when a coach invite is awaiting the user. */
  export let hasInvite = false;
  /** Show a chat button when the trainee has an accepted coach. */
  export let hasCoach = false;
  /** Callback when the chat button is tapped. */
  export let onChat: () => void = () => {};
  /** Unread coach messages — shown as a count badge on the chat button. */
  export let unreadMessages = 0;
</script>

<header class="topbar">
  <span class="title-text">Timo Training</span>
  <div class="topbar-actions">
    {#if syncStatus === 'saving'}
      <span class="sync-dot saving" title="Saving…" aria-label="Saving"></span>
    {:else if syncStatus === 'saved'}
      <span class="sync-dot saved" title="Saved" aria-label="Saved"></span>
    {:else if syncStatus === 'error'}
      <span class="sync-dot error" title="Sync failed" aria-label="Sync failed"></span>
    {/if}

    {#if hasCoach}
      <button class="icon-btn chat-btn" on:click={onChat} title="Coach chat" aria-label="Coach chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {#if unreadMessages > 0}
          <span class="unread-badge" aria-hidden="true">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
        {/if}
      </button>
    {/if}

    <button class="icon-btn" on:click={onGuide} title="Quick guide" aria-label="Quick guide">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <circle cx="12" cy="17" r=".5" fill="currentColor"/>
      </svg>
    </button>
    <button class="icon-btn" on:click={onSearch} title="Search exercises" aria-label="Search exercises">
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="9" cy="9" r="6"/>
        <line x1="14.2" y1="14.2" x2="18" y2="18"/>
      </svg>
    </button>
    <button
      class="icon-btn account-btn"
      on:click={onAccount}
      title={hasInvite ? 'Account — coach invite waiting' : 'Account'}
      aria-label={hasInvite ? 'Account, coach invite waiting' : 'Account'}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
      {#if hasInvite}
        <span class="invite-badge" aria-hidden="true"></span>
      {/if}
    </button>
  </div>
</header>

<style>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 18px;
  padding-top: calc(11px + env(safe-area-inset-top));
  border-bottom: 1px solid rgba(var(--c-edge-b), 0.16);
  position: sticky;
  top: 0;
  background: var(--c-7-9-18-0_92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 10;
  overflow: hidden;
}

.topbar::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, rgba(var(--c-accent), 0.45) 15%, var(--c-accent-solid) 50%, rgba(var(--c-accent), 0.45) 85%, transparent 100%);
}

.title-text {
  font-size: 17px;
  font-weight: 900;
  color: var(--h-d4a038);
  letter-spacing: -0.03em;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Variant C: tinted circles, no border */
.icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: rgba(var(--c-fg), 0.07);
  color: rgba(var(--c-fg), 0.42);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  flex-shrink: 0;
}

.icon-btn:active {
  background: rgba(var(--c-fg), 0.14);
  color: rgba(var(--c-fg), 0.75);
}

/* Chat button: gold tint to give it visual priority */
.chat-btn {
  background: rgba(var(--c-accent), 0.13);
  color: rgba(var(--c-accent-solid), 0.85);
}

.chat-btn:active {
  background: rgba(var(--c-accent), 0.22);
  color: var(--c-accent-solid);
}

.account-btn { position: relative; }

.invite-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c-accent-solid);
  border: 2px solid var(--c-bg-1, #0a0e1a);
  box-shadow: 0 0 0 1px rgba(var(--c-accent), 0.35);
}

.unread-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-accent-solid);
  color: var(--h-0c0c0e, #0c0c0e);
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  border: 2px solid var(--c-bg-1, #0a0e1a);
  box-shadow: 0 0 0 1px rgba(var(--c-accent), 0.35);
}

.sync-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  align-self: center;
}

.sync-dot.saving {
  background: rgba(var(--c-accent), 0.80);
  animation: sync-pulse 0.8s ease-in-out infinite;
}

.sync-dot.saved { background: var(--h-4fc08d); }
.sync-dot.error { background: var(--h-ff6060); }

@keyframes sync-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

@media (min-width: 640px) {
  .title-text { font-size: 22px; }
  .icon-btn { width: 44px; height: 44px; }
}
</style>
