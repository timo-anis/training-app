<script lang="ts">
  // Shared chat panel (Track 4). ONE component for BOTH surfaces (coach.html and
  // the trainee PWA). Two-way; the store owns realtime + optimistic send.
  import { onMount, onDestroy, tick } from 'svelte';
  import {
    chatMessages, chatUnread, setChatContext, clearChat, loadChat, sendChat, markChatRead,
  } from '../stores/messages';
  import { isMine, groupMessagesByDay } from '../lib/messages';
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

  $: initial = (peerName.trim()[0] ?? '?').toUpperCase();
  $: groups = groupMessagesByDay($chatMessages);

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function autosize() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
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
    await tick();
    autosize();
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // "Seen" only under the LAST of my messages, once the peer has read it.
  $: lastMineReadId = (() => {
    let id = '';
    $chatMessages.forEach((m) => { if (isMine(m, myUserId) && m.readAt) id = m.id; });
    return id;
  })();
</script>

<div class="chat">
  <div class="chat-head">
    {#if onClose}
      <button class="chat-back" on:click={onClose} aria-label="Close chat">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
    {/if}
    <div class="chat-avatar" aria-hidden="true">{initial}</div>
    <div class="chat-title">
      <span class="chat-peer">{peerName}</span>
      <span class="chat-sub">Direct messages · stays in the app</span>
    </div>
  </div>

  <div class="chat-scroll" bind:this={scrollEl}>
    {#if loading}
      <div class="chat-empty"><span class="ce-sub">Loading…</span></div>
    {:else if $chatMessages.length === 0}
      <div class="chat-empty">
        <div class="ce-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        </div>
        <span class="ce-title">No messages yet</span>
        <span class="ce-sub">Say hello — this thread is just between the two of you.</span>
      </div>
    {:else}
      {#each groups as group (group.label + group.items[0].id)}
        <div class="day-sep"><span>{group.label}</span></div>
        {#each group.items as m (m.id)}
          <div class="bubble-row" class:mine={isMine(m, myUserId)}>
            <div class="bubble" class:mine={isMine(m, myUserId)} class:pending={m.id.startsWith('pending-')}>
              <span class="b-body">{m.body}</span>
              <span class="b-time">{fmtTime(m.createdAt)}</span>
            </div>
            {#if isMine(m, myUserId) && m.id === lastMineReadId}
              <span class="b-seen">Seen</span>
            {/if}
          </div>
        {/each}
      {/each}
    {/if}
  </div>

  <div class="chat-composer">
    <textarea
      class="chat-input"
      bind:this={inputEl}
      bind:value={draft}
      on:keydown={onKeydown}
      on:input={autosize}
      placeholder={`Message ${peerName}…`}
      rows="1"
      maxlength="4000"
    ></textarea>
    <button class="chat-send" on:click={send} disabled={!draft.trim() || sending} aria-label="Send message">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
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
    display: flex; align-items: center; gap: 11px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--c-edge-b), 0.14);
    background: rgba(var(--c-bg-1), 0.55);
  }
  .chat-back {
    flex: 0 0 auto; width: 36px; height: 36px; border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: rgba(var(--c-surface-b), 0.55);
    color: rgba(var(--c-fg), 0.70); cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: background 0.12s;
  }
  .chat-back:active { background: rgba(var(--c-surface-b), 0.85); }
  .chat-avatar {
    flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(var(--c-accent), 0.18);
    border: 1px solid rgba(var(--c-accent), 0.40);
    color: var(--c-accent-solid); font-size: 16px; font-weight: 900;
  }
  .chat-title { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .chat-peer {
    font-size: 16px; font-weight: 900; color: var(--c-text); letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chat-sub { font-size: 11.5px; color: rgba(var(--c-fg), 0.42); font-weight: 600; }

  .chat-scroll {
    flex: 1 1 0; min-height: 0; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 16px 14px; display: flex; flex-direction: column; gap: 4px;
    scroll-behavior: smooth;
  }

  .chat-empty {
    margin: auto; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px;
    color: rgba(var(--c-fg), 0.45);
  }
  .ce-icon {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(var(--c-accent), 0.10);
    border: 1px solid rgba(var(--c-accent), 0.24);
    color: var(--c-accent-solid); margin-bottom: 2px;
  }
  .ce-title { font-size: 15px; font-weight: 800; color: rgba(var(--c-fg), 0.55); }
  .ce-sub { font-size: 12.5px; line-height: 1.5; max-width: 240px; }

  .day-sep {
    align-self: center; margin: 12px 0 6px;
  }
  .day-sep span {
    display: inline-block; padding: 3px 11px; border-radius: 999px;
    font-size: 11px; font-weight: 800; letter-spacing: 0.02em;
    color: rgba(var(--c-fg), 0.45);
    background: rgba(var(--c-fg), 0.06);
    border: 1px solid rgba(var(--c-fg), 0.06);
  }

  .bubble-row {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    animation: bubble-in 0.18s ease;
  }
  .bubble-row.mine { align-items: flex-end; }
  @keyframes bubble-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .bubble {
    max-width: 82%;
    padding: 9px 13px 7px;
    border-radius: 20px 20px 20px 6px;
    background: rgba(var(--c-surface-b), 0.70);
    border: 1px solid rgba(var(--c-edge-b), 0.14);
    display: flex; flex-direction: column; gap: 2px;
    box-shadow: 0 1px 2px rgba(var(--c-shadow), 0.12);
  }
  .bubble.mine {
    border-radius: 20px 20px 6px 20px;
    background: linear-gradient(135deg, rgba(var(--c-accent), 0.26) 0%, rgba(var(--c-accent), 0.16) 100%);
    border-color: rgba(var(--c-accent), 0.40);
  }
  .bubble.pending { opacity: 0.55; }

  .b-body {
    font-size: 15px; font-weight: 500; line-height: 1.45;
    color: rgba(var(--c-fg), 0.92);
    white-space: pre-wrap; word-break: break-word;
  }
  .b-time {
    align-self: flex-end;
    font-size: 10px; font-weight: 600; color: rgba(var(--c-fg), 0.40);
    font-variant-numeric: tabular-nums; margin-top: 1px;
  }
  .b-seen { font-size: 10.5px; font-weight: 700; color: var(--c-accent-solid); padding: 1px 6px 0; }

  .chat-composer {
    flex: 0 0 auto;
    display: flex; align-items: flex-end; gap: 9px;
    padding: 10px 12px;
    padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
    border-top: 1px solid rgba(var(--c-edge-b), 0.14);
    background: rgba(var(--c-bg-1), 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .chat-input {
    flex: 1 1 auto; min-width: 0;
    background: rgba(var(--c-surface-c), 0.70);
    border: 1px solid rgba(var(--c-edge-d), 0.20);
    border-radius: 20px; padding: 11px 15px;
    font-size: 16px; font-weight: 500; color: var(--h-e8f2ff, #e8f2ff);
    font-family: inherit; line-height: 1.4; resize: none; outline: none;
    max-height: 120px; transition: border-color 0.12s;
  }
  .chat-input:focus { border-color: rgba(var(--c-accent), 0.50); }
  .chat-input::placeholder { color: rgba(var(--c-fg), 0.30); }

  .chat-send {
    flex: 0 0 auto; width: 44px; height: 44px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: none; cursor: pointer;
    background: var(--c-accent-solid); color: var(--h-0c0c0e, #0c0c0e);
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.1s, opacity 0.12s, box-shadow 0.12s;
    box-shadow: 0 2px 12px rgba(var(--c-accent), 0.30);
  }
  .chat-send:disabled {
    opacity: 0.4; cursor: not-allowed; box-shadow: none;
    background: rgba(var(--c-fg), 0.20); color: rgba(var(--c-fg), 0.50);
  }
  .chat-send:not(:disabled):active { transform: scale(0.92); }
</style>
