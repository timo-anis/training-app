<div class="boot-overlay">
  <div class="boot-spinner"></div>
  <p>Loading…</p>
</div>

<style>
  .boot-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: radial-gradient(ellipse at 50% 0%, var(--c-bg-1) 0%, var(--c-bg-2) 55%, var(--c-bg-3) 100%);
    color: var(--h-7fa8d4);
    font-size: 14px;
  }
  .boot-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--c-127-178-255-0_15);
    border-top-color: var(--h-7fb2ff);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
