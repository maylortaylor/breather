import { bubbleParams, createTriggerScheduler, whaleParams, type Rng } from "./dsp";
import { connectOut, type Engine, type Sound } from "./engine";

const TICK_MS = 50;
const LOOKAHEAD = 0.2;

/** Run a random-interval trigger on the audio clock, firing once right away so it can be heard. */
function randomTrigger(
  engine: Engine,
  minGap: number,
  maxGap: number,
  fire: (at: number) => void
): Sound {
  let timer: ReturnType<typeof setInterval> | null = null;
  const rng: Rng = Math.random;
  return {
    start() {
      if (timer) return;
      const scheduler = createTriggerScheduler({
        rng,
        now: () => engine.ctx.currentTime,
        minGap,
        maxGap,
        lookahead: LOOKAHEAD,
        fire,
      });
      fire(engine.ctx.currentTime + 0.1);
      timer = setInterval(() => scheduler.tick(), TICK_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

/** Fade a layer bus out so a call already in flight does not play on after Stop. */
function release(ctx: AudioContext, bus: GainNode | null): void {
  if (!bus) return;
  bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  setTimeout(() => bus.disconnect(), 1000);
}

/** Short sine blips with a quick upward glide and fast decay, lowpassed with a touch of reverb. */
export function bubblesSound(engine: Engine, layer: string): Sound {
  const { ctx } = engine;
  let out: GainNode | null = null;
  const blip = (at: number) => {
    if (!out) return;
    const p = bubbleParams(Math.random);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(p.startHz, at);
    osc.frequency.exponentialRampToValueAtTime(p.endHz, at + p.decay);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.5 * p.gain, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + p.decay);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + p.decay + 0.05);
  };
  const trigger = randomTrigger(engine, 0.25, 2.5, blip);
  return {
    start() {
      if (out) return;
      out = ctx.createGain();
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 3200;
      out.connect(lowpass);
      connectOut(engine, lowpass, layer, 0.3);
      trigger.start();
    },
    stop() {
      trigger.stop();
      release(ctx, out);
      out = null;
    },
  };
}

/** Sine and triangle voices with a slow glide and vibrato, bandpassed into a long reverb. */
export function whalesSound(engine: Engine, layer: string): Sound {
  const { ctx } = engine;
  let out: GainNode | null = null;
  const call = (at: number) => {
    if (!out) return;
    const p = whaleParams(Math.random);
    const end = at + p.duration;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.45, at + p.duration * 0.3);
    env.gain.linearRampToValueAtTime(0.0001, end);
    env.connect(out);

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = p.vibratoHz;
    vibrato.start(at);
    vibrato.stop(end);

    for (const [type, mult, level] of [
      ["sine", 1, 1],
      ["triangle", 2, 0.25],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(p.startHz * mult, at);
      osc.frequency.linearRampToValueAtTime(p.endHz * mult, end);
      const depth = ctx.createGain();
      depth.gain.value = p.vibratoDepthHz * mult;
      vibrato.connect(depth).connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(env);
      osc.start(at);
      osc.stop(end + 0.1);
    }
  };
  const trigger = randomTrigger(engine, 10, 28, call);
  return {
    start() {
      if (out) return;
      out = ctx.createGain();
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 320;
      band.Q.value = 0.7;
      out.connect(band);
      connectOut(engine, band, layer, 1.2);
      trigger.start();
    },
    stop() {
      trigger.stop();
      release(ctx, out);
      out = null;
    },
  };
}
