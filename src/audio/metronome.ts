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
  connectOut(engine, env, layer, opts.reverb ?? 0);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

/** The four swappable beat voices. */
export const METRONOME_VOICES: Record<string, OneShot> = {
  "soft tick": (e, at, l) => partial(e, l, at, 1400, 1.2, 0.06, { type: "triangle" }),
  "wood block": (e, at, l) => {
    partial(e, l, at, 880, 1, 0.07);
    partial(e, l, at, 1320, 0.5, 0.05);
  },
  bell: (e, at, l) => {
    partial(e, l, at, 880, 0.9, 1.4, { reverb: 0.3 });
    partial(e, l, at, 880 * 2.76, 0.27, 0.9);
    partial(e, l, at, 880 * 5.4, 0.11, 0.4);
  },
  "heartbeat thump": (e, at, l) => {
    partial(e, l, at, 70, 1.3, 0.16, { endHz: 42 });
    partial(e, l, at + 0.2, 62, 0.9, 0.14, { endHz: 38 });
  },
};

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

/** Plain 440 Hz tone for checking that the engine and master volume work. */
export const TEST_TONE: OneShot = (e, at, l) => partial(e, l, at, 440, 0.1, 0.6);
