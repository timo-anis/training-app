<script lang="ts">
  // Shared chat panel (Track 4). ONE component for BOTH surfaces:
  //   - coach.html (coach messaging the open trainee)
  //   - the trainee PWA (trainee messaging their coach)
  // Two-way. The store owns realtime + optimistic send; this is just the view.
  import { onMount, onDestroy, tick } from 'svelte';
  import {
    chatMessages, chatUnread, setChatContext, clearChat, loadChat, sendChat, markChatRead,
  } from '../stores/messages';
  import { isMine } from '../lib/messages';
  import { showToast } from '../stores/app';

  export let linkId: string;
  export let myUserId: string;
  export let peerName = 'Coach';
  export let onClose: (() => void) | null = null;

  let loading = true;
  let draft = '';
  let sending = false;
  let scrollEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;
  let mounted = false;

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  onMount(async () => {
    mounted = true;
    setChatContext({ linkId, myUserId });
    try {
      await loadChat();
      await markChatRead();
    } catch {
      showToast('Could not load chat', 'error');
    } finally {
      loading = false;
      await scrollToBottom();
    }
  });

  onDestroy(() => { mounted = false; clearChat(); });

  // Autoscroll + mark-read as new messages arrive while the panel is open.
  let lastCount = 0;
  $: if (mounted && $chatMessages.length !== lastCount) {
    lastCount = $chatMessages.length;
    scrollToBottom();
    if ($chatUnread > 0) markChatRead();
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    sending = true;
    draft = '';
    try {
      await sendChat(body);
      await scrollToBottom();
    } catch {
      draft = body; // restore so the user doesn't lose their text
      showToast('Message not sent — try again', 'error');
    } finally {
      sending = false;
      inputEl?.focus();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    // Enter sends; Shift+Enter / mobile newline stays a newline.
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // "Seen" only under the LAST of my messages, and only once the peer read it.
  $: lastMineReadIdx = (() => {
    let idx = -1;
    $chatMessages.forEach((m, i) => { if (isMine(m, myUserId) && m.readAt) idx = i; });
    return idx;
  })();
</script>

<div class="chat">
  <div class="chat-head">
    {#if onClose}
      <button class="chat-back" on:click={onClose} aria-label="Close chat">‹</button>
    {/if}
    <div class="chat-title">
      <span class="chat-peer">{peerName}</span>
      <span class="chat-sub">Direct messages · stays in the app</span>
    </div>
  </div>

  <div class="chat-scroll" bind:this={scrollEl}>
    {#if loading}
      <div class="chat-empty">Loading…</div>
    {:else if $chatMessages.length === 0}
      <div class="chat-empty">
        <span class="ce-title">No messages yet</span>
        <span class="ce-sub">Say hello — this thread is just between the two of you.</span>
      </div>
    {:else}
      {#each $chatMessages as m, i (m.id)}
        <div class="bubble-row" class:mine={isMine(m, myUserId)}>
          <div class="bubble" class:mine={isMine(m, myUserId)} class:pending={m.id.startsWith('pending-')}>
            <span class="b-body">{m.body}</span>
            <span class="b-time">{fmtTime(m.createdAt)}</span>
          </div>
          {#if isMine(m, myUserId) && i === lastMineReadIdx}
            <span class="b-seen">Seen</span>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <div class="chat-composer">
    <textarea
      class="chat-input"
      bind:this={inputEl}
      bind:value={draft}
      on:keydown={onKeydown}
      placeholder={`Message ${peerName}…`}
      rows="1"
      maxlength="4000"
    ></textarea>
    <button class="chat-send" on:click={send} disabled={!draft.trim() || sending} aria-label="Send">
      {sending ? '…' : 'Send'}
    </button>
  </div>
</div>

<style>
  .chat {
    display: flex; flex-direction: column;
    height: 100%; min-height: 0;
    background: var(--c-app-bg, transparent);
  }

  .chat-head {
    flex: 0 0 auto;
    display: flex; align-items: center; gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(var(--c-edge-b), 0.16);
  }
  .chat-back {
    flex: 0 0 auto; width: 34px; height: 34px; border-radius: 9px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: rgba(var(--c-surface-b), 0.55);
    color: var(--c-text); font-size: 20px; line-height: 1; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .chat-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .chat-peer {
    font-size: 16px; font-weight: 900; color: var(--c-text); letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chat-sub { font-size: 11.5px; color: rgba(var(--c-fg), 0.42); font-weight: 600; }

  .chat-scroll {
    flex: 1 1 0; min-height: 0; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 14px; display: flex; flex-direction: column; gap: 8px;
  }

  .chat-empty {
    margin: auto; text-align: center;
    display: flex; flex-direction: column; gap: 6px; padding: 24px;
    color: rgba(var(--c-fg), 0.45);
  }
  .ce-title { font-size: 15px; font-weight: 800; color: rgba(var(--c-fg), 0.50); }
  .ce-sub { font-size: 12.5px; line-height: 1.5; }

  .bubble-row { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  .bubble-row.mine { align-items: flex-end; }

  .bubble {
    max-width: 80%;
    padding: 9px 12px; border-radius: 14px;
    border: 1px solid rgba(var(--c-edge-b), 0.16);
    background: rgba(var(--c-surface-b), 0.60);
    display: flex; flex-direction: column; gap: 3px;
  }
  .bubble.mine {
    background: rgba(var(--c-accent), 0.16);
    border-color: rgba(var(--c-accent), 0.34);
  }
  .bubble.pending { opacity: 0.6; }

  .b-body {
    font-size: 15px; font-weight: 500; line-height: 1.45;
    color: rgba(var(--c-fg), 0.88);
    white-space: pre-wrap; word-break: break-word;
  }
  .b-time {
    align-self: flex-end;
    font-size: 10.5px; font-weight: 600; color: rgba(var(--c-fg), 0.38);
    font-variant-numeric: tabular-nums;
  }
  .b-seen { font-size: 10.5px; font-weight: 700; color: var(--c-accent-solid); padding: 0 4px; }

  .chat-composer {
    flex: 0 0 auto;
    display: flex; align-items: flex-end; gap: 8px;
    padding: 10px 12px;
    padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
    border-top: 1px solid rgba(var(--c-edge-b), 0.16);
    background: rgba(var(--c-bg-1), 0.86);
  }
  .chat-input {
    flex: 1 1 auto; min-width: 0;
    background: rgba(var(--c-surface-c), 0.65);
    border: 1px solid rgba(var(--c-edge-d), 0.20);
    border-radius: 12px; padding: 11px 13px;
    font-size: 16px; font-weight: 500; color: var(--h-e8f2ff, #e8f2ff);
    font-family: inherit; line-height: 1.4; resize: none; outline: none;
    max-height: 120px;
  }
  .chat-input:focus { border-color: rgba(var(--c-accent), 0.45); }
  .chat-input::placeholder { color: rgba(var(--c-fg), 0.30); }

  .chat-send {
    flex: 0 0 auto; padding: 0 16px; height: 44px; border-radius: 12px;
    border: 1px solid rgba(var(--c-accent), 0.50);
    background: rgba(var(--c-accent), 0.16);
    color: var(--c-accent-solid); font-size: 14px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
  .chat-send:not(:disabled):active { background: rgba(var(--c-accent), 0.26); }
</style>
