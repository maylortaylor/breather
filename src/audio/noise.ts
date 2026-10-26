import { createRng, makeStereoNoise, type NoiseKind } from "./dsp";
import { connectOut, fadeIn, type Engine, type Sound } from "./engine";

const LOOP_SECONDS = 12;
const buffers = new WeakMap<AudioContext, Map<NoiseKind, AudioBuffer>>();

function noiseBuffer(ctx: AudioContext, kind: NoiseKind): AudioBuffer {
  let byKind = buffers.get(ctx);
  if (!byKind) buffers.set(ctx, (byKind = new Map()));
  let buf = byKind.get(kind);
  if (!buf) {
    const seed = () => createRng(Math.floor(Math.random() * 2 ** 32));
    const [left, right] = makeStereoNoise(kind, ctx.sampleRate, LOOP_SECONDS, seed(), seed());
    buf = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buf.copyToChannel(left, 0);
    buf.copyToChannel(right, 1);
    byKind.set(kind, buf);
  }
  return buf;
}

function loopSource(ctx: AudioContext, kind: NoiseKind): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, kind);
  src.loop = true;
  return src;
}

/** Stop a set of nodes after a short fade so stopping never clicks. */
function fadeAndStop(ctx: AudioContext, fade: GainNode, sources: AudioScheduledSourceNode[]): void {
  const t = ctx.currentTime;
  fade.gain.cancelScheduledValues(t);
  fade.gain.setTargetAtTime(0, t, 0.05);
  for (const s of sources) s.stop(t + 0.4);
}

export function noiseSound(engine: Engine, kind: NoiseKind, layer: string): Sound {
  let active: { fade: GainNode; sources: AudioScheduledSourceNode[] } | null = null;
  return {
    start() {
      if (active) return;
      const { ctx } = engine;
      const src = loopSource(ctx, kind);
      const fade = ctx.createGain();
      src.connect(fade);
      connectOut(engine, fade, layer);
      fadeIn(ctx, fade);
      src.start();
      active = { fade, sources: [src] };
    },
    stop() {
      if (!active) return;
      fadeAndStop(engine.ctx, active.fade, active.sources);
      active = null;
    },
  };
}

/**
 * Waves: pink noise through a lowpass whose cutoff and level follow two slow LFOs (8 to 14 s per
 * swell), plus a faint highpassed hiss that only opens near the crest.
 */
export function oceanSound(engine: Engine, layer: string): Sound {
  let active: { fade: GainNode; sources: AudioScheduledSourceNode[] } | null = null;
  return {
    start() {
      if (active) return;
      const { ctx } = engine;
      const fade = ctx.createGain();
      const sources: AudioScheduledSourceNode[] = [];
      const period = () => 8 + Math.random() * 6;

      const body = loopSource(ctx, "pink");
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 450;
      lowpass.Q.value = 0.4;
      const swell = ctx.createGain();
      swell.gain.value = 0.55;
      body.connect(lowpass).connect(swell).connect(fade);

      const hiss = loopSource(ctx, "white");
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 2500;
      const hissCap = ctx.createBiquadFilter();
      hissCap.type = "lowpass";
      hissCap.frequency.value = 6000;
      const crest = ctx.createGain();
      crest.gain.value = 0.015;
      hiss.connect(highpass).connect(hissCap).connect(crest).connect(fade);

      // Main swell LFO and a second, slower-drifting one so the pattern does not repeat exactly.
      const lfo = (hz: number, depth: number, target: AudioParam) => {
        const osc = ctx.createOscillator();
        osc.frequency.value = hz;
        const amount = ctx.createGain();
        amount.gain.value = depth;
        osc.connect(amount).connect(target);
        sources.push(osc);
        osc.start();
      };
      const p1 = period();
      const p2 = period();
      lfo(1 / p1, 350, lowpass.frequency);
      lfo(1 / p2, 120, lowpass.frequency);
      lfo(1 / p1, 0.35, swell.gain);
      lfo(1 / p1, 0.015, crest.gain);

      connectOut(engine, fade, layer);
      fadeIn(ctx, fade);
      body.start();
      hiss.start();
      active = { fade, sources: [body, hiss, ...sources] };
    },
    stop() {
      if (!active) return;
      fadeAndStop(engine.ctx, active.fade, active.sources);
      active = null;
    },
  };
}
