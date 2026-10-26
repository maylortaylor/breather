import { describe, expect, it } from "vite-plus/test";
import { clampPeriod, createLfoBank, DEFAULT_LFOS, MAX_PERIOD, MIN_PERIOD, modGain } from "./lfo";
import { createRng } from "./dsp";

const make = (period: number, shape: "sine" | "smooth-random", seed = 1) =>
  createLfoBank([{ period, shape, color: "#fff" }], createRng(seed)).lfos[0]!;

describe("clampPeriod", () => {
  it("never goes faster than 8 s or slower than 120 s", () => {
    expect(MIN_PERIOD).toBe(8);
    expect(MAX_PERIOD).toBe(120);
    expect(clampPeriod(0.5)).toBe(8);
    expect(clampPeriod(7.99)).toBe(8);
    expect(clampPeriod(8)).toBe(8);
    expect(clampPeriod(45)).toBe(45);
    expect(clampPeriod(120)).toBe(120);
    expect(clampPeriod(5000)).toBe(120);
  });

  it("falls back to the minimum for NaN", () => {
    expect(clampPeriod(Number.NaN)).toBe(8);
  });

  it("is applied when an LFO is created and when its period is set", () => {
    const fast = make(1, "sine");
    expect(fast.period).toBe(8);
    fast.setPeriod(9999);
    expect(fast.period).toBe(120);
  });
});

describe("defaults", () => {
  it("are 20 s sine, 45 s sine and 90 s smooth random, in three distinct colors", () => {
    expect(DEFAULT_LFOS.map((l) => [l.period, l.shape])).toEqual([
      [20, "sine"],
      [45, "sine"],
      [90, "smooth-random"],
    ]);
    expect(new Set(DEFAULT_LFOS.map((l) => l.color)).size).toBe(3);
  });
});

describe("sine LFO", () => {
  it("starts at 1, hits 0 at half a period and returns to 1 after a full period", () => {
    const lfo = make(20, "sine");
    expect(lfo.value(0)).toBeCloseTo(1, 9);
    expect(lfo.value(10)).toBeCloseTo(0, 9);
    expect(lfo.value(20)).toBeCloseTo(1, 9);
    expect(lfo.value(25)).toBeCloseTo(0.5, 9);
  });

  it("stays inside [0, 1]", () => {
    const lfo = make(8, "sine");
    for (let t = 0; t < 100; t += 0.37) {
      const v = lfo.value(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("keeps its phase when the period changes, so the output does not jump", () => {
    const lfo = make(20, "sine");
    const before = lfo.value(7);
    lfo.setPeriod(90);
    const after = lfo.value(7);
    expect(after).toBeCloseTo(before, 9);
    // The new period now governs the speed: a quarter of 90 s moves a quarter of the way on.
    const phaseBefore = lfo.phase;
    lfo.value(7 + 22.5);
    expect(lfo.phase - phaseBefore).toBeCloseTo(0.25, 9);
  });

  it("ignores time running backwards", () => {
    const lfo = make(20, "sine");
    const a = lfo.value(5);
    expect(lfo.value(3)).toBeCloseTo(a, 9);
  });
});

describe("smooth-random LFO", () => {
  it("stays in [0, 1] and actually wanders", () => {
    const lfo = make(8, "smooth-random", 3);
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 600; t += 0.05) {
      const v = lfo.value(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(hi - lo).toBeGreaterThan(0.6);
  });

  it("is continuous: no step above 0.0005 per ms even at the fastest period", () => {
    const lfo = make(8, "smooth-random", 7);
    let prev = lfo.value(0);
    let worst = 0;
    for (let ms = 1; ms <= 120_000; ms++) {
      const v = lfo.value(ms / 1000);
      worst = Math.max(worst, Math.abs(v - prev));
      prev = v;
    }
    expect(worst).toBeLessThan(0.0005);
  });

  it("is repeatable per seed and differs between seeds", () => {
    const run = (seed: number) => {
      const lfo = make(20, "smooth-random", seed);
      return [0, 5, 10, 30, 60].map((t) => lfo.value(t));
    };
    expect(run(4)).toEqual(run(4));
    expect(run(4)).not.toEqual(run(5));
  });

  it("can switch shape without a jump", () => {
    const lfo = make(20, "sine");
    const before = lfo.value(4);
    lfo.setShape("smooth-random");
    expect(lfo.shape).toBe("smooth-random");
    const after = lfo.value(4);
    expect(Math.abs(after - before)).toBeLessThan(0.5);
  });
});

describe("createLfoBank", () => {
  it("samples all LFOs at once and decorrelates the random ones", () => {
    const bank = createLfoBank(
      [
        { period: 8, shape: "smooth-random", color: "#a" },
        { period: 8, shape: "smooth-random", color: "#b" },
        { period: 20, shape: "sine", color: "#c" },
      ],
      createRng(9)
    );
    bank.sample(0);
    const v = bank.sample(30);
    expect(v).toHaveLength(3);
    expect(v[0]).not.toBe(v[1]);
    expect(v[2]).toBeCloseTo(0.5 + 0.5 * Math.cos(2 * Math.PI * 1.5), 9);
  });
});

describe("modGain", () => {
  it("is 1 at depth 0 whatever the LFO does", () => {
    for (const v of [0, 0.3, 1]) expect(modGain(0, v)).toBe(1);
  });

  it("is 1 - depth * (1 - value)", () => {
    expect(modGain(1, 0)).toBe(0);
    expect(modGain(1, 1)).toBe(1);
    expect(modGain(0.5, 0)).toBe(0.5);
    expect(modGain(0.5, 0.5)).toBe(0.75);
    expect(modGain(0.8, 0.25)).toBeCloseTo(0.4, 12);
  });

  it("never goes negative or above 1, even for out-of-range inputs", () => {
    expect(modGain(2, -1)).toBe(0);
    expect(modGain(-1, 0)).toBe(1);
    expect(modGain(1, 5)).toBe(1);
  });
});
