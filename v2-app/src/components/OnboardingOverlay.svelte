<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ done: void }>();

  let step = 0;
  const TOTAL = 3;

  function next() {
    if (step < TOTAL - 1) { step++; }
    else { dispatch('done'); }
  }

  function prev() {
    if (step > 0) step--;
  }

  $: isLast = step === TOTAL - 1;
  $: nextLabel = isLast ? 'Alusta →' : 'Edasi →';
</script>

<div class="ob-backdrop">
  <div class="ob-card">

    <!-- Step indicators -->
    <div class="ob-dots">
      {#each Array(TOTAL) as _, i}
        <div class="dot" class:active={i === step} class:done={i < step}></div>
      {/each}
    </div>

    <!-- Slides -->
    {#if step === 0}
      <div class="ob-slide">
        <div class="ob-icon">
          <!-- Calendar SVG -->
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect x="4" y="10" width="48" height="42" rx="8" fill="rgba(196,148,46,0.12)" stroke="rgba(196,148,46,0.45)" stroke-width="1.5"/>
            <line x1="4" y1="22" x2="52" y2="22" stroke="rgba(196,148,46,0.30)" stroke-width="1.5"/>
            <rect x="14" y="6" width="4" height="10" rx="2" fill="#c49230"/>
            <rect x="38" y="6" width="4" height="10" rx="2" fill="#c49230"/>
            <!-- Day cells -->
            <rect x="10" y="28" width="8" height="7" rx="2" fill="rgba(255,255,255,0.08)"/>
            <rect x="22" y="28" width="8" height="7" rx="2" fill="rgba(255,255,255,0.08)"/>
            <rect x="34" y="28" width="8" height="7" rx="2" fill="rgba(196,148,46,0.75)"/>
            <rect x="10" y="39" width="8" height="7" rx="2" fill="rgba(255,255,255,0.06)"/>
            <rect x="22" y="39" width="8" height="7" rx="2" fill="rgba(255,255,255,0.06)"/>
            <rect x="34" y="39" width="8" height="7" rx="2" fill="rgba(255,255,255,0.06)"/>
          </svg>
        </div>
        <h2>Nädalapõhine logi</h2>
        <p>Trennid on jagatud nädalatesse ja päevadesse. Iga nädal on eraldi — esimene nädal algas 16. veebruaril 2026. Sa oled praegu jooksval nädalal.</p>
        <div class="ob-tip">
          <span class="tip-icon">💡</span>
          <span>Eelmise nädala treeningu saad kopeerida uude nädala — <strong>Copy from Week X</strong> ilmub tühja päeva all. Uue nädala lisamiseks vajuta <strong>+ Week</strong>.</span>
        </div>
      </div>

    {:else if step === 1}
      <div class="ob-slide">
        <div class="ob-icon">
          <!-- Dumbbell / list SVG -->
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect x="6" y="14" width="44" height="10" rx="5" fill="rgba(196,148,46,0.12)" stroke="rgba(196,148,46,0.40)" stroke-width="1.5"/>
            <rect x="6" y="29" width="44" height="10" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" stroke-width="1.5"/>
            <rect x="6" y="44" width="28" height="10" rx="5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" stroke-width="1.5"/>
            <!-- Done checkmark on first row -->
            <circle cx="44" cy="34" r="6" fill="rgba(196,148,46,0.20)" stroke="rgba(196,148,46,0.55)" stroke-width="1.5"/>
            <path d="M41 34l2 2 4-4" stroke="#c49230" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- + icon on last row -->
            <circle cx="40" cy="49" r="6" fill="rgba(127,178,255,0.15)" stroke="rgba(127,178,255,0.35)" stroke-width="1.5"/>
            <line x1="40" y1="46" x2="40" y2="52" stroke="#7fb2ff" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="37" y1="49" x2="43" y2="49" stroke="#7fb2ff" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </div>
        <h2>Lisa harjutused</h2>
        <p>Vajuta <strong>+ Add exercise</strong> päeva allosas, sisesta nimi ja harjutus ilmub kaardina. Lisa setid, kg ja kordused.</p>
        <div class="ob-tip">
          <span class="tip-icon">💡</span>
          <span>Iga seti järel vajuta ringi — see märgib seti tehtuks. <strong>Kolmapäev</strong> on aktiivseks taastumiseks (liikuvus, rull) — see ei ole treeningpäev ja on kalendris kullakollasena märgitud.</span>
        </div>
      </div>

    {:else if step === 2}
      <div class="ob-slide">
        <div class="ob-icon">
          <!-- Play / workout mode SVG -->
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="24" fill="rgba(196,148,46,0.10)" stroke="rgba(196,148,46,0.35)" stroke-width="1.5"/>
            <circle cx="28" cy="28" r="17" fill="rgba(196,148,46,0.08)" stroke="rgba(196,148,46,0.20)" stroke-width="1"/>
            <path d="M23 20l14 8-14 8V20z" fill="#c49230"/>
          </svg>
        </div>
        <h2>Workout mode</h2>
        <p>Vajuta <strong>▶ Start Workout</strong> ekraani allosas — avaneb fokusseeritud vaade, kus näed ühte harjutust korraga. Eelmise nädala kg/kordused on eeltäidetud.</p>
        <div class="ob-tip">
          <span class="tip-icon">💡</span>
          <span>Harjutuste vahel libista. Puhketaimer käivitub automaatselt pärast setti. Lõpetades vajuta <strong>Finish Training</strong> — päev märgitakse kalendris roheliseks.</span>
        </div>
      </div>
    {/if}

    <!-- Navigation -->
    <div class="ob-nav">
      {#if step > 0}
        <button class="btn-back" on:click={prev}>← Tagasi</button>
      {:else}
        <div></div>
      {/if}
      <button class="btn-next" on:click={next}>{nextLabel}</button>
    </div>

  </div>
</div>

<style>
  .ob-backdrop {
    position: fixed;
    inset: 0;
    z-index: 400;
    background: rgba(4, 6, 14, 0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 0 env(safe-area-inset-bottom, 0px);
  }

  .ob-card {
    width: 100%;
    max-width: 480px;
    background: linear-gradient(180deg, #0d1a2e 0%, #080c18 100%);
    border: 1px solid rgba(65, 100, 175, 0.22);
    border-top: 1px solid rgba(196, 148, 46, 0.30);
    border-radius: 26px 26px 0 0;
    padding: 24px 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 0;
    animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  @keyframes slide-up {
    from { transform: translateY(40px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* Step dots */
  .ob-dots {
    display: flex;
    gap: 7px;
    justify-content: center;
    margin-bottom: 28px;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    transition: background 0.2s, transform 0.2s;
  }

  .dot.active {
    background: #c49230;
    transform: scale(1.25);
  }

  .dot.done {
    background: rgba(196, 148, 46, 0.40);
  }

  /* Slide content */
  .ob-slide {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    min-height: 280px;
    justify-content: center;
  }

  .ob-icon {
    width: 80px;
    height: 80px;
    border-radius: 22px;
    background: rgba(196, 148, 46, 0.07);
    border: 1px solid rgba(196, 148, 46, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
    color: #f0f4ff;
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.58);
    max-width: 320px;
  }

  p strong {
    color: #c49230;
    font-weight: 700;
  }

  .ob-tip {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: rgba(196, 148, 46, 0.07);
    border: 1px solid rgba(196, 148, 46, 0.18);
    border-radius: 14px;
    padding: 12px 14px;
    text-align: left;
    max-width: 340px;
    width: 100%;
  }

  .tip-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }

  .ob-tip span:last-child {
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.50);
  }

  .ob-tip strong {
    color: rgba(255, 255, 255, 0.75);
    font-weight: 700;
  }

  /* Navigation buttons */
  .ob-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 28px;
  }

  .btn-back {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.40);
    font-size: 14px;
    font-weight: 700;
    padding: 13px 20px;
    border-radius: 14px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, color 0.12s;
  }

  .btn-back:active { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.65); }

  .btn-next {
    flex: 1;
    background: #c49230;
    border: none;
    color: #0c0800;
    font-size: 16px;
    font-weight: 900;
    padding: 15px 24px;
    border-radius: 14px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    letter-spacing: 0.01em;
    transition: background 0.12s, transform 0.1s;
    box-shadow: 0 4px 20px rgba(196, 148, 46, 0.20);
  }

  .btn-next:active { background: #b07e22; transform: scale(0.98); box-shadow: none; }
</style>
