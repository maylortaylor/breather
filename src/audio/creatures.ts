import {
  bubbleParams,
  createBubbleScheduler,
  createTriggerScheduler,
  whalePlan,
  type TriggerScheduler,
} from "./dsp";
import { connectOut, fadeIn, type Disposer, type Engine, type Sound } from "./engine";

const TICK_MS = 50;
/** Seconds of triggers handed out ahead. A hidden or locked page ticks about once a second, so it
 * looks further ahead; otherwise late triggers would pile up and burst out together. */
const LOOKAHEAD = () => (typeof document !== "undefined" && document.hidden ? 3 : 0.2);

/** Drive a scheduler from a short timer. `kickoff` fires once right away so Play is audible. */
function ticking(make: () => TriggerScheduler, kickoff?: () => void): Sound {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    start() {
      if (timer) return;
      const scheduler = make();
      kickoff?.();
      timer = setInterval(() => scheduler.tick(), TICK_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

/** Fade a bus out so a sound already in flight does not play on after Stop. */
function release(ctx: AudioContext, bus: GainNode | null, dispose: Disposer | null): void {
  if (!bus) return;
  bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  setTimeout(() => {
    bus.disconnect();
    dispose?.();
  }, 1000);
}

/**
 * Irregular sine blips with a quick upward glide: mostly single, sometimes a small cluster, each
 * with its own size and a slight stereo pan. Lowpassed with a touch of reverb.
 */
export function bubblesSound(engine: Engine, layer: string): Sound {
  const { ctx } = engine;
  let out: GainNode | null = null;
  let disposeOut: Disposer | null = null;
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
    const pan = ctx.createStereoPanner();
    pan.pan.value = p.pan;
    osc.connect(env).connect(pan).connect(out);
    osc.start(at);
    osc.stop(at + p.decay + 0.05);
    osc.onended = () => pan.disconnect();
  };
  const trigger = ticking(() =>
    createBubbleScheduler({
      rng: Math.random,
      now: () => ctx.currentTime,
      lookahead: LOOKAHEAD,
      firstDelay: 0.3,
      fire: blip,
    })
  );
  return {
    start() {
      if (out) return;
      out = ctx.createGain();
      fadeIn(ctx, out);
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 3200;
      out.connect(lowpass);
      disposeOut = connectOut(engine, lowpass, layer, 0.3);
      trigger.start();
    },
    stop() {
      trigger.stop();
      release(ctx, out, disposeOut);
      out = null;
      disposeOut = null;
    },
  };
}

/**
 * One whale call from a plan: a slow glide on harmonic partials through a lowpass, swelling in and
 * out. Everything feeds the shared reverb.
 */
export function whaleSound(engine: Engine, layer: string): Sound {
  const { ctx } = engine;
  let out: GainNode | null = null;
  let disposeOut: Disposer | null = null;
  const call = (at: number) => {
    if (!out) return;
    const plan = whalePlan(Math.random);
    const end = at + plan.duration;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(plan.level, at + plan.duration * 0.3);
    env.gain.setValueAtTime(plan.level, at + plan.duration * 0.6);
    env.gain.linearRampToValueAtTime(0.0001, end);

    const mix = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = plan.lowpassHz;
    mix.connect(lp);
    lp.connect(env).connect(out);
    // The sends must see the same dark, enveloped signal.
    const send = ctx.createGain();
    send.gain.value = plan.reverb;
    env.connect(send).connect(engine.reverbSend);

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = plan.vibratoHz;
    vibrato.start(at);
    vibrato.stop(end + 0.1);
    // The call is silent by `end`; unhook its envelope and send so nothing lingers on the reverb.
    vibrato.onended = () => {
      env.disconnect();
      send.disconnect();
    };

    for (const { ratio, amp } of plan.partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      let t = at;
      osc.frequency.setValueAtTime((plan.segments[0]?.startHz ?? 100) * ratio, at);
      for (const seg of plan.segments) {
        t += seg.duration;
        osc.frequency.linearRampToValueAtTime(seg.endHz * ratio, t);
      }
      const depth = ctx.createGain();
      depth.gain.value = (plan.segments[0]?.startHz ?? 100) * ratio * plan.vibratoDepth;
      vibrato.connect(depth).connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.value = amp / plan.partials.length;
      osc.connect(g).connect(mix);
      osc.start(at);
      osc.stop(end + 0.1);
    }
  };
  const trigger = ticking(
    () =>
      createTriggerScheduler({
        rng: Math.random,
        now: () => ctx.currentTime,
        minGap: 15,
        maxGap: 40,
        lookahead: LOOKAHEAD,
        fire: call,
      }),
    // First call right away (inside the 2 s audition window), then long random gaps.
    () => call(ctx.currentTime + 0.3)
  );
  return {
    start() {
      if (out) return;
      out = ctx.createGain();
      fadeIn(ctx, out);
      disposeOut = connectOut(engine, out, layer);
      trigger.start();
    },
    stop() {
      trigger.stop();
      release(ctx, out, disposeOut);
      out = null;
      disposeOut = null;
    },
  };
}
