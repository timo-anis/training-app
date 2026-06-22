/**
 * RPE (RIR-based, 6–10) auto-suggest math — pure, side-effect-free.
 *
 * Scale: Zourdos et al. 2016 (J Strength Cond Res); application Helms/Zourdos
 * et al. 2016 (Strength Cond J). RIR = Reps In Reserve.
 *
 * The suggestion is a rough pre-fill only. It is shown faint and is NEVER
 * recorded unless the user confirms it — see RpeControl.svelte.
 */

/** Epley estimated 1RM for a single set. */
export function epley1RM(kg: number, reps: number): number {
  return kg * (1 + reps / 30);
}

/** Best (max) Epley e1RM across a list of historical sets. 0 if none valid. */
export function bestE1RM(history: { kg: string; reps: string }[]): number {
  let best = 0;
  for (const s of history) {
    const kg = parseFloat(String(s.kg).replace(',', '.'));
    const reps = parseFloat(String(s.reps));
    if (!(kg > 0) || !(reps > 0)) continue;
    const e = epley1RM(kg, reps);
    if (e > best) best = e;
  }
  return best;
}

/**
 * Suggest an RPE (6–10, half-steps) for a set at today's load.
 *
 *   predMax   = 30 × (e1RM / kgNow − 1)   // predicted reps-to-failure at this load
 *   RIR       = predMax − repsNow
 *   suggested = clamp(round(10 − RIR to nearest 0.5), 6, 10)
 *
 * Returns null when no suggestion is possible: kg/reps missing, or no history
 * (e1RM ≤ 0). A pre-fill only — manual entry is always allowed.
 */
export function suggestRpe(kgNow: string, repsNow: string, e1RM: number): number | null {
  const kg = parseFloat(String(kgNow).replace(',', '.'));
  const reps = parseFloat(String(repsNow));
  if (!(kg > 0) || !(reps > 0)) return null;
  if (!(e1RM > 0)) return null;
  const predMax = 30 * (e1RM / kg - 1);
  const rir = predMax - reps;
  const rounded = Math.round((10 - rir) * 2) / 2; // nearest 0.5
  return Math.min(10, Math.max(6, rounded));
}

/** The discrete RPE values offered in the picker, with their RIR meaning. */
export const RPE_OPTIONS: { value: string; rir: string }[] = [
  { value: '10',  rir: '0 reps left' },
  { value: '9.5', rir: '0–1 left' },
  { value: '9',   rir: '1 rep left' },
  { value: '8.5', rir: '1–2 left' },
  { value: '8',   rir: '2 reps left' },
  { value: '7.5', rir: '2–3 left' },
  { value: '7',   rir: '3 reps left' },
  { value: '6.5', rir: '3–4 left' },
  { value: '6',   rir: '4+ left' },
];
