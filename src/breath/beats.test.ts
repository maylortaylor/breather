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
    mix: {
      ...DEFAULT_STATE.mix,
      tempo,
      metronome: { level, voice, phaseSound: "tones", phaseVolume: 0.7 },
    },
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

describe("hidden page", () => {
  it("hands out beats 2 s ahead while hidden, so a 1 s tick misses none", () => {
    const fake = createFakeEngine();
    let t = 0;
    let hidden = true;
    const store = createStore<AppState>({ ...DEFAULT_STATE });
    const machine = createPhaseMachine(1);
    machine.start(0);
    let tick: () => void = () => {};
    startBeats({
      machine,
      clock: () => t,
      engine: fake.engine,
      store,
      every: (fn) => {
        tick = fn;
        return () => {};
      },
      hidden: () => hidden,
      vibrate: null,
    });
    // Hidden: ticks one second apart, as a throttled tab delivers them.
    for (t = 0; t <= 4; t += 1) tick();
    const hiddenHandedOut = fake.oscillators.length;
    expect(hiddenHandedOut).toBeGreaterThan(0);
    hidden = false;
    tick();
    // Visible again: no doubled beat at the switch.
    const after = fake.oscillators.length;
    expect(after).toBeLessThanOrEqual(hiddenHandedOut + 2);
  });
});

describe("phase volume", () => {
  it("scales the phase tones alone: unity at 0.7, silent at 0, boosted above", () => {
    const s = setup(LEVEL_D1);
    const trimOfLast = (id: string) => s.trims.filter(([t]) => t === id).at(-1)![1];
    const base = trimOfLast("phase-inhale-rising");
    s.store.set((st) => ({
      mix: { ...st.mix, metronome: { ...st.mix.metronome, phaseVolume: 0 } },
    }));
    expect(trimOfLast("phase-inhale-rising")).toBe(0);
    s.store.set((st) => ({
      mix: { ...st.mix, metronome: { ...st.mix.metronome, phaseVolume: 1 } },
    }));
    expect(trimOfLast("phase-inhale-rising")).toBeCloseTo(base / 0.7, 6);
    expect(trimOfLast("metro-wood-block")).toBe(0);
  });
});

describe("phase sound", () => {
  it("plays the chosen set's phase tone, not the rising tones", () => {
    const s = setup(LEVEL_D1);
    s.store.set((st) => ({
      mix: {
        ...st.mix,
        metronome: { ...st.mix.metronome, phaseSound: "bowl" },
      },
    }));
    s.run(4.2);
    expect(fed(s.fake, "phase-bowl-inhale")).toBe(2);
    expect(fed(s.fake, "phase-bowl-hold")).toBe(2);
    expect(fed(s.fake, "phase-inhale-rising")).toBe(0);
  });
});

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
      mix: {
        ...s.store.get().mix,
        metronome: { level: 1, voice: "metro-wood-block", phaseSound: "tones", phaseVolume: 0.7 },
      },
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
    expect(s.fake.calls.filter((c) => c.startsWith("silence phase-")).length).toBe(9);
    const before = s.fake.oscillators.length;
    s.run(8);
    expect(s.fake.oscillators.length).toBe(before);
    s.machine.resume(s.now());
    s.store.set({ paused: false });
    expect(s.fake.calls.filter((c) => /^layer phase-\S+ 0\.8 over 0\.05$/.test(c)).length).toBe(9);
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

// A rig with a stub vibrate and a timer queue driven by the same fake clock as the beats.
function rig(opts: { vibrate?: boolean; tempo?: number } = {}) {
  const fake = createFakeEngine();
  let t = 0;
  const pulses: number[] = [];
  const jobs: { at: number; fn: () => void; live: boolean }[] = [];
  const store = createStore<AppState>({
    ...DEFAULT_STATE,
    mix: { ...DEFAULT_STATE.mix, tempo: opts.tempo ?? 0.5 },
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
    vibrate: opts.vibrate === false ? null : () => void pulses.push(Math.round(t * 1000) / 1000),
    later(fn, ms) {
      const job = { at: t + ms / 1000, fn, live: true };
      jobs.push(job);
      return () => void (job.live = false);
    },
  });
  const run = (to: number) => {
    while (t < to) {
      tick();
      t = Math.round((t + 0.025) * 1000) / 1000;
      for (const job of jobs) {
        if (job.live && job.at <= t + 1e-9) {
          job.live = false;
          job.fn();
        }
      }
    }
  };
  return { store, machine, pulses, run, stop, now: () => t };
}

