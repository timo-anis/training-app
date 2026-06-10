<script lang="ts">
  import { signInWithEmail, signUpWithEmail, sendPasswordReset, resendConfirmation } from '../services/auth';

  type Mode = 'signin' | 'signup' | 'reset' | 'confirm';
  let mode: Mode = 'signin';

  let email = '';
  let password = '';
  let passwordConfirm = '';
  let error = '';
  let info = '';
  let loading = false;
  // Email address awaiting confirmation (shown on the 'confirm' screen)
  let pendingEmail = '';

  function switchMode(m: Mode) {
    mode = m;
    error = '';
    info = '';
    password = '';
    passwordConfirm = '';
  }

  function isUnconfirmedError(e: unknown): boolean {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    return msg.includes('not confirmed') || msg.includes('email not confirmed');
  }

  async function handleSubmit() {
    error = '';
    info = '';

    if (mode === 'signup' && password !== passwordConfirm) {
      error = 'Passwords do not match';
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    loading = true;
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        // onAuthChange in App.svelte handles the rest
      } else if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithEmail(email, password);
        if (needsConfirmation) {
          // Don't drop the user on the sign-in form — they can't sign in yet.
          // Show a dedicated "confirm your email" screen instead.
          pendingEmail = email;
          switchMode('confirm');
        }
        // If no confirmation needed, onAuthChange fires automatically
      } else if (mode === 'reset') {
        await sendPasswordReset(email);
        info = 'Password reset email sent. Check your inbox.';
        email = '';
      }
    } catch (e: unknown) {
      // Signing in before confirming email is the most common stumble —
      // route the user to the confirm screen instead of a raw error.
      if (mode === 'signin' && isUnconfirmedError(e)) {
        pendingEmail = email;
        switchMode('confirm');
      } else {
        error = e instanceof Error ? e.message : 'Something went wrong';
      }
    } finally {
      loading = false;
    }
  }

  async function handleResend() {
    error = '';
    info = '';
    loading = true;
    try {
      await resendConfirmation(pendingEmail);
      info = 'Confirmation email sent again. Check your inbox (and spam).';
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Could not resend — try again shortly.';
    } finally {
      loading = false;
    }
  }

  $: title = mode === 'signup' ? 'Create account'
    : mode === 'reset' ? 'Reset password'
    : mode === 'confirm' ? 'Confirm your email'
    : 'Sign in';
  $: btnLabel = loading
    ? (mode === 'signup' ? 'Creating account…' : mode === 'reset' ? 'Sending…' : 'Signing in…')
    : (mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in');
</script>

<div class="auth-wrap">
  <div class="auth-card">
    <h1>Timo Training</h1>
    <p class="sub">{title}</p>

    {#if mode === 'confirm'}
      <!-- Dedicated post-signup state: no active sign-in form here. -->
      <p class="confirm-lead">
        We sent a confirmation link to<br /><strong>{pendingEmail}</strong>.
      </p>
      <p class="confirm-steps">
        Open it to activate your account, then come back here and sign in.
      </p>

      {#if info}<p class="info">{info}</p>{/if}
      {#if error}<p class="error">{error}</p>{/if}

      <button type="button" class="secondary" on:click={handleResend} disabled={loading}>
        {loading ? 'Sending…' : 'Resend confirmation email'}
      </button>

      <div class="auth-links">
        <button class="link-btn" on:click={() => switchMode('signin')}>← Back to sign in</button>
      </div>
    {:else}
      {#if info}
        <p class="info">{info}</p>
      {/if}

      <form on:submit|preventDefault={handleSubmit}>
        <label>
          Email
          <input type="email" bind:value={email} required autocomplete="email" />
        </label>

        {#if mode !== 'reset'}
          <label>
            Password
            <input
              type="password"
              bind:value={password}
              required
              autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>
        {/if}

        {#if mode === 'signup'}
          <label>
            Confirm password
            <input type="password" bind:value={passwordConfirm} required autocomplete="new-password" />
          </label>
          <p class="pw-hint">At least 8 characters, with an uppercase &amp; lowercase letter, a number and a symbol.</p>
        {/if}

        {#if error}
          <p class="error">{error}</p>
        {/if}

        <button type="submit" disabled={loading}>{btnLabel}</button>
      </form>

      <div class="auth-links">
        {#if mode === 'signin'}
          <button class="link-btn" on:click={() => switchMode('signup')}>Create account</button>
          <span class="sep">·</span>
          <button class="link-btn" on:click={() => switchMode('reset')}>Forgot password?</button>
        {:else}
          <button class="link-btn" on:click={() => switchMode('signin')}>← Back to sign in</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .auth-wrap {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: radial-gradient(ellipse at 50% 0%, var(--c-bg-1) 0%, var(--c-bg-2) 55%, var(--c-bg-3) 100%);
  }

  .auth-card {
    width: 100%;
    max-width: 380px;
    background: linear-gradient(160deg, var(--h-0d1a30), var(--h-080e1c));
    border: 1px solid rgba(var(--c-edge-c), 0.16);
    border-radius: 20px;
    padding: 32px 24px;
  }

  h1 { margin: 0 0 4px; font-size: 22px; font-weight: 900; color: var(--h-f0f6ff); letter-spacing: -0.02em; }

  .sub { margin: 0 0 24px; color: var(--h-7fa8d4); font-size: 14px; font-weight: 500; }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    font-size: 13px;
    color: var(--h-97b8d8);
    font-weight: 600;
  }

  input {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(var(--c-edge-d), 0.20);
    background: var(--c-12-22-48-0_55);
    color: var(--h-f0f6ff);
    font-size: 16px;
    -webkit-tap-highlight-color: transparent;
  }
  input:focus { outline: none; border-color: var(--c-127-178-255-0_45); }

  button[type="submit"] {
    width: 100%;
    padding: 14px;
    margin-top: 8px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(180deg, var(--c-accent-solid), var(--h-9e6818));
    color: var(--h-1a1204);
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.12s;
  }
  button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
  button[type="submit"]:active:not(:disabled) { opacity: 0.85; }

  /* Secondary action (e.g. resend) — outlined, lower emphasis than primary CTA */
  button.secondary {
    width: 100%;
    padding: 13px;
    margin-top: 4px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-edge-d), 0.30);
    background: var(--c-12-22-48-0_55);
    color: var(--h-f0f6ff);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.12s;
  }
  button.secondary:disabled { opacity: 0.6; cursor: not-allowed; }
  button.secondary:active:not(:disabled) { opacity: 0.85; }

  .confirm-lead { margin: 0 0 10px; color: var(--h-f0f6ff); font-size: 15px; line-height: 1.5; }
  .confirm-lead strong { color: var(--c-accent-solid); }
  .confirm-steps { margin: 0 0 20px; color: var(--h-97b8d8); font-size: 13px; line-height: 1.5; }

  .error { color: var(--h-ff6b6b); font-size: 13px; margin: 6px 0 8px; }

  .pw-hint {
    margin: -4px 0 4px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--c-232-240-255-0_5);
  }
  .info  { color: var(--h-4fc08d); font-size: 13px; margin: 0 0 16px; line-height: 1.4; }

  .auth-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 20px;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--c-text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 2px;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.12s;
  }
  .link-btn:hover { color: var(--h-ffffff); }

  .sep { color: rgba(var(--c-fg), 0.20); font-size: 12px; }
</style>
