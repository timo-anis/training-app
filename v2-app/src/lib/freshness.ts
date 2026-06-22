/**
 * freshness.ts — honest "updated Xm ago" labels.
 * Pure + dependency-free so it is unit-testable in isolation. We never fake
 * "live"; the coach view is exactly as fresh as the trainee's last cloud sync.
 */
export function relativeAge(iso: string | null, nowMs: number = Date.now()): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const sec = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${Math.max(1, min)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
