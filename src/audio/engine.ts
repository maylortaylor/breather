import { createRng, makeImpulse, sliderToGain } from "./dsp";

const MASTER_CAP = 0.15;
const REVERB_SECONDS = 4;
/** Default slider position for every layer. */
export const DEFAULT_LAYER = 0.3;
export const FADE_IN_SEC = 1.5;

export interface Engine {
  ctx: AudioContext;
  /** Input of the shared reverb. Feed it through a send gain. */
  reverbSend: GainNode;
  /** Where a sound plugs into its named layer (the modulation stage), created on first use. */
  layer(name: string): GainNode;
  /** Modulation multiplier for a layer, 1 = unchanged. Smoothed, so a 50 ms update rate is click-free. */
  setMod(name: string, value: number): void;
  /** Let a layer's reverb send follow the same modulation as its dry signal. */
  addWetMod(name: string, node: GainNode): void;
  /** Drop a wet node registered with `addWetMod`, so the list never outgrows the sounds playing. */
  removeWetMod(name: string, node: GainNode): void;
  setMaster(value: number): void;
  /** Set a layer's slider level. With `glideSec` the gain ramps there linearly instead of snapping. */
  setLayer(name: string, value: number, glideSec?: number): void;
  /** Ramp a layer to exact silence over `seconds`, so a sound can stop without a cut. */
  silenceLayer(name: string, seconds: number): void;
  /** Per-sound level match, multiplied into the layer gain. */
  setTrim(name: string, trim: number): void;
}

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

  // layer = sound -> mod (LFO) -> gain (slider x trim) -> master
  interface Layer {
    mod: GainNode;
    gain: GainNode;
    wets: GainNode[];
  }
  const layers = new Map<string, Layer>();
  const trims = new Map<string, number>();
  const levels = new Map<string, number>();
  const stage = (name: string): Layer => {
    let l = layers.get(name);
    if (!l) {
      const gain = ctx.createGain();
      gain.gain.value = sliderToGain(DEFAULT_LAYER) * (trims.get(name) ?? 1);
      gain.connect(master);
      const mod = ctx.createGain();
      mod.connect(gain);
      l = { mod, gain, wets: [] };
      layers.set(name, l);
    }
    return l;
  };
  const layer = (name: string) => stage(name).mod;

  const ramp = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, 0.02);

  const glide = (param: AudioParam, value: number, seconds: number) => {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + seconds);
  };

  return {
    ctx,
    reverbSend,
    layer,
    setMod: (name, value) => {
      const l = stage(name);
      const t = ctx.currentTime;
      l.mod.gain.setTargetAtTime(value, t, 0.05);
      for (const w of l.wets) w.gain.setTargetAtTime(value, t, 0.05);
    },
    addWetMod: (name, node) => {
      stage(name).wets.push(node);
    },
    removeWetMod: (name, node) => {
      const l = stage(name);
      const i = l.wets.indexOf(node);
      if (i >= 0) l.wets.splice(i, 1);
    },
    setMaster: (v) => ramp(master.gain, sliderToGain(v) * MASTER_CAP),
    setLayer: (name, v, glideSec) => {
      levels.set(name, v);
      const target = sliderToGain(v) * (trims.get(name) ?? 1);
      const param = stage(name).gain.gain;
      if (glideSec === undefined || glideSec <= 0) return ramp(param, target);
      glide(param, target, glideSec);
    },
    silenceLayer: (name, seconds) => glide(stage(name).gain.gain, 0, seconds),
    setTrim: (name, trim) => {
      trims.set(name, trim);
      ramp(stage(name).gain.gain, sliderToGain(levels.get(name) ?? DEFAULT_LAYER) * trim);
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

/** Releases what one `connectOut` made: its layer link, send and wet nodes, and wet-list entry. */
export type Disposer = () => void;

const quietly = (fn: () => void) => {
  try {
    fn();
  } catch {
    // Already disconnected: nothing left to release.
  }
};

/**
 * Route a node to a layer, plus an optional share to the reverb. The disposer releases every node
 * the call made; call it when the sound has stopped or the one-shot has ended.
 */
export function connectOut(engine: Engine, node: AudioNode, layer: string, reverb = 0): Disposer {
  const target = engine.layer(layer);
  node.connect(target);
  let send: GainNode | null = null;
  let wet: GainNode | null = null;
  if (reverb > 0) {
    send = engine.ctx.createGain();
    send.gain.value = reverb;
    wet = engine.ctx.createGain();
    node.connect(send).connect(wet).connect(engine.reverbSend);
    engine.addWetMod(layer, wet);
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    quietly(() => node.disconnect(target));
    if (send && wet) {
      engine.removeWetMod(layer, wet);
      quietly(() => node.disconnect(send));
      quietly(() => send.disconnect());
      quietly(() => wet.disconnect());
    }
  };
}