describe("seconds mode", () => {
  it("runs inhale, hold and exhale for 4, 7 and 8 s whatever the tempo says", () => {
    for (const tempo of [0, 0.5, 1]) {
      const s = rig({ tempo });
      s.store.set({ secondsMode: true });
      const starts = s.machine
        .beatsBetween(0, 19)
        .filter((b) => b.phaseStart)
        .map((b) => [b.phase, Math.round(b.at * 1000) / 1000]);
      expect(starts).toEqual([
        ["inhale", 0],
        ["hold", 4],
        ["exhale", 11],
      ]);
      expect(s.machine.beatsBetween(0, 19)).toHaveLength(19);
    }
  });

  it("returns to the slider tempo without moving the ring", () => {
    const s = rig({ tempo: 1 });
    s.store.set({ secondsMode: true });
    s.run(2.5);
    const before = s.machine.stateAt(s.now());
    s.store.set({ secondsMode: false });
    const after = s.machine.stateAt(s.now());
    expect(after.beat).toBe(before.beat);
    expect(after.phase).toBe(before.phase);
    expect(after.progress).toBeCloseTo(before.progress, 9);
    // Slider at 1 is 80 BPM: 0.75 s a beat from here.
    const [a, b] = s.machine.beatsBetween(s.now(), s.now() + 3);
    expect(b!.at - a!.at).toBeCloseTo(0.75, 9);
  });

  it("ticks once a second at the same detent level", () => {
    const fake = createFakeEngine();
    let t = 0;
    const store = createStore<AppState>({
      ...DEFAULT_STATE,
      secondsMode: true,
      mix: {
        ...DEFAULT_STATE.mix,
        tempo: 1,
        metronome: {
          level: 0.4,
          voice: "metro-wood-block",
          phaseSound: "tones",
          phaseVolume: 0.7,
        },
      },
    });
    const machine = createPhaseMachine(1);
    machine.start(0);
    let tick: () => void = () => {};
    startBeats({
      machine,
      clock: () => t,
      engine: fake.engine,
      store,
      every: (fn) => {
        tick = fn;
        return () => {};
      },
      vibrate: null,
    });
    while (t < 3.01) {
      tick();
      t = Math.round((t + 0.025) * 1000) / 1000;
    }
    // Beats 1, 2 and 3 are plain ticks; beat 0 is the inhale tone. Tempo 1 would have given 4+.
    expect(fed(fake, "metro-wood-block")).toBe(3 * 2);
  });
});

describe("haptics", () => {
  it("pulses once per phase change over a cycle, on the beat", () => {
    const s = rig();
    s.run(19.2);
    expect(s.pulses).toHaveLength(4); // inhale, hold, exhale, then the next inhale at 19 s
    expect(s.pulses[0]).toBeCloseTo(0, 1);
    expect(s.pulses[1]).toBeCloseTo(4, 1);
    expect(s.pulses[2]).toBeCloseTo(11, 1);
    expect(s.pulses[3]).toBeCloseTo(19, 1);
  });

  it("follows seconds mode: phase changes land at 4 and 11 s", () => {
    const s = rig({ tempo: 1 });
    s.store.set({ secondsMode: true });
    s.run(12);
    expect(s.pulses.slice(0, 3).map(Math.round)).toEqual([0, 4, 11]);
  });

  it("stays quiet while paused, and when the guide resumes it pulses again", () => {
    const s = rig();
    s.run(3.9);
    s.machine.pause(s.now());
    s.store.set({ paused: true });
    s.run(15);
    expect(s.pulses).toHaveLength(1);
    s.machine.resume(s.now());
    s.store.set({ paused: false });
    s.run(16);
    expect(s.pulses).toHaveLength(2);
  });

  it("does nothing, and shows nothing, when vibrate is absent", () => {
    const s = rig({ vibrate: false });
    expect(() => s.run(12)).not.toThrow();
    expect(s.pulses).toHaveLength(0);
  });

  it("sends no pulse at all while the metronome is off, and resumes when it is raised", () => {
    const s = rig();
    const set = (level: number) =>
      s.store.set((st) => ({
        mix: { ...st.mix, metronome: { ...st.mix.metronome, level } },
      }));
    set(0);
    s.run(12);
    expect(s.pulses).toHaveLength(0);
    set(LEVEL_D1);
    s.run(30);
    expect(s.pulses.length).toBeGreaterThan(0);
  });

  it("sends no pulse while Vibrate on phase change is unchecked", () => {
    const s = rig();
    s.store.set({ vibrate: false });
    s.run(12);
    expect(s.pulses).toHaveLength(0);
    s.store.set({ vibrate: true });
    s.run(30);
    expect(s.pulses.length).toBeGreaterThan(0);
  });

  it("drops a pulse already queued when the metronome goes off", () => {
    const s = rig();
    s.run(3.95);
    expect(s.pulses).toHaveLength(1);
    s.store.set((st) => ({
      mix: { ...st.mix, metronome: { ...st.mix.metronome, level: 0 } },
    }));
    s.run(5);
    expect(s.pulses).toHaveLength(1);
  });

  it("drops queued pulses when torn down", () => {
    const s = rig();
    s.run(3.95);
    s.stop();
    s.run(5);
    expect(s.pulses).toHaveLength(1);
  });
});
