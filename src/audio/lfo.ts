// Pure LFO math. Time is passed in (seconds, never read from a clock) so tests need no timers.
import { createRng, type Rng } from "./dsp";

export const MIN_PERIOD = 8;
export const MAX_PERIOD = 120;

export type LfoShape = "sine" | "smooth-random";

export interface LfoConfig {
  /** Seconds per cycle, clamped to 8..120. */
  period: number;
  shape: LfoShape;
  color: string;
}

/** Slow only: nothing faster than 8 s per cycle. */
export function clampPeriod(period: number): number {
  if (Number.isNaN(period)) return MIN_PERIOD;
  return Math.min(MAX_PERIOD, Math.max(MIN_PERIOD, period));
}

/** Teal, violet and amber: distinct, and readable on the dark Lab background. */
export const DEFAULT_LFOS: readonly LfoConfig[] = [
  { period: 20, shape: "sine", color: "#2dd4bf" },
  { period: 45, shape: "sine", color: "#a78bfa" },
  { period: 90, shape: "smooth-random", color: "#fbbf24" },
];

export interface Lfo {
  readonly period: number;
  readonly shape: LfoShape;
  readonly color: string;
  /** Position in the current cycle, 0 up to 1. */
  readonly phase: number;
  /** Output in [0, 1] at time `t` seconds. Call with non-decreasing times. */
  value(t: number): number;
  setPeriod(period: number): void;
  setShape(shape: LfoShape): void;
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);

function createLfo(config: LfoConfig, rng: Rng): Lfo {
  let period = clampPeriod(config.period);
  let shape = config.shape;
  // Phase is accumulated rather than computed from t, so a period change never jumps.
  let phase = 0;
  let lastT: number | null = null;
  // Smooth random walks between random targets, one segment per half cycle.
  let from = rng();
  let to = rng();
  let segment = 0;

  return {
    get period() {
      return period;
    },
    get shape() {
      return shape;
    },
    color: config.color,
    get phase() {
      return phase % 1;
    },
    value(t) {
      if (lastT !== null) phase += Math.max(0, t - lastT) / period;
      lastT = Math.max(t, lastT ?? t);
      if (shape === "sine") return 0.5 + 0.5 * Math.cos(2 * Math.PI * phase);
      const pos = phase * 2;
      while (segment < Math.floor(pos)) {
        segment++;
        from = to;
        to = rng();
      }
      return from + (to - from) * smoothstep(pos - segment);
    },
    setPeriod(next) {
      period = clampPeriod(next);
    },
    setShape(next) {
      shape = next;
    },
  };
}

export interface LfoBank {
  readonly lfos: readonly Lfo[];
  /** Advance every LFO to time `t` and return their values. */
  sample(t: number): number[];
}

/** Each LFO gets its own random stream, so two smooth-random LFOs never move together. */
export function createLfoBank(configs: readonly LfoConfig[], rng: Rng): LfoBank {
  const lfos = configs.map((c, i) => createLfo(c, createRng(Math.floor(rng() * 2 ** 31) + i)));
  return { lfos, sample: (t) => lfos.map((l) => l.value(t)) };
}

/** Gain multiplier for a sound: depth 0 leaves it alone, depth 1 swings it down to silence. */
export function modGain(depth: number, lfoValue: number): number {
  const d = Math.min(1, Math.max(0, depth));
  const v = Math.min(1, Math.max(0, lfoValue));
  return 1 - d * (1 - v);
}
