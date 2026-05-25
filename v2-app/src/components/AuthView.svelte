<script lang="ts">
  import { signInWithEmail } from '../services/auth';

  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      await signInWithEmail(email, password);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Sign in failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-wrap">
  <div class="auth-card">
    <h1>Timo Training</h1>
    <p class="sub">Sign in to continue</p>

    <form on:submit|preventDefault={handleSubmit}>
      <label>
        Email
        <input type="email" bind:value={email} required autocomplete="email" />
      </label>
      <label>
        Password
        <input type="password" bind:value={password} required autocomplete="current-password" />
      </label>
      {#if error}
        <p class="error">{error}</p>
      {/if}
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  </div>
</div>

<style>
  .auth-wrap {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #08172d;
  }
  .auth-card {
    width: 100%;
    max-width: 380px;
    background: #0f1c30;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 32px 24px;
  }
  h1 { margin: 0 0 4px; font-size: 22px; color: #f0f6ff; }
  .sub { margin: 0 0 24px; color: #7fa8d4; font-size: 14px; }
  label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 13px; color: #97b8d8; }
  input {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.04);
    color: #f0f6ff;
    font-size: 15px;
  }
  input:focus { outline: none; border-color: rgba(127,178,255,0.45); }
  button {
    width: 100%;
    padding: 14px;
    margin-top: 8px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(180deg, #ffc247, #ff9f0a);
    color: #1a1204;
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
  }
  button:disabled { opacity: 0.6; cursor: not-allowed; }
  .error { color: #ff6b6b; font-size: 13px; margin: 8px 0; }
</style>
