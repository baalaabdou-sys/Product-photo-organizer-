/**
 * Restrained haptics. Only four moments in the whole app trigger one, and
 * anything not on this list deliberately stays silent.
 */
type Moment = 'focus' | 'generation' | 'path-complete' | 'commit';

const PATTERNS: Record<Moment, number | number[]> = {
  focus: 8,
  generation: 6,
  'path-complete': [10, 40, 16],
  commit: [12, 30, 12],
};

let lastAt = 0;

export function haptic(moment: Moment): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const now = Date.now();
  // Never more than one buzz every 120ms, however fast the user moves.
  if (now - lastAt < 120) return;
  lastAt = now;
  try { navigator.vibrate(PATTERNS[moment]); } catch { /* unsupported */ }
}
