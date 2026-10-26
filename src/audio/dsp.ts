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

/** Slider position (0 to 1) to gain. Squared so the low end has fine control. */
export const sliderToGain = (value: number): number => value * value;

export type NoiseKind = "white" | "pink" | "brown";

const MIN_LOOP_SEC = 10;
const LOOP_FADE_SEC = 0.5;
const NOISE_PEAK = 0.9;
/** About -24 dBFS. Loudness is set by RMS, so white, pink and brown sit at the same level. */
export const TARGET_RMS = 0.063;
/** Gentle top-end roll-off applied at generation. Brown is already dark. */
const NOISE_LOWPASS_HZ: Record<NoiseKind, number | null> = {
  white: 7000,
  pink: 10000,
  brown: null,
};

/** One-pole lowpass in place. */
function lowpass(data: Float32Array, cutoffHz: number, sampleRate: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  let y = 0;
  for (let i = 0; i < data.length; i++) {
    y += a * ((data[i] ?? 0) - y);
    data[i] = y;
  }
}

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

  const cutoff = NOISE_LOWPASS_HZ[kind];
  if (cutoff) lowpass(raw, cutoff, sampleRate);

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
  let sumSq = 0;
  for (const v of out) {
    peak = Math.max(peak, Math.abs(v));
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / n);
  const scale = peak > 0 ? Math.min(TARGET_RMS / rms, NOISE_PEAK / peak) : 1;
  for (let i = 0; i < n; i++) out[i] = (out[i] ?? 0) * scale;
  return out;
}

/** Two independently generated channels, so the left and right ears hear different noise. */
export function makeStereoNoise(
  kind: NoiseKind,
  sampleRate: number,
  seconds: number,
  rngLeft: Rng,
  rngRight: Rng
): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  return [
    makeNoise(kind, sampleRate, seconds, rngLeft),
    makeNoise(kind, sampleRate, seconds, rngRight),
  ];
}

const IMPULSE_LOWPASS_START_HZ = 8000;
const IMPULSE_LOWPASS_END_HZ = 1500;

/**
 * Stereo reverb impulse: decorrelated noise under a falling power envelope, darkened as it decays
 * (lowpass cutoff slides from 8 kHz to 1.5 kHz) so the tail is not hissy.
 */
export function makeImpulse(
  sampleRate: number,
  seconds: number,
  decay: number,
  rng: Rng
): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const n = Math.round(sampleRate * seconds);
  const make = () => {
    const ch = new Float32Array(n);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const cutoff =
        IMPULSE_LOWPASS_START_HZ * Math.pow(IMPULSE_LOWPASS_END_HZ / IMPULSE_LOWPASS_START_HZ, t);
      const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
      y += a * (rng() * 2 - 1 - y);
      ch[i] = y * Math.pow(1 - t, decay);
    }
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
  /** Stereo position, -0.6 to 0.6. */
  pan: number;
}

export function bubbleParams(rng: Rng): BubbleParams {
  const startHz = between(rng, 300, 960);
  return {
    startHz,
    endHz: startHz * between(rng, 1.5, 2.5),
    decay: between(rng, 0.06, 0.2),
    gain: between(rng, 0.3, 1),
    pan: between(rng, -0.6, 0.6),
  };
}

/** Seconds to the next bubble event: 3 to 14, leaning short with a long tail. */
export function bubbleGap(rng: Rng): number {
  return 3 + 11 * Math.pow(rng(), 1.6);
}

/** Offsets in seconds for one event: usually a single bubble, sometimes a cluster of 2 to 4. */
export function bubbleCluster(rng: Rng): number[] {
  if (rng() >= 0.3) return [0];
  const count = 2 + Math.floor(rng() * 3);
  const offsets = [0];
  for (let i = 1; i < count; i++) offsets.push((offsets[i - 1] ?? 0) + between(rng, 0.06, 0.3));
  return offsets;
}

export interface BubbleSchedulerOptions {
  rng: Rng;
  now: () => number;
  lookahead: number;
  /** Delay before the first event, so a listener does not wait for a full gap. */
  firstDelay: number;
  fire: (at: number) => void;
}

/** Irregular bubble events with occasional clusters, on an injected clock. */
export function createBubbleScheduler(opts: BubbleSchedulerOptions): TriggerScheduler {
  let next = opts.now() + opts.firstDelay;
  return {
    tick() {
      const horizon = opts.now() + opts.lookahead;
      while (next < horizon) {
        for (const offset of bubbleCluster(opts.rng)) opts.fire(next + offset);
        next += bubbleGap(opts.rng);
      }
    },
    reset() {
      next = opts.now() + opts.firstDelay;
    },
  };
}

export type WhaleVariant = "A" | "B" | "C";

export interface WhaleSegment {
  startHz: number;
  endHz: number;
  duration: number;
}

export interface WhalePlan {
  /** Contiguous pitch glides. Each starts where the last one ended. */
  segments: WhaleSegment[];
  duration: number;
  /** Harmonic partials as a ratio to the fundamental and a relative amplitude. */
  partials: { ratio: number; amp: number }[];
  /** Bandpass formant that sweeps over the call, or null for none. */
  formant: { fromHz: number; toHz: number; q: number } | null;
  lowpassHz: number | null;
  vibratoHz: number;
  vibratoDepth: number;
  /** Output level before the layer slider. */
  level: number;
  /** Send to the shared reverb. */
  reverb: number;
}

function humpbackSegments(rng: Rng): WhaleSegment[] {
  const count = 3 + Math.floor(rng() * 4);
  const segments: WhaleSegment[] = [];
  let hz = between(rng, 150, 600);
  for (let i = 0; i < count; i++) {
    const next = between(rng, 150, 900);
    segments.push({ startHz: hz, endHz: next, duration: between(rng, 2, 6) });
    hz = next;
  }
  return segments;
}

/** Variant A is a humpback-style song, B a deep blue-whale moan, C a distant, dark A. */
export function whalePlan(variant: WhaleVariant, rng: Rng): WhalePlan {
  if (variant === "B") {
    const from = between(rng, 30, 80);
    const to = between(rng, 20, 80);
    const duration = between(rng, 8, 16);
    return {
      segments: [{ startHz: from, endHz: to, duration }],
      duration,
      // The octave carries the call on phone speakers, which cannot reproduce 20 to 80 Hz.
      partials: [
        { ratio: 1, amp: 1 },
        { ratio: 2, amp: 0.8 },
        { ratio: 3, amp: 0.25 },
      ],
      formant: null,
      lowpassHz: 500,
      vibratoHz: 0.4,
      vibratoDepth: 0.01,
      level: 0.5,
      reverb: 0.8,
    };
  }
  const segments = humpbackSegments(rng);
  const duration = segments.reduce((a, g) => a + g.duration, 0);
  const low = rng() < 0.5;
  const base: WhalePlan = {
    segments,
    duration,
    partials: [
      { ratio: 1, amp: 1 },
      { ratio: 2, amp: 0.5 },
      { ratio: 3, amp: 0.3 },
      { ratio: 4, amp: 0.12 },
    ],
    formant: { fromHz: low ? 500 : 1400, toHz: low ? 1400 : 500, q: 1.5 },
    lowpassHz: null,
    vibratoHz: between(rng, 3, 5),
    vibratoDepth: 0.012,
    level: 0.9,
    reverb: 1,
  };
  if (variant === "A") return base;
  return { ...base, lowpassHz: 1200, level: 0.2, reverb: 1.8 };
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
