// Pure rules for the Breath tab: the live hint, the spoken value phrases, the detent snapping
// and the voice list. No DOM, no audio.
import type { VoiceId } from "../presets";
import { beatSeconds, D1, D2, DETENT_RADIUS, snap } from "../breath/tempo";

const CENTER = 0.5;
const INHALE_BEATS = 4;
const TEMPO_KEY_STEP = 0.025;
const METRONOME_KEY_STEP = 0.05;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// Keeps 0.1 + 0.2 style drift out of the stored value.
const tidy = (v: number) => Math.round(v * 1000) / 1000;

/** Whole seconds of inhale at a tempo; seconds mode always breathes in for 4. */
export function inhaleSeconds(tempo: number, secondsMode: boolean): number {
  return Math.round(INHALE_BEATS * beatSeconds(tempo, secondsMode));
}

export const inhaleHint = (tempo: number, secondsMode: boolean) =>
  `Inhale about ${inhaleSeconds(tempo, secondsMode)}s`;

/** The tempo as a phrase for screen readers. Never a BPM number. */
export function tempoText(v: number): string {
  if (Math.abs(v - CENTER) <= DETENT_RADIUS) return "Resting pace";
  if (v <= 0.05) return "Slowest";
  if (v < CENTER) return "Slow";
  if (v >= 0.95) return "Fastest";
  return "Fast";
}

/** On release the tempo sticks to the center when it lands near it. */
export const releaseTempo = (v: number) => snap(v, [CENTER], DETENT_RADIUS);

/** One arrow-key step. A step that would cross the center stops on it first. */
export function stepTempo(v: number, dir: 1 | -1): number {
  const next = clamp01(v + dir * TEMPO_KEY_STEP);
  const crosses = (v - CENTER) * (next - CENTER) < 0;
  return tidy(crosses ? CENTER : next);
}

export const METRONOME_STOPS = [0, D1, D2] as const;

/** Below detent 2 the level sits on off, detent 1 or detent 2; above it, anywhere. */
export const settleMetronome = (v: number) => (v > D2 ? v : snap(v, METRONOME_STOPS, 1));

/** One arrow-key step: stop to stop below detent 2, a fixed amount above it. */
export function stepMetronome(v: number, dir: 1 | -1): number {
  if (dir === 1) {
    if (v >= D2) return tidy(clamp01(v + METRONOME_KEY_STEP));
    return METRONOME_STOPS.find((s) => s > v) ?? D2;
  }
  if (v > D2) return tidy(Math.max(D2, v - METRONOME_KEY_STEP));
  return [...METRONOME_STOPS].reverse().find((s) => s < v) ?? 0;
}

/** The metronome level as a phrase for screen readers. */
export function metronomeText(level: number): string {
  if (level <= 0) return "Off";
  if (level <= D1) return "Phase changes only";
  if (level <= D2) return "All beats, very quiet";
  if (level < 0.65) return "All beats, soft";
  if (level < 0.9) return "All beats";
  return "All beats, loud";
}

export const VOICES: { id: VoiceId; label: string }[] = [
  { id: "metro-heartbeat-thump", label: "Heartbeat thump" },
  { id: "metro-wood-block", label: "Wood block" },
  { id: "metro-soft-tick-700-hz", label: "Soft tick 700 Hz" },
  { id: "metro-soft-tick-350-hz", label: "Soft tick 350 Hz" },
];
