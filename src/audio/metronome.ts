import { connectOut, type Engine } from "./engine";

export type OneShot = (engine: Engine, at: number, layer: string) => void;

/** Sine partial with a fast exponential decay, routed to the metronome layer. */
function partial(
  engine: Engine,
  layer: string,
  at: number,
  hz: number,
  peak: number,
  decay: number,
  opts: { endHz?: number; type?: OscillatorType; reverb?: number } = {}
): void {
  const { ctx } = engine;
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(hz, at);
  if (opts.endHz) osc.frequency.exponentialRampToValueAtTime(opts.endHz, at + decay);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(peak, at + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(env);
  // Release the send and wet nodes once the tone has ended, or the wet list grows every beat.
  osc.onended = connectOut(engine, env, layer, opts.reverb ?? 0);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

/** The swappable beat voices. */
export const METRONOME_VOICES: Record<string, OneShot> = {
  "soft tick (700 Hz)": (e, at, l) => partial(e, l, at, 700, 1.2, 0.06, { type: "triangle" }),
  "soft tick (350 Hz)": (e, at, l) => partial(e, l, at, 350, 1.2, 0.06, { type: "triangle" }),
  "wood block": (e, at, l) => {
    partial(e, l, at, 880, 1, 0.07);
    partial(e, l, at, 1320, 0.5, 0.05);
  },
  "heartbeat thump": (e, at, l) => {
    partial(e, l, at, 70, 1.3, 0.16, { endHz: 42 });
    partial(e, l, at + 0.2, 62, 0.9, 0.14, { endHz: 38 });
  },
};

/** The voice the metronome uses until the listener picks another. */
export const DEFAULT_METRONOME_VOICE = "heartbeat thump";

/** Three phase tones, each recognizable by pitch contour so you hear where you are in the breath. */
export const PHASE_TONES: Record<string, OneShot> = {
  "inhale (rising)": (e, at, l) => {
    partial(e, l, at, 392, 0.9, 1.2, { endHz: 523, reverb: 0.3 });
    partial(e, l, at, 784, 0.18, 0.9, { endHz: 1046 });
  },
  "hold (steady)": (e, at, l) => {
    partial(e, l, at, 440, 0.8, 1.4, { reverb: 0.3 });
    partial(e, l, at, 660, 0.27, 1, { type: "triangle" });
  },
  "exhale (falling)": (e, at, l) => {
    partial(e, l, at, 523, 0.9, 1.6, { endHz: 330, reverb: 0.3 });
    partial(e, l, at, 1046, 0.18, 1, { endHz: 660 });
  },
};

/** Phase tones as a low singing bowl: slow, round, long ring. Same contour per phase. */
export const BOWL_TONES: Record<string, OneShot> = {
  "bowl inhale": (e, at, l) => {
    partial(e, l, at, 262, 0.9, 2, { endHz: 311, reverb: 0.4 });
    partial(e, l, at, 722, 0.2, 1.4, { endHz: 858 });
  },
  "bowl hold": (e, at, l) => {
    partial(e, l, at, 294, 0.85, 2.2, { reverb: 0.4 });
    partial(e, l, at, 811, 0.2, 1.5);
  },
  "bowl exhale": (e, at, l) => {
    partial(e, l, at, 311, 0.9, 2.4, { endHz: 262, reverb: 0.4 });
    partial(e, l, at, 858, 0.2, 1.6, { endHz: 722 });
  },
};

/** Phase tones as a high, bright chime: short and clear. Same contour per phase. */
export const CHIME_TONES: Record<string, OneShot> = {
  "chime inhale": (e, at, l) => {
    partial(e, l, at, 880, 0.7, 0.9, { endHz: 1047, reverb: 0.3 });
    partial(e, l, at, 2112, 0.12, 0.6, { endHz: 2513 });
  },
  "chime hold": (e, at, l) => {
    partial(e, l, at, 988, 0.65, 1, { reverb: 0.3 });
    partial(e, l, at, 2371, 0.12, 0.6);
  },
  "chime exhale": (e, at, l) => {
    partial(e, l, at, 1047, 0.7, 1.1, { endHz: 784, reverb: 0.3 });
    partial(e, l, at, 2513, 0.12, 0.7, { endHz: 1882 });
  },
};

/** Plain 440 Hz tone for checking that the engine and master volume work. */
export const TEST_TONE: OneShot = (e, at, l) => partial(e, l, at, 440, 0.1, 0.6);
