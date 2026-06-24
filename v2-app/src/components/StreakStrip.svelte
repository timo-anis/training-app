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
    <svg class="flame" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  </div>
  <div class="streak-text">
    <span class="streak-line1">{line1}</span>
    <span class="streak-line2">{line2}</span>
  </div>
  <div class="streak-meter" aria-hidden="true">
    {#each info.recent as on}
      <span class="seg" class:on></span>
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
    background: rgba(var(--c-accent), 0.16);
    flex-shrink: 0;
  }
  .dormant .flame-box { background: rgba(var(--c-edge-c), 0.10); }
  .flame {
    width: 21px;
    height: 21px;
    color: var(--c-accent-solid);
    display: block;
    animation: flick 2.4s ease-in-out infinite;
  }
  .dormant .flame { color: rgba(var(--c-fg), 0.42); animation: none; }

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
    font-variant-numeric: tabular-nums;
  }
  .dormant .streak-line1 { color: rgba(var(--c-fg), 0.82); }
  .streak-line2 {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--c-accent-solid);
    margin-top: 2px;
  }
  .risk .streak-line2 { color: var(--h-ffb84d); }
  .dormant .streak-line2 { color: rgba(var(--c-fg), 0.5); }

  .streak-meter { display: flex; gap: 4px; flex-shrink: 0; }
  .seg {
    width: 12px;
    height: 5px;
    border-radius: 3px;
    background: rgba(var(--c-accent), 0.14);
    border: 1px solid rgba(var(--c-accent), 0.30);
  }
  .seg.on {
    background: var(--c-accent-solid);
    border-color: var(--c-accent-solid);
  }
  .dormant .seg { border-color: rgba(var(--c-fg), 0.18); background: rgba(var(--c-fg), 0.05); }
</style>
