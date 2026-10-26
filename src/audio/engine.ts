import { createRng, makeImpulse } from "./dsp";

const MASTER_CAP = 0.8;
const REVERB_SECONDS = 4;
/** Default slider position for every layer. */
export const DEFAULT_LAYER = 0.3;
export const FADE_IN_SEC = 1.5;

export interface Engine {
  ctx: AudioContext;
  /** Input of the shared reverb. Feed it through a send gain. */
  reverbSend: GainNode;
  /** Gain feeding the master for one named layer, created on first use. */
  layer(name: string): GainNode;
  setMaster(value: number): void;
  setLayer(name: string, value: number): void;
  /** Per-sound level match, multiplied into the layer gain. */
  setTrim(name: string, trim: number): void;
}

/** Slider position (0 to 1) to gain. Squared so the low end has fine control. */
export const sliderToGain = (value: number): number => value * value;

/** Create the one shared context. Must be called from a user gesture (the Begin click). */
export function createEngine(): Engine {
  const ctx = new AudioContext();

  // layers -> master -> limiter -> output
  const master = ctx.createGain();
  master.gain.value = sliderToGain(0.7) * MASTER_CAP;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.005;
  limiter.release.value = 0.25;
  master.connect(limiter).connect(ctx.destination);

  // Shared reverb: generated impulse, returned into the master.
  const [left, right] = makeImpulse(ctx.sampleRate, REVERB_SECONDS, 2.5, createRng(42));
  const impulse = ctx.createBuffer(2, left.length, ctx.sampleRate);
  impulse.copyToChannel(left, 0);
  impulse.copyToChannel(right, 1);
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  const reverbSend = ctx.createGain();
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.4;
  reverbSend.connect(convolver).connect(reverbReturn).connect(master);

  const layers = new Map<string, GainNode>();
  const trims = new Map<string, number>();
  const levels = new Map<string, number>();
  const layer = (name: string) => {
    let node = layers.get(name);
    if (!node) {
      node = ctx.createGain();
      node.gain.value = sliderToGain(DEFAULT_LAYER) * (trims.get(name) ?? 1);
      node.connect(master);
      layers.set(name, node);
    }
    return node;
  };

  const ramp = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, 0.02);

  return {
    ctx,
    reverbSend,
    layer,
    setMaster: (v) => ramp(master.gain, sliderToGain(v) * MASTER_CAP),
    setLayer: (name, v) => {
      levels.set(name, v);
      ramp(layer(name).gain, sliderToGain(v) * (trims.get(name) ?? 1));
    },
    setTrim: (name, trim) => {
      trims.set(name, trim);
      ramp(layer(name).gain, sliderToGain(levels.get(name) ?? DEFAULT_LAYER) * trim);
    },
  };
}

/** A looping sound the Lab can start and stop. */
export interface Sound {
  start(): void;
  stop(): void;
}

/** Ramp a gain from silence to full over the start fade, so a loop never begins abruptly. */
export function fadeIn(ctx: AudioContext, gain: GainNode, seconds = FADE_IN_SEC): void {
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(1, t + seconds);
}

/** Route a node to a layer, plus an optional share to the reverb. */
export function connectOut(engine: Engine, node: AudioNode, layer: string, reverb = 0): void {
  node.connect(engine.layer(layer));
  if (reverb > 0) {
    const send = engine.ctx.createGain();
    send.gain.value = reverb;
    node.connect(send).connect(engine.reverbSend);
  }
}
