<script lang="ts">
  import { verifyBiometric, biometricSupported, type BioReason } from '../services/biometric';
  import { unlockOk, unlockFail } from '../stores/app';

  // userId to verify against; onFallback lets the user in via password (sign out).
  export let userId: string;
  export let onFallback: () => void;

  let busy = false;
  let message = '';

  const FAIL_MSG: Partial<Record<BioReason, string>> = {
    'cancelled': 'Cancelled — tap to try again',
    'no-credential': "This device isn't set up — use your password",
    'unsupported': "Face ID isn't available here — use your password",
    'error': 'Could not verify — try again',
  };

  async function unlock() {
    if (busy) return;
    busy = true;
    message = '';
    try {
      const reason = await verifyBiometric(userId);
      if (reason === 'ok') {
        unlockOk();
      } else {
        unlockFail();
        message = FAIL_MSG[reason] ?? 'Could not verify — try again';
      }
    } finally {
      busy = false;
    }
  }

  // No auto-trigger: WebAuthn requires a user gesture, so the first tap is the button.
  const supported = biometricSupported();
</script>

<div class="lock-screen" role="dialog" aria-modal="true" aria-label="App locked">
  <div class="lock-inner">
    <div class="lock-glyph" aria-hidden="true">
      <!-- Face ID style glyph -->
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 8V6a2 2 0 0 1 2-2h2"/>
        <path d="M16 4h2a2 2 0 0 1 2 2v2"/>
        <path d="M20 16v2a2 2 0 0 1-2 2h-2"/>
        <path d="M8 20H6a2 2 0 0 1-2-2v-2"/>
        <path d="M9 9v1"/><path d="M15 9v1"/>
        <path d="M12 8v4"/>
        <path d="M9 14.5s1 1.2 3 1.2 3-1.2 3-1.2"/>
      </svg>
    </div>

    <p class="lock-title">Locked</p>
    <p class="lock-sub">Unlock to continue your training</p>

    <button class="lock-unlock" on:click={unlock} disabled={busy || !supported}>
      {busy ? 'Verifying…' : 'Unlock with Face ID'}
    </button>

    {#if message}
      <p class="lock-msg" role="status">{message}</p>
    {/if}

    <button class="lock-fallback" on:click={onFallback} disabled={busy}>
      Use password instead
    </button>
  </div>
</div>

<style>
  .lock-screen {
    position: fixed;
    inset: 0;
    z-index: 1000; /* above workout mode + all sheets, below the error boundary (9999) */
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: radial-gradient(ellipse at 50% 0%, var(--c-bg-1) 0%, var(--c-bg-2) 52%, var(--c-bg-3) 100%);
    /* Fully opaque so nothing behind the lock is readable. */
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }

  .lock-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 340px;
    width: 100%;
  }

  .lock-glyph {
    width: 96px; height: 96px;
    border-radius: 28px;
    display: flex; align-items: center; justify-content: center;
    color: var(--c-accent-solid);
    background: rgba(var(--c-accent), 0.10);
    border: 1px solid rgba(var(--c-accent), 0.30);
    box-shadow: 0 8px 40px rgba(var(--c-accent), 0.14);
    margin-bottom: 22px;
  }

  .lock-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--h-e0ecff);
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .lock-sub {
    font-size: 14px;
    color: rgba(var(--c-fg), 0.45);
    margin: 0 0 28px;
  }

  .lock-unlock {
    width: 100%;
    padding: 17px;
    border-radius: 16px;
    border: none;
    background: var(--c-accent-solid);
    color: var(--h-0c0c0e);
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 0.02em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.1s, opacity 0.12s;
    box-shadow: 0 4px 28px rgba(var(--c-accent), 0.22);
  }
  .lock-unlock:active:not(:disabled) { transform: scale(0.98); }
  .lock-unlock:disabled { opacity: 0.55; cursor: default; }

  .lock-msg {
    font-size: 13px;
    color: rgba(var(--c-fg), 0.55);
    margin: 14px 0 0;
  }

  .lock-fallback {
    margin-top: 22px;
    padding: 10px 18px;
    background: transparent;
    border: none;
    color: rgba(var(--c-fg), 0.45);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .lock-fallback:active:not(:disabled) { color: rgba(var(--c-fg), 0.7); }
  .lock-fallback:disabled { opacity: 0.5; }
</style>
