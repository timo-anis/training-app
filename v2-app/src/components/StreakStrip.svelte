<script lang="ts">
  import { streakInfo } from '../stores/app';

  // Persistent weekly-streak / consistency surface.
  // Pure presentational read of the shared `streakInfo` derived store.
  $: info = $streakInfo;
  $: hasStreak = info.count >= 1;
  $: line1 = hasStreak ? `${info.count}-week streak` : 'Start a streak';
  $: line2 = !hasStreak
    ? 'Log a workout this week to begin'
    : info.thisWeekActive
      ? 'This week secured — keep it going'
      : 'Train this week to keep it alive';
</script>

<div class="streak-strip" class:dormant={!hasStreak} class:risk={hasStreak && !info.thisWeekActive}>
  <div class="flame-box" aria-hidden="true">
    <span class="flame">🔥</span>
  </div>
  <div class="streak-text">
    <span class="streak-line1">{line1}</span>
    <span class="streak-line2">{line2}</span>
  </div>
  <div class="streak-dots" aria-hidden="true">
    {#each info.recent as on}
      <span class="dot" class:on></span>
    {/each}
  </div>
</div>

<style>
  .streak-strip {
    display: flex;
    align-items: center;
    gap: 13px;
    border: 1px solid rgba(var(--c-accent), 0.28);
    background: rgba(var(--c-accent), 0.10);
    border-radius: 16px;
    padding: 12px 14px;
  }
  .streak-strip.dormant {
    border-color: rgba(var(--c-edge-c), 0.18);
    background: rgba(var(--c-edge-c), 0.06);
  }

  .flame-box {
    width: 40px;
    height: 40px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 21px;
    background: rgba(var(--c-accent), 0.16);
    flex-shrink: 0;
  }
  .dormant .flame-box { background: rgba(var(--c-edge-c), 0.10); }
  .flame { display: inline-block; animation: flick 2.4s ease-in-out infinite; }
  .dormant .flame { filter: grayscale(1) opacity(0.5); animation: none; }

  @keyframes flick {
    0%, 100% { transform: scale(1);    opacity: 0.92; }
    50%      { transform: scale(1.12); opacity: 1; }
  }

  .streak-text { flex: 1; min-width: 0; }
  .streak-line1 {
    display: block;
    font-size: 15px;
    font-weight: 800;
    color: var(--c-accent-solid);
    letter-spacing: -0.02em;
  }
  .dormant .streak-line1 { color: rgba(var(--c-fg), 0.82); }
  .streak-line2 {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--h-4fc08d);
    margin-top: 2px;
  }
  .risk .streak-line2 { color: var(--h-d4a038); }
  .dormant .streak-line2 { color: rgba(var(--c-fg), 0.5); }

  .streak-dots { display: flex; gap: 5px; flex-shrink: 0; }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid rgba(var(--c-accent), 0.35);
  }
  .dot.on {
    background: var(--c-accent-solid);
    border-color: var(--c-accent-solid);
  }
</style>
