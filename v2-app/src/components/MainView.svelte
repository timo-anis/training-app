<script lang="ts">
  import { currentUser } from '../stores/app';
  import { signOut } from '../services/auth';
</script>

<div class="main">
  <header>
    <h1>Timo Training <span class="v2-badge">V2</span></h1>
    <button on:click={signOut}>Sign out</button>
  </header>
  <p class="user">Signed in as {$currentUser?.email}</p>
  <p class="placeholder">🚧 Workout view coming next</p>
</div>

<style>
  .main {
    min-height: 100dvh;
    background: #08172d;
    color: #f0f6ff;
    padding: 24px 20px;
    max-width: 640px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  h1 { margin: 0; font-size: 20px; }
  .v2-badge {
    font-size: 11px;
    font-weight: 800;
    color: #ffc247;
    background: rgba(255,194,71,0.12);
    border: 1px solid rgba(255,194,71,0.25);
    border-radius: 6px;
    padding: 2px 6px;
    margin-left: 8px;
    vertical-align: middle;
  }
  button {
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    background: transparent;
    color: #97b8d8;
    font-size: 13px;
    cursor: pointer;
  }
  .user { color: #7fa8d4; font-size: 13px; margin: 0 0 32px; }
  .placeholder { color: #4a6a8a; font-size: 15px; }
</style>
