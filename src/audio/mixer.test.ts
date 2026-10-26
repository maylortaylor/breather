import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_INS, type LoopId, type Mix, type SoundSetting } from "../presets";
import { createFakeEngine } from "./fakeAudio";
import type { Sound } from "./engine";
import { createMixer, diffMix } from "./mixer";

const steady = (max: number): SoundSetting => ({ lfo: 0, min: max, max });
const mix = (sounds: Mix["sounds"], base: Mix = BUILT_INS[0]!.mix): Mix => ({ ...base, sounds });

describe("diffMix", () => {
  it("starts everything when there is no previous mix", () => {
    const d = diffMix(null, mix({ pink: steady(0.5), ocean: steady(0.4) }));
    expect(d).toEqual({ start: ["pink", "ocean"], stop: [], change: [] });
  });

  it("reports an added sound as a start only", () => {
    const d = diffMix(mix({ pink: steady(0.5) }), mix({ pink: steady(0.5), ocean: steady(0.4) }));
    expect(d).toEqual({ start: ["ocean"], stop: [], change: [] });
  });

  it("reports a removed sound as a stop only", () => {
    const d = diffMix(mix({ pink: steady(0.5), ocean: steady(0.4) }), mix({ pink: steady(0.5) }));
    expect(d).toEqual({ start: [], stop: ["ocean"], change: [] });
  });

  it("reports a level change", () => {
    const d = diffMix(mix({ pink: steady(0.5) }), mix({ pink: steady(0.6) }));
    expect(d).toEqual({ start: [], stop: [], change: ["pink"] });
  });

  it("reports an LFO change, and a changed LFO range", () => {
    const lfo = (n: 0 | 1 | 2 | 3, min = 0.2): SoundSetting => ({ lfo: n, min, max: 0.6 });
    expect(diffMix(mix({ ocean: lfo(0) }), mix({ ocean: lfo(2) })).change).toEqual(["ocean"]);
    expect(diffMix(mix({ ocean: lfo(1) }), mix({ ocean: lfo(3) })).change).toEqual(["ocean"]);
    expect(diffMix(mix({ ocean: lfo(1) }), mix({ ocean: lfo(1, 0.3) })).change).toEqual(["ocean"]);
  });

  it("reports nothing for identical mixes", () => {
    const m = mix({ pink: steady(0.5), ocean: { lfo: 2, min: 0.2, max: 0.6 } });
    expect(diffMix(m, structuredClone(m))).toEqual({ start: [], stop: [], change: [] });
  });

  it("ignores min when there is no LFO, since the level is max", () => {
    const a = mix({ pink: { lfo: 0, min: 0.1, max: 0.5 } });
    const b = mix({ pink: { lfo: 0, min: 0.4, max: 0.5 } });
    expect(diffMix(a, b).change).toEqual([]);
  });

  it("orders ids the way the catalog lists them", () => {
    const d = diffMix(
      null,
      mix({ "pad-deep": steady(0.2), white: steady(0.2), ocean: steady(0.2) })
    );
    expect(d.start).toEqual(["white", "ocean", "pad-deep"]);
  });
});

interface TestSound extends Sound {
  id: LoopId;
  starts: number;
  stops: number;
}

function setup() {
  const fake = createFakeEngine();
  const made: TestSound[] = [];
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  let now = 0;
  const modulator = {
    rows: [] as string[],
    bank: {
      lfos: [
        { period: 20, shape: "sine" },
        { period: 45, shape: "sine" },
        { period: 90, shape: "smooth-random" },
      ],
    },
    setRow(id: string, r: SoundSetting) {
      this.rows.push(`${id} ${r.lfo} ${r.min} ${r.max}`);
    },
    periods: [] as string[],
    setPeriod(i: number, p: number) {
      this.periods.push(`period ${i} ${p}`);
    },
    setShape(i: number, s: string) {
      this.periods.push(`shape ${i} ${s}`);
    },
  };
  const mixer = createMixer(fake.engine, modulator as never, {
    makeSound: (id) => {
      const s: TestSound = {
        id,
        starts: 0,
        stops: 0,
        start() {
          s.starts++;
        },
        stop() {
          s.stops++;
        },
      };
      made.push(s);
      return s;
    },
    after: (ms, fn) => {
      const t = { at: now + ms, fn, live: true };
      timers.push(t);
      return () => {
        t.live = false;
      };
    },
  });
  const advance = (ms: number) => {
    now += ms;
    for (const t of timers) {
      if (t.live && t.at <= now) {
        t.live = false;
        t.fn();
      }
    }
  };
  return { fake, made, mixer, modulator, advance };
}

