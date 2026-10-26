import { describe, expect, it, vi } from "vitest";
import { createFakeEngine } from "../audio/fakeAudio";
import type { Mix } from "../presets";
import { createStore, DEFAULT_STATE, type AppState } from "../store";
import { startBeats } from "./beats";
import { createPhaseMachine } from "./phases";

const LEVEL_D1 = 0.2;
const LEVEL_D2 = 0.4;

function setup(level: number, tempo = 0.5, voice: Mix["metronome"]["voice"] = "metro-wood-block") {
  const fake = createFakeEngine();
  const trims: [string, number][] = [];
  fake.engine.setTrim = (id: string, v: number) => void trims.push([id, v]);
  let t = 0;
  const store = createStore<AppState>({
    ...DEFAULT_STATE,
    mix: { ...DEFAULT_STATE.mix, tempo, metronome: { level, voice } },
  });
  const machine = createPhaseMachine(1);
  machine.start(0);
  let tick: () => void = () => {};
  const stop = startBeats({
    machine,
    clock: () => t,
    engine: fake.engine,
    store,
    every: (fn) => {
      tick = fn;
      return () => {};
    },
  });
  // Ticks every 25 ms of fake time up to `to`.
  const run = (to: number) => {
    while (t < to) {
      tick();
      t = Math.round((t + 0.025) * 1000) / 1000;
    }
    tick();
  };
  return { fake, store, machine, trims, run, stop, now: () => t };
}

const fed = (f: ReturnType<typeof createFakeEngine>, layer: string) => f.feeding(layer).length;

describe("startBeats", () => {
  it("plays the phase tone alone on a phase change, then the voice on the other beats", () => {
    const s = setup(LEVEL_D2);
    s.run(0.01);
    expect(fed(s.fake, "phase-inhale-rising")).toBe(2);
    expect(fed(s.fake, "metro-wood-block")).toBe(0);
    s.run(1.0);
    expect(fed(s.fake, "metro-wood-block")).toBe(2);
    expect(fed(s.fake, "phase-inhale-rising")).toBe(2);
  });

  it("sounds only phase tones at detent 1", () => {
    const s = setup(LEVEL_D1);
    s.run(11.05);
    expect(fed(s.fake, "phase-inhale-rising")).toBe(2);
    expect(fed(s.fake, "phase-hold-steady")).toBe(2);
    expect(fed(s.fake, "phase-exhale-falling")).toBe(2);
    expect(fed(s.fake, "metro-wood-block")).toBe(0);
  });

  it("is silent at level 0", () => {
    const s = setup(0);
    s.run(12);
    expect(s.fake.oscillators.length).toBe(0);
  });

  it("plays the stored voice", () => {
    const s = setup(LEVEL_D2, 0.5, "metro-heartbeat-thump");
    s.run(1.0);
    expect(fed(s.fake, "metro-heartbeat-thump")).toBe(2);
    expect(fed(s.fake, "metro-wood-block")).toBe(0);
  });

  it("sets layer trims from the metronome gains", () => {
    const s = setup(LEVEL_D2);
    const wood = () => s.trims.filter(([id]) => id === "metro-wood-block").at(-1)![1];
    const thump = s.trims.filter(([id]) => id === "metro-heartbeat-thump").at(-1)![1];
    const quiet = wood();
    expect(quiet).toBeGreaterThan(0);
    expect(thump).toBe(0);
    s.store.set({
      mix: { ...s.store.get().mix, metronome: { level: 1, voice: "metro-wood-block" } },
    });
    expect(wood()).toBeGreaterThan(quiet);
  });

  it("changes tempo through the machine without moving the ring", () => {
    const s = setup(LEVEL_D2);
    s.run(2.0);
    const before = s.machine.stateAt(s.now());
    s.store.set({ mix: { ...s.store.get().mix, tempo: 1 } });
    const after = s.machine.stateAt(s.now());
    expect(after.beat).toBe(before.beat);
    expect(after.progress).toBeCloseTo(before.progress, 9);
    // 80 BPM: a beat every 0.75 s from now on.
    const beats = s.machine.beatsBetween(s.now(), s.now() + 2).map((b) => b.at);
    expect(beats[1]! - beats[0]!).toBeCloseTo(0.75, 9);
  });

  it("uses one-second beats in seconds mode", () => {
    const s = setup(LEVEL_D2, 1);
    s.store.set({ secondsMode: true });
    const [a, b] = s.machine.beatsBetween(s.now(), s.now() + 2.5);
    expect(b!.at - a!.at).toBeCloseTo(1, 9);
  });

  it("stops new beats on pause, fades the phase tones, and returns them on resume", () => {
    const s = setup(LEVEL_D2);
    s.run(0.5);
    s.machine.pause(s.now());
    s.store.set({ paused: true });
    expect(s.fake.calls.filter((c) => c.startsWith("silence phase-")).length).toBe(3);
    const before = s.fake.oscillators.length;
    s.run(8);
    expect(s.fake.oscillators.length).toBe(before);
    s.machine.resume(s.now());
    s.store.set({ paused: false });
    expect(s.fake.calls.filter((c) => /^layer phase-\S+ 0\.8 over 0\.05$/.test(c)).length).toBe(3);
    s.run(9.1);
    expect(s.fake.oscillators.length).toBeGreaterThan(before);
  });

  it("stops the timer and the store subscription when torn down", () => {
    const fake = createFakeEngine();
    const stopTimer = vi.fn();
    const store = createStore<AppState>({ ...DEFAULT_STATE });
    const machine = createPhaseMachine(1);
    const setBeat = vi.spyOn(machine, "setBeatSeconds");
    const stop = startBeats({
      machine,
      clock: () => 0,
      engine: fake.engine,
      store,
      every: () => stopTimer,
    });
    setBeat.mockClear();
    stop();
    expect(stopTimer).toHaveBeenCalledTimes(1);
    store.set({ mix: { ...store.get().mix, tempo: 1 } });
    expect(setBeat).not.toHaveBeenCalled();
  });
});
