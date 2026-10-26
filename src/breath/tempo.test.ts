import { describe, expect, it } from "vitest";
import { CYCLE_BEATS } from "./phases";
import { beatSeconds, D1, D2, metronomeGains, sliderToBpm, snap } from "./tempo";

describe("sliderToBpm", () => {
  it("maps each half separately with the center at exactly 60", () => {
    expect(sliderToBpm(0)).toBe(40);
    expect(sliderToBpm(0.25)).toBe(50);
    expect(sliderToBpm(0.5)).toBe(60);
    expect(sliderToBpm(0.75)).toBe(70);
    expect(sliderToBpm(1)).toBe(80);
  });

  it("clamps values outside 0..1", () => {
    expect(sliderToBpm(-3)).toBe(40);
    expect(sliderToBpm(9)).toBe(80);
  });
});

describe("beatSeconds", () => {
  it("gives a cycle of about 28.5 s at the slow end and 14.25 s at the fast end", () => {
    expect(beatSeconds(0, false) * CYCLE_BEATS).toBeCloseTo(28.5, 6);
    expect(beatSeconds(1, false) * CYCLE_BEATS).toBeCloseTo(14.25, 6);
    expect(beatSeconds(0.5, false)).toBe(1);
  });

  it("is one second in seconds mode whatever the slider says", () => {
    expect(beatSeconds(0, true)).toBe(1);
    expect(beatSeconds(1, true)).toBe(1);
  });
});

describe("snap", () => {
  it("returns the detent when the value is within the radius", () => {
    expect(snap(0.52, [D1, 0.5], 0.03)).toBe(0.5);
    expect(snap(0.48, [0.5], 0.03)).toBe(0.5);
    expect(snap(0.5, [0.5], 0.03)).toBe(0.5);
  });

  it("returns the value itself when it is outside every radius", () => {
    expect(snap(0.55, [0.5], 0.03)).toBe(0.55);
    expect(snap(0.3, [D1, D2], 0.03)).toBe(0.3);
  });

  it("picks the nearest detent when two are in range", () => {
    expect(snap(0.31, [0.3, 0.33], 0.05)).toBe(0.3);
    expect(snap(0.32, [0.3, 0.33], 0.05)).toBe(0.33);
  });
});

describe("metronomeGains", () => {
  it("is silent at 0", () => {
    expect(metronomeGains(0)).toEqual({ phase: 0, beat: 0 });
  });

  it("sounds phase changes only at detent 1", () => {
    const g = metronomeGains(D1);
    expect(g.phase).toBeGreaterThan(0);
    expect(g.beat).toBe(0);
  });

  it("adds the other beats very quietly at detent 2", () => {
    const g = metronomeGains(D2);
    expect(g.beat).toBeGreaterThan(0);
    expect(g.beat).toBeLessThan(0.2);
    expect(g.phase).toBeGreaterThanOrEqual(metronomeGains(D1).phase);
  });

  it("snaps a level below detent 2 to the nearest of off, D1 and D2", () => {
    expect(metronomeGains(0.05)).toEqual(metronomeGains(0));
    expect(metronomeGains(0.17)).toEqual(metronomeGains(D1));
    expect(metronomeGains(0.25)).toEqual(metronomeGains(D1));
    expect(metronomeGains(0.35)).toEqual(metronomeGains(D2));
  });

  it("rises smoothly above detent 2 and never falls as the level rises", () => {
    let prev = metronomeGains(D2);
    for (let l = D2 + 0.01; l <= 1.0001; l += 0.01) {
      const g = metronomeGains(Math.min(l, 1));
      expect(g.phase).toBeGreaterThanOrEqual(prev.phase);
      expect(g.beat).toBeGreaterThan(prev.beat);
      prev = g;
    }
    expect(metronomeGains(1)).toEqual({ phase: 1, beat: 1 });
  });

  it("never falls across the whole range", () => {
    let prev = metronomeGains(0);
    for (let l = 0; l <= 1.0001; l += 0.005) {
      const g = metronomeGains(Math.min(l, 1));
      expect(g.phase).toBeGreaterThanOrEqual(prev.phase);
      expect(g.beat).toBeGreaterThanOrEqual(prev.beat);
      prev = g;
    }
  });
});
