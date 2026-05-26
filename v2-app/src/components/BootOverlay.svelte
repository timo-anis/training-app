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
    background: radial-gradient(ellipse at 50% 0%, #0d1a2e 0%, #08090f 55%, #050508 100%);
    color: #7fa8d4;
    font-size: 14px;
  }
  .boot-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(127, 178, 255, 0.15);
    border-top-color: #7fb2ff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
