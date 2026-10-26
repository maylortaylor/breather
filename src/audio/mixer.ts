// Drives the approved engine from a `Mix`: starts, stops and glides loops. `diffMix` is pure.
import { LOOP_IDS, type LoopId, type Mix, type SoundSetting } from "../presets";
import { CATALOG } from "./catalog";
import type { Engine, Sound } from "./engine";
import type { Modulator } from "./modulation";

type SoundMap = Mix["sounds"];

export interface MixDiff {
  start: LoopId[];
  stop: LoopId[];
  change: LoopId[];
}

/** With no LFO the level is `max`, so `min` cannot change what is heard. */
const same = (a: SoundSetting, b: SoundSetting): boolean =>
  a.lfo === b.lfo && a.max === b.max && (a.lfo === 0 || a.min === b.min);

/** Which sounds start, stop, or change level or LFO between two mixes. Ids follow catalog order. */
export function diffMix(prev: Pick<Mix, "sounds"> | null, next: Pick<Mix, "sounds">): MixDiff {
  const before: SoundMap = prev?.sounds ?? {};
  const diff: MixDiff = { start: [], stop: [], change: [] };
  for (const id of LOOP_IDS) {
    const was = before[id];
    const now = next.sounds[id];
    if (!was && now) diff.start.push(id);
    else if (was && !now) diff.stop.push(id);
    else if (was && now && !same(was, now)) diff.change.push(id);
  }
  return diff;
}

export interface Mixer {
  /** Make the engine match `mix`. Levels glide and new sounds fade in; removed sounds fade out. */
  apply(mix: Mix, opts: { fadeSec: number }): void;
  setMaster(value: number): void;
  /** Fade everything out, then stop it. */
  stopAll(fadeSec: number): void;
  /** Loops that are in the mix right now, not counting ones that are fading out. */
  playing(): LoopId[];
}

export interface MixerDeps {
  makeSound?: (id: LoopId) => Sound;
  /** Run `fn` after `ms`; returns a canceller. Injected so tests need no real clock. */
  after?: (ms: number, fn: () => void) => () => void;
}

/** The stop waits a beat past the fade so the gain ramp has landed on silence first. */
const STOP_MARGIN_MS = 50;

interface Running {
  sound: Sound;
  setting: SoundSetting;
  /** Set while the sound fades out; calling it keeps the sound playing. */
  cancelStop: (() => void) | null;
}

type MixerModulator = Pick<Modulator, "setRow" | "setPeriod" | "setShape" | "bank">;

export function createMixer(
  engine: Engine,
  modulator: MixerModulator,
  deps: MixerDeps = {}
): Mixer {
  const makeSound =
    deps.makeSound ??
    ((id: LoopId): Sound => {
      const entry = CATALOG.find((e) => e.id === id);
      if (!entry || !("loop" in entry)) throw new Error(`No loop called ${id}`);
      return entry.loop(engine);
    });
  const after =
    deps.after ??
    ((ms: number, fn: () => void) => {
      const handle = setTimeout(fn, ms);
      return () => clearTimeout(handle);
    });

  const sounds = new Map<LoopId, Sound>();
  const running = new Map<LoopId, Running>();

  const setRow = (id: LoopId, s: SoundSetting) => modulator.setRow(id, { ...s });

  function begin(id: LoopId, setting: SoundSetting, fadeSec: number): void {
    setRow(id, setting);
    const held = running.get(id);
    if (held) {
      // It was fading out: keep it going and bring the level back.
      held.cancelStop?.();
      held.cancelStop = null;
      held.setting = setting;
      engine.setLayer(id, setting.max, fadeSec);
      return;
    }
    let sound = sounds.get(id);
    if (!sound) sounds.set(id, (sound = makeSound(id)));
    engine.setLayer(id, setting.max);
    sound.start();
    running.set(id, { sound, setting, cancelStop: null });
  }

  function fadeOut(id: LoopId, fadeSec: number): void {
    const held = running.get(id);
    if (!held || held.cancelStop) return;
    engine.silenceLayer(id, fadeSec);
    held.cancelStop = after(fadeSec * 1000 + STOP_MARGIN_MS, () => {
      held.sound.stop();
      running.delete(id);
      // Quiet the modulator for a sound that is no longer playing.
      setRow(id, { ...held.setting, lfo: 0 });
    });
  }

  const active = (): LoopId[] => LOOP_IDS.filter((id) => running.get(id)?.cancelStop === null);

  return {
    apply(mix, { fadeSec }) {
      mix.lfos.forEach((l, i) => {
        const have = modulator.bank.lfos[i];
        if (have && have.period !== l.period) modulator.setPeriod(i, l.period);
        if (have && have.shape !== l.shape) modulator.setShape(i, l.shape);
      });
      const prev: Pick<Mix, "sounds"> = { sounds: {} };
      for (const id of active()) prev.sounds[id] = running.get(id)!.setting;
      const diff = diffMix(prev, mix);
      for (const id of diff.stop) fadeOut(id, fadeSec);
      for (const id of diff.start) begin(id, { ...mix.sounds[id]! }, fadeSec);
      for (const id of diff.change) {
        const setting = { ...mix.sounds[id]! };
        running.get(id)!.setting = setting;
        setRow(id, setting);
        engine.setLayer(id, setting.max, fadeSec);
      }
    },
    setMaster: (value) => engine.setMaster(value),
    stopAll(fadeSec) {
      for (const id of [...running.keys()]) fadeOut(id, fadeSec);
    },
    playing: active,
  };
}
