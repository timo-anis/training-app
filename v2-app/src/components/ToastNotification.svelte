<script lang="ts">
  import { toast } from '../stores/app';
</script>

{#if $toast}
  <div class="toast toast-{$toast.type}" role="alert" aria-live="assertive">
    {#if $toast.type === 'error'}
      <span class="toast-icon">⚠</span>
    {:else if $toast.type === 'success'}
      <span class="toast-icon">✓</span>
    {:else}
      <span class="toast-icon">ℹ</span>
    {/if}
    <span class="toast-msg">{$toast.msg}</span>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    top: max(16px, env(safe-area-inset-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    max-width: calc(100vw - 32px);
    white-space: normal;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    animation: toast-in 0.2s ease both;
    box-shadow: 0 4px 24px rgba(0,0,0,0.40);
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .toast-error {
    background: rgba(30, 8, 8, 0.92);
    border: 1px solid rgba(255, 80, 80, 0.35);
    color: #ff8080;
  }

  .toast-success {
    background: rgba(8, 28, 16, 0.92);
    border: 1px solid rgba(80, 200, 120, 0.35);
    color: #4fc08d;
  }

  .toast-info {
    background: rgba(10, 18, 40, 0.92);
    border: 1px solid rgba(196, 148, 46, 0.35);
    color: #c49230;
  }

  .toast-icon { font-size: 15px; flex-shrink: 0; }
  .toast-msg  { line-height: 1.4; }
</style>