describe("createMixer", () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it("starts each sound once, sets its row and level, and reports it as playing", () => {
    s.mixer.apply(mix({ pink: steady(0.5), ocean: { lfo: 2, min: 0.2, max: 0.6 } }), {
      fadeSec: 3,
    });
    expect(s.made.map((m) => [m.id, m.starts])).toEqual([
      ["pink", 1],
      ["ocean", 1],
    ]);
    expect(s.modulator.rows).toEqual(["pink 0 0.5 0.5", "ocean 2 0.2 0.6"]);
    expect(s.fake.calls).toEqual(["layer pink 0.5", "layer ocean 0.6"]);
    expect(s.mixer.playing()).toEqual(["pink", "ocean"]);
  });

  it("applying the same mix twice starts and stops nothing", () => {
    const m = mix({ pink: steady(0.5), "pad-tonal": steady(0.3) });
    s.mixer.apply(m, { fadeSec: 3 });
    const before = s.fake.calls.length;
    s.mixer.apply(structuredClone(m), { fadeSec: 3 });
    s.advance(10_000);
    expect(s.made).toHaveLength(2);
    expect(s.made.map((x) => [x.starts, x.stops])).toEqual([
      [1, 0],
      [1, 0],
    ]);
    expect(s.fake.calls).toHaveLength(before);
  });

  it("glides a changed sound over fadeSec instead of snapping", () => {
    s.mixer.apply(mix({ pink: steady(0.5) }), { fadeSec: 3 });
    s.fake.calls.length = 0;
    s.mixer.apply(mix({ pink: steady(0.7) }), { fadeSec: 3 });
    expect(s.fake.calls).toEqual(["layer pink 0.7 over 3"]);
    expect(s.made).toHaveLength(1);
  });

  it("fades a removed sound to silence, and only stops it after the fade", () => {
    s.mixer.apply(mix({ pink: steady(0.5), ocean: steady(0.4) }), { fadeSec: 3 });
    s.mixer.apply(mix({ pink: steady(0.5) }), { fadeSec: 3 });
    const ocean = s.made.find((m) => m.id === "ocean")!;
    expect(s.fake.calls).toContain("silence ocean over 3");
    expect(ocean.stops).toBe(0);
    expect(s.mixer.playing()).toEqual(["pink"]);
    s.advance(2900);
    expect(ocean.stops).toBe(0);
    s.advance(300);
    expect(ocean.stops).toBe(1);
    expect(s.made.find((m) => m.id === "pink")!.stops).toBe(0);
  });

  it("cancels the stop when a fading sound comes back", () => {
    s.mixer.apply(mix({ ocean: steady(0.4) }), { fadeSec: 3 });
    s.mixer.apply(mix({}), { fadeSec: 3 });
    s.advance(1000);
    s.mixer.apply(mix({ ocean: steady(0.5) }), { fadeSec: 3 });
    s.advance(10_000);
    const ocean = s.made[0]!;
    expect(ocean.starts).toBe(1);
    expect(ocean.stops).toBe(0);
    expect(s.fake.calls.at(-1)).toBe("layer ocean 0.5 over 3");
    expect(s.mixer.playing()).toEqual(["ocean"]);
  });

  it("restarts a sound that finished fading out", () => {
    s.mixer.apply(mix({ ocean: steady(0.4) }), { fadeSec: 1 });
    s.mixer.apply(mix({}), { fadeSec: 1 });
    s.advance(2000);
    s.mixer.apply(mix({ ocean: steady(0.4) }), { fadeSec: 1 });
    const ocean = s.made[0]!;
    expect([ocean.starts, ocean.stops]).toEqual([2, 1]);
    expect(s.made).toHaveLength(1);
  });

  it("stopAll fades everything and a later apply starts the mix again", () => {
    const m = mix({ pink: steady(0.5), ocean: steady(0.4) });
    s.mixer.apply(m, { fadeSec: 3 });
    s.mixer.stopAll(2);
    expect(s.mixer.playing()).toEqual([]);
    expect(s.fake.calls).toContain("silence pink over 2");
    expect(s.fake.calls).toContain("silence ocean over 2");
    s.advance(2200);
    expect(s.made.map((x) => x.stops)).toEqual([1, 1]);
    s.mixer.apply(m, { fadeSec: 3 });
    expect(s.made.map((x) => x.starts)).toEqual([2, 2]);
  });

  it("passes the master level to the engine", () => {
    s.mixer.setMaster(0.4);
    expect(s.fake.calls).toEqual(["master 0.4"]);
  });

  it("pushes LFO period and shape only when they differ from the bank", () => {
    const base = BUILT_INS[0]!.mix;
    const next: Mix = {
      ...base,
      lfos: [
        { period: 20, shape: "sine" },
        { period: 60, shape: "smooth-random" },
        { period: 90, shape: "smooth-random" },
      ],
    };
    s.mixer.apply(next, { fadeSec: 3 });
    expect(s.modulator.periods).toEqual(["period 1 60", "shape 1 smooth-random"]);
  });
});
