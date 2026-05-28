<script lang="ts">
  import { signInWithEmail, signUpWithEmail, sendPasswordReset } from '../services/auth';

  type Mode = 'signin' | 'signup' | 'reset';
  let mode: Mode = 'signin';

  let email = '';
  let password = '';
  let passwordConfirm = '';
  let error = '';
  let info = '';
  let loading = false;

  function switchMode(m: Mode) {
    mode = m;
    error = '';
    info = '';
    password = '';
    passwordConfirm = '';
  }

  async function handleSubmit() {
    error = '';
    info = '';

    if (mode === 'signup' && password !== passwordConfirm) {
      error = 'Passwords do not match';
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      error = 'Password must be at least 6 characters';
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
          info = 'Check your email to confirm your account, then sign in.';
          switchMode('signin');
        }
        // If no confirmation needed, onAuthChange fires automatically
      } else if (mode === 'reset') {
        await sendPasswordReset(email);
        info = 'Password reset email sent. Check your inbox.';
        email = '';
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Something went wrong';
    } finally {
      loading = false;
    }
  }

  $: title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';
  $: btnLabel = loading
    ? (mode === 'signup' ? 'Creating account…' : mode === 'reset' ? 'Sending…' : 'Signing in…')
    : (mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in');
</script>

<div class="auth-wrap">
  <div class="auth-card">
    <h1>Timo Training</h1>
    <p class="sub">{title}</p>

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
  </div>
</div>

<style>
  .auth-wrap {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: radial-gradient(ellipse at 50% 0%, #0d1a2e 0%, #08090f 55%, #050508 100%);
  }

  .auth-card {
    width: 100%;
    max-width: 380px;
    background: linear-gradient(160deg, #0d1a30, #080e1c);
    border: 1px solid rgba(65,100,170,0.16);
    border-radius: 20px;
    padding: 32px 24px;
  }

  h1 { margin: 0 0 4px; font-size: 22px; font-weight: 900; color: #f0f6ff; letter-spacing: -0.02em; }

  .sub { margin: 0 0 24px; color: #7fa8d4; font-size: 14px; font-weight: 500; }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    font-size: 13px;
    color: #97b8d8;
    font-weight: 600;
  }

  input {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(65,100,175,0.20);
    background: rgba(12,22,48,0.55);
    color: #f0f6ff;
    font-size: 15px;
    -webkit-tap-highlight-color: transparent;
  }
  input:focus { outline: none; border-color: rgba(127,178,255,0.45); }

  button[type="submit"] {
    width: 100%;
    padding: 14px;
    margin-top: 8px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(180deg, #c49230, #9e6818);
    color: #1a1204;
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.12s;
  }
  button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
  button[type="submit"]:active:not(:disabled) { opacity: 0.85; }

  .error { color: #ff6b6b; font-size: 13px; margin: 6px 0 8px; }
  .info  { color: #4fc08d; font-size: 13px; margin: 0 0 16px; line-height: 1.4; }

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
    color: #5a82c0;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 2px;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.12s;
  }
  .link-btn:hover { color: #7fa8d4; }

  .sep { color: rgba(255,255,255,0.20); font-size: 12px; }
</style>
