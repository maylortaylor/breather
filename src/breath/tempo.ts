// Tempo and metronome-level mapping. Pure: no clock, no audio.

/** Metronome detent 1: beats sound on phase changes only. Tuned by ear. */
export const D1 = 0.2;
/** Metronome detent 2: the other beats join, very quietly. Tuned by ear. */
export const D2 = 0.4;
/** How close a drag must land to a detent to stick to it. */
export const DETENT_RADIUS = 0.03;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Slider 0..1 to BPM. Each half maps on its own so the center is exactly 60. */
export function sliderToBpm(v: number): number {
  const s = clamp01(v);
  return s <= 0.5 ? 40 + s * 40 : 60 + (s - 0.5) * 40;
}

/** Seconds per beat. Seconds mode ignores the slider and ticks once a second. */
export function beatSeconds(v: number, secondsMode: boolean): number {
  return secondsMode ? 1 : 60 / sliderToBpm(v);
}

/** The nearest detent within `radius` of `v`, or `v` itself. */
export function snap(v: number, detents: readonly number[], radius: number): number {
  let best = v;
  let bestDistance = radius;
  for (const d of detents) {
    const distance = Math.abs(v - d);
    if (distance <= bestDistance) {
      best = d;
      bestDistance = distance;
    }
  }
  return best;
}

export type MetronomeGains = { phase: number; beat: number };

// Multipliers on the Lab-approved voice and tone levels. D2 beats sit about 18 dB under the tones.
const PHASE_AT_DETENTS = 0.6;
const BEAT_AT_D2 = 0.12;

/**
 * Gain for phase-change tones and for ordinary beats at a slider level. At or below D2 the level
 * snaps to off, D1 or D2; above D2 both rise to full at 1.
 */
export function metronomeGains(level: number): MetronomeGains {
  const l = clamp01(level);
  if (l > D2) {
    const t = (l - D2) / (1 - D2);
    return {
      phase: PHASE_AT_DETENTS + (1 - PHASE_AT_DETENTS) * t,
      beat: BEAT_AT_D2 + (1 - BEAT_AT_D2) * t,
    };
  }
  const stop = snap(l, [0, D1, D2], 1);
  if (stop === 0) return { phase: 0, beat: 0 };
  return { phase: PHASE_AT_DETENTS, beat: stop === D2 ? BEAT_AT_D2 : 0 };
}
