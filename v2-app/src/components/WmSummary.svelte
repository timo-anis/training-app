<script lang="ts">
  import { onMount } from 'svelte';

  // Presentational workout-summary overlay. All values are pre-computed by the
  // parent; this component only renders, animates, and reports the Done tap.
  interface SummaryExercise {
    name: string;
    done: boolean;
    conditioning: boolean;
    recovery: boolean;
    setsDone: number;
    setsTotal: number;
  }

  export let durationSeconds: number;
  export let setsDone: number;
  export let volumeKg: number;
  export let weekDisplay: number;
  export let streak: number;
  export let volumeDelta: { pct: number; dir: 'up' | 'down'; label: string } | null = null;
  export let bestSet: string | null = null;
  export let prs: { name: string; oldKg: number; newKg: number }[] = [];
  export let next: { day: string; count: number; nextWeek: boolean } | null = null;
  export let exercises: SummaryExercise[];
  export let onDone: () => void;

  function fmtVolume(v: number): string {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
    return `${Math.round(v)}kg`;
  }

  function mmss(sec: number): string {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // -- Reveal animation --
  let dispDur = 0;
  let dispSets = 0;
  let dispVol = 0;
  let revealed = false; // fades in delta / PRs / best / next
  let sweepOn = false;  // triggers the gold sweep across PR rows
  let timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0;

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function finalState() {
    dispDur = durationSeconds;
    dispSets = setsDone;
    dispVol = volumeKg;
    revealed = true;
    sweepOn = true;
  }

  function animateCounts() {
    const start = performance.now();
    const dur = 800;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const e = ease(p);
      dispDur = durationSeconds * e;
      dispSets = setsDone * e;
      dispVol = volumeKg * e;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // Tap anywhere (except Done) jumps straight to the final state.
  function skip() {
    if (revealed && sweepOn) return;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    timers = [];
    finalState();
  }

  onMount(() => {
    if (reduceMotion) {
      finalState();
      return;
    }
    animateCounts();
    timers.push(setTimeout(() => (revealed = true), 700));
    timers.push(setTimeout(() => (sweepOn = true), 950));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  });
</script>

<div
  class="summary-overlay"
  role="presentation"
  on:click={skip}
  on:keydown={skip}
>
  <div class="summary-card">
    <!-- Header: week + streak -->
    <div class="summary-header">
      <span class="summary-icon">🏁</span>
      <span class="summary-title">Week {weekDisplay} done</span>
      {#if streak >= 2}
        <span class="streak-pill">
          <span class="flame">🔥</span>{streak}-week streak
        </span>
      {/if}
    </div>

    <!-- Core stats -->
    <div class="summary-stat-row">
      <div class="summary-stat">
        <span class="sstat-val">{mmss(dispDur)}</span>
        <span class="sstat-lbl">Duration</span>
      </div>
      <div class="summary-stat">
        <span class="sstat-val">{Math.round(dispSets)}</span>
        <span class="sstat-lbl">Sets done</span>
      </div>
      <div class="summary-stat">
        <span class="sstat-val">{fmtVolume(dispVol)}</span>
        <span class="sstat-lbl">Volume</span>
      </div>
    </div>

    <!-- Volume vs last session -->
    {#if volumeDelta}
      <div class="vol-delta reveal" class:in={revealed} class:down={volumeDelta.dir === 'down'}>
        <span class="vd-arrow">{volumeDelta.dir === 'up' ? '↑' : '↓'}</span>
        <span class="vd-main">{Math.abs(volumeDelta.pct)}% {volumeDelta.dir === 'up' ? 'more' : 'less'} volume</span>
        <span class="vd-sub">vs last session · {volumeDelta.label}</span>
      </div>
    {/if}

    <!-- Personal records -->
    {#if prs.length > 0}
      <div class="pr-block">
        <span class="block-lbl">Personal record{prs.length > 1 ? 's' : ''}</span>
        {#each prs as pr, i}
          <div
            class="pr-row reveal"
            class:in={revealed}
            class:go={sweepOn}
            style="transition-delay: {i * 90}ms"
          >
            <span class="pr-trophy">🏆</span>
            <span class="pr-name">{pr.name}</span>
            <span class="pr-vals">{pr.oldKg} <span class="pr-new">→ {pr.newKg}</span> kg</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Best set -->
    {#if bestSet}
      <div class="best-set reveal" class:in={revealed} style="transition-delay: 120ms">
        <span class="bs-star">⭐</span>
        <span class="bs-text">Best set — {bestSet}</span>
      </div>
    {/if}

    <!-- Exercise list -->
    <div class="summary-ex-list">
      {#each exercises as ex}
        <div class="summary-ex-row" class:sdone={ex.done}>
          <span class="sex-check">{ex.done ? '✓' : '○'}</span>
          <span class="sex-name">{ex.name}</span>
          {#if !ex.conditioning && !ex.recovery}
            <span class="sex-sets">{ex.setsDone}/{ex.setsTotal}</span>
          {:else if ex.conditioning}
            <span class="sex-tag">Cardio</span>
          {:else}
            <span class="sex-tag">Recovery</span>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Next session hook -->
    {#if next}
      <div class="next-row reveal" class:in={revealed} style="transition-delay: 150ms">
        <span class="nx-lbl">Next</span>
        <span class="nx-arrow">→</span>
        <span class="nx-day">{next.day}</span>
        <span class="nx-sub">{next.nextWeek ? 'next week' : `${next.count} exercises`}</span>
      </div>
    {/if}

    <!-- Done button -->
    <button class="summary-done-btn" on:click|stopPropagation={onDone}>
      Done
    </button>
  </div>
</div>

<style>
/* ===== Summary Overlay ===== */
.summary-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(var(--c-shadow), 0.78);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 0 env(safe-area-inset-bottom);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: sfade 0.2s ease;
}

@keyframes sfade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.summary-card {
  width: 100%;
  max-width: 640px;
  background: var(--h-0d1828);
  border: 1px solid rgba(var(--c-edge-e), 0.28);
  border-radius: 28px 28px 0 0;
  padding: 28px 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: sslide 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes sslide {
  from { transform: translateY(60px); opacity: 0.4; }
  to   { transform: translateY(0);    opacity: 1; }
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-icon { font-size: 26px; line-height: 1; }

.summary-title {
  font-size: 21px;
  font-weight: 900;
  color: var(--h-ffffff);
  letter-spacing: -0.03em;
}

.streak-pill {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(var(--c-accent), 0.12);
  border: 1px solid rgba(var(--c-accent), 0.30);
  color: var(--c-accent-solid);
  font-size: 12px;
  font-weight: 800;
  padding: 5px 11px;
  border-radius: 999px;
  white-space: nowrap;
}

.flame { display: inline-block; animation: flick 2.4s ease-in-out infinite; }

@keyframes flick {
  0%, 100% { transform: scale(1);    opacity: 0.92; }
  50%      { transform: scale(1.12); opacity: 1; }
}

.summary-stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.summary-stat {
  background: var(--c-12-22-48-0_55);
  border: 1px solid rgba(var(--c-edge-c), 0.16);
  border-radius: 16px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sstat-val {
  font-size: 22px;
  font-weight: 900;
  color: var(--c-accent-solid);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.sstat-lbl {
  font-size: 11px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.38);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* reveal animation */
.reveal {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.42s ease, transform 0.42s ease;
}
.reveal.in { opacity: 1; transform: none; }

/* volume delta */
.vol-delta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 12px;
  border-radius: 13px;
  background: var(--c-79-192-141-0_16);
  border: 1px solid var(--c-79-192-141-0_45);
  flex-wrap: wrap;
}

.vol-delta.down {
  background: rgba(var(--c-fg), 0.05);
  border-color: rgba(var(--c-fg), 0.12);
}

.vd-arrow { font-size: 15px; font-weight: 900; color: var(--h-4fc08d); line-height: 1; }
.vol-delta.down .vd-arrow { color: rgba(var(--c-fg), 0.5); }

.vd-main { font-size: 13px; font-weight: 800; color: var(--h-4fc08d); }
.vol-delta.down .vd-main { color: rgba(var(--c-fg), 0.6); }

.vd-sub { font-size: 13px; color: rgba(var(--c-fg), 0.45); }

/* personal records */
.pr-block { display: flex; flex-direction: column; gap: 8px; }

.block-lbl {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(var(--c-fg), 0.35);
}

.pr-row {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(var(--c-accent), 0.08);
  border: 1px solid rgba(var(--c-accent), 0.26);
  border-radius: 13px;
  padding: 11px 13px;
}

.pr-row::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(var(--c-accent), 0.50) 50%, transparent 65%);
  transform: translateX(-130%);
  pointer-events: none;
}

.pr-row.go::after { animation: prsweep 0.9s ease forwards; }

@keyframes prsweep { to { transform: translateX(130%); } }

.pr-trophy { font-size: 17px; line-height: 1; }

.pr-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--h-ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-vals {
  margin-left: auto;
  font-size: 14px;
  color: rgba(var(--c-fg), 0.55);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pr-new { color: var(--c-accent-solid); font-weight: 800; }

/* best set */
.best-set {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 2px;
}

.bs-star { font-size: 15px; line-height: 1; }
.bs-text { font-size: 13px; color: rgba(var(--c-fg), 0.6); }

/* exercise list */
.summary-ex-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.summary-ex-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  background: rgba(var(--c-surface-a), 0.50);
  border: 1px solid rgba(var(--c-edge-a), 0.13);
}

.summary-ex-row.sdone {
  background: rgba(var(--c-fg), 0.05);
  border-color: rgba(var(--c-fg), 0.14);
}

.sex-check {
  font-size: 13px;
  font-weight: 900;
  color: rgba(var(--c-fg), 0.25);
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.summary-ex-row.sdone .sex-check { color: rgba(var(--c-fg), 0.80); }

.sex-name {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.60);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-ex-row.sdone .sex-name { color: rgba(var(--c-fg), 0.85); }

.sex-sets {
  font-size: 12px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.35);
  flex-shrink: 0;
}

.summary-ex-row.sdone .sex-sets { color: rgba(var(--c-fg), 0.55); }

.sex-tag {
  font-size: 11px;
  font-weight: 700;
  color: rgba(var(--c-fg), 0.40);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* next session hook */
.next-row {
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--c-12-22-48-0_55);
  border: 1px solid rgba(var(--c-edge-c), 0.16);
  border-radius: 13px;
  padding: 12px 14px;
}

.nx-lbl { font-size: 12px; color: rgba(var(--c-fg), 0.45); }
.nx-arrow { font-size: 15px; color: rgba(var(--c-fg), 0.45); }
.nx-day { font-size: 15px; font-weight: 800; color: var(--h-ffffff); }
.nx-sub { margin-left: auto; font-size: 12px; color: rgba(var(--c-fg), 0.4); }

/* done button */
.summary-done-btn {
  width: 100%;
  padding: 18px;
  border-radius: 16px;
  border: none;
  background: var(--c-accent-solid);
  color: var(--h-0c0c0e);
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 4px 28px rgba(var(--c-accent), 0.30);
  transition: background 0.12s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}

.summary-done-btn:active { background: var(--h-b07e22); transform: scale(0.98); }
</style>
