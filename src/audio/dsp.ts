// Pure sound math. Nothing here touches Web Audio, so it runs in node under test.
// Randomness and time are always passed in.

export type Rng = () => number;

/** Small seedable generator (mulberry32) for repeatable tests. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);

export type NoiseKind = "white" | "pink" | "brown";

const MIN_LOOP_SEC = 10;
const LOOP_FADE_SEC = 0.5;
const NOISE_PEAK = 0.9;

/**
 * One loopable noise buffer. Generates a little more than asked, then equal-power crossfades the
 * extra tail into the head, so the last sample flows straight into the first with no seam.
 */
export function makeNoise(
  kind: NoiseKind,
  sampleRate: number,
  seconds: number,
  rng: Rng
): Float32Array<ArrayBuffer> {
  if (seconds < MIN_LOOP_SEC) throw new Error(`noise loop must be at least ${MIN_LOOP_SEC} s`);
  const n = Math.round(sampleRate * seconds);
  const fade = Math.round(sampleRate * LOOP_FADE_SEC);
  const raw = new Float32Array(n + fade);

  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0,
    brown = 0;
  for (let i = 0; i < raw.length; i++) {
    const w = rng() * 2 - 1;
    if (kind === "white") {
      raw[i] = w;
    } else if (kind === "pink") {
      // Paul Kellet's economy pinking filter.
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      // Leaky integrator: brown noise without the slow drift of a pure integral.
      brown = (brown + 0.02 * w) / 1.02;
      raw[i] = brown;
    }
  }

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (i < fade) {
      const theta = (i / fade) * (Math.PI / 2);
      out[i] = (raw[n + i] ?? 0) * Math.cos(theta) + (raw[i] ?? 0) * Math.sin(theta);
    } else {
      out[i] = raw[i] ?? 0;
    }
  }

  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const scale = peak > 0 ? NOISE_PEAK / peak : 1;
  for (let i = 0; i < n; i++) out[i] = (out[i] ?? 0) * scale;
  return out;
}

/** Stereo reverb impulse: decorrelated noise under a falling power envelope. */
export function makeImpulse(
  sampleRate: number,
  seconds: number,
  decay: number,
  rng: Rng
): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const n = Math.round(sampleRate * seconds);
  const make = () => {
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i++) ch[i] = (rng() * 2 - 1) * Math.pow(1 - i / n, decay);
    return ch;
  };
  return [make(), make()];
}

export interface TriggerScheduler {
  /** Fire every trigger that falls inside the lookahead window. Call from a short timer. */
  tick(): void;
  /** Drop the pending trigger and start counting again from now. */
  reset(): void;
}

export interface TriggerSchedulerOptions {
  rng: Rng;
  /** Clock in seconds. In the app this is AudioContext.currentTime. */
  now: () => number;
  minGap: number;
  maxGap: number;
  lookahead: number;
  /** Receives the time at which to start the sound. */
  fire: (at: number) => void;
}

/** Random-interval trigger on an injected clock, for bubbles and whale calls. */
export function createTriggerScheduler(opts: TriggerSchedulerOptions): TriggerScheduler {
  const gap = () => between(opts.rng, opts.minGap, opts.maxGap);
  let next = opts.now() + gap();
  return {
    tick() {
      const horizon = opts.now() + opts.lookahead;
      while (next < horizon) {
        opts.fire(next);
        next += gap();
      }
    },
    reset() {
      next = opts.now() + gap();
    },
  };
}

export interface BubbleParams {
  startHz: number;
  endHz: number;
  decay: number;
  gain: number;
}

export function bubbleParams(rng: Rng): BubbleParams {
  const startHz = between(rng, 300, 960);
  return {
    startHz,
    endHz: startHz * between(rng, 1.5, 2.5),
    decay: between(rng, 0.06, 0.2),
    gain: between(rng, 0.3, 1),
  };
}

export interface WhaleParams {
  startHz: number;
  endHz: number;
  duration: number;
  vibratoHz: number;
  vibratoDepthHz: number;
}

export function whaleParams(rng: Rng): WhaleParams {
  const startHz = between(rng, 120, 300);
  return {
    startHz,
    endHz: startHz * between(rng, 0.75, 1.6),
    duration: between(rng, 3, 9),
    vibratoHz: between(rng, 3, 6),
    vibratoDepthHz: startHz * between(rng, 0.02, 0.06),
  };
}

export const midiToHz = (note: number): number => 440 * Math.pow(2, (note - 69) / 12);

export const chordHz = (chord: readonly number[]): number[] => chord.map(midiToHz);

export type MoodName = "dreamy" | "tonal" | "deep";

export interface Mood {
  chords: readonly (readonly number[])[];
  minChangeSec: number;
  maxChangeSec: number;
  detuneCents: number;
  cutoffHz: number;
  /** Sparse high notes over the pad. Used by Deep. */
  shimmer: boolean;
}

export const MOODS: Record<MoodName, Mood> = {
  // Wide, airy major 7th and 9th voicings.
  dreamy: {
    chords: [
      [48, 55, 59, 62, 64],
      [41, 57, 60, 64, 67],
      [45, 60, 64, 67, 71],
      [43, 59, 62, 66, 69],
    ],
    minChangeSec: 22,
    maxChangeSec: 36,
    detuneCents: 9,
    cutoffHz: 2400,
    shimmer: false,
  },
  // Open fifths and suspended chords: stable, no pull.
  tonal: {
    chords: [
      [45, 52, 57, 64],
      [50, 57, 64],
      [43, 50, 57],
      [40, 47, 52, 59],
    ],
    minChangeSec: 24,
    maxChangeSec: 40,
    detuneCents: 5,
    cutoffHz: 1500,
    shimmer: false,
  },
  // Low drones with a sparse high shimmer.
  deep: {
    chords: [
      [28, 35, 40],
      [31, 38, 43],
      [33, 40, 45],
    ],
    minChangeSec: 28,
    maxChangeSec: 40,
    detuneCents: 7,
    cutoffHz: 700,
    shimmer: true,
  },
};

/** Pick a different chord from the current one, uniformly. */
export function nextChordIndex(current: number, count: number, rng: Rng): number {
  const pick = Math.floor(rng() * (count - 1));
  return pick >= current ? pick + 1 : pick;
}
