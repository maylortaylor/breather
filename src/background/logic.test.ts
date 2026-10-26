import { describe, expect, it } from "vitest";
import {
  approach,
  auroraLook,
  breathLevel,
  createFrameGate,
  pickRenderer,
  renderRatio,
} from "./logic";

describe("breathLevel", () => {
  it("is 0 at the start of the inhale and 1 at its end", () => {
    expect(breathLevel({ phase: "inhale", progress: 0 })).toBe(0);
    expect(breathLevel({ phase: "inhale", progress: 1 })).toBe(1);
  });

  it("rises monotonically and eased through the inhale", () => {
    const at = (p: number) => breathLevel({ phase: "inhale", progress: p });
    expect(at(0.5)).toBeCloseTo(0.5, 6);
    expect(at(0.25)).toBeLessThan(0.25);
    expect(at(0.75)).toBeGreaterThan(0.75);
    expect(at(0.3)).toBeLessThan(at(0.6));
  });

  it("stays at 1 through the hold", () => {
    for (const p of [0, 0.4, 1]) expect(breathLevel({ phase: "hold", progress: p })).toBe(1);
  });

  it("falls from 1 to 0 across the exhale", () => {
    expect(breathLevel({ phase: "exhale", progress: 0 })).toBe(1);
    expect(breathLevel({ phase: "exhale", progress: 0.5 })).toBeCloseTo(0.5, 6);
    expect(breathLevel({ phase: "exhale", progress: 1 })).toBe(0);
  });

  it("never leaves 0..1, whatever the progress", () => {
    for (const phase of ["inhale", "hold", "exhale"] as const) {
      for (const p of [-3, -0.01, 0.5, 1.01, 7, Number.NaN]) {
        const v = breathLevel({ phase, progress: p });
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("approach", () => {
  it("does not move with no time and closes the gap as time passes", () => {
    expect(approach(0, 1, 0, 5)).toBe(0);
    const a = approach(0, 1, 0.1, 5);
    const b = approach(0, 1, 1, 5);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(1);
  });

  it("is steady when already at the target", () => {
    expect(approach(0.7, 0.7, 0.5, 3)).toBeCloseTo(0.7, 12);
  });
});

describe("auroraLook", () => {
  const base = { level: 0.5, dim: false, reduced: false };

  it("brightens with the breath", () => {
    const lo = auroraLook({ ...base, level: 0 });
    const hi = auroraLook({ ...base, level: 1 });
    expect(hi.brightness).toBeGreaterThan(lo.brightness);
    expect(hi.height).toBeGreaterThan(lo.height);
    expect(hi.lift).toBeGreaterThan(lo.lift);
  });

  it("halves the brightness in dim mode", () => {
    const on = auroraLook({ ...base, dim: true }).brightness;
    const off = auroraLook(base).brightness;
    expect(on / off).toBeCloseTo(0.5, 6);
  });

  it("slows and flattens under reduced motion", () => {
    const calm = auroraLook({ ...base, reduced: true });
    const normal = auroraLook(base);
    expect(calm.speed).toBeLessThan(normal.speed / 3);
    expect(calm.amplitude).toBeLessThan(normal.amplitude);
    expect(calm.brightness).toBe(normal.brightness);
  });
});

describe("renderRatio", () => {
  it("renders fewer pixels on a weak device", () => {
    const strong = renderRatio({ dpr: 2, cores: 8, memory: 8 });
    const weak = renderRatio({ dpr: 2, cores: 2, memory: 2 });
    expect(weak).toBeLessThan(strong);
  });

  it("caps the density and keeps a floor", () => {
    expect(renderRatio({ dpr: 5, cores: 8, memory: 8 })).toBe(
      renderRatio({ dpr: 2, cores: 8, memory: 8 })
    );
    expect(renderRatio({ dpr: 0.1, cores: 1, memory: 0.25 })).toBeGreaterThanOrEqual(0.3);
  });

  it("treats missing hints as a capable device", () => {
    const r = renderRatio({ dpr: 1, cores: undefined, memory: undefined });
    expect(r).toBe(renderRatio({ dpr: 1, cores: 8, memory: 8 }));
  });
});

describe("createFrameGate", () => {
  it("lets about 30 frames through per second of 60 fps ticks", () => {
    const gate = createFrameGate(30);
    let n = 0;
    for (let i = 0; i < 120; i++) if (gate.ready(i * (1000 / 60))) n++;
    expect(n).toBeGreaterThanOrEqual(58);
    expect(n).toBeLessThanOrEqual(61);
  });

  it("always passes the first frame and passes again after a long gap", () => {
    const gate = createFrameGate(30);
    expect(gate.ready(5000)).toBe(true);
    expect(gate.ready(5005)).toBe(false);
    expect(gate.ready(9000)).toBe(true);
  });

  it("restarts cleanly after reset", () => {
    const gate = createFrameGate(30);
    gate.ready(100);
    gate.reset();
    expect(gate.ready(101)).toBe(true);
  });
});

describe("pickRenderer", () => {
  it("prefers WebGL, then the canvas, then the CSS gradient", () => {
    expect(pickRenderer({ webgl: true, canvas: true }, [])).toBe("webgl");
    expect(pickRenderer({ webgl: false, canvas: true }, [])).toBe("canvas");
    expect(pickRenderer({ webgl: false, canvas: false }, [])).toBe("css");
  });

  it("skips any renderer that already failed", () => {
    expect(pickRenderer({ webgl: true, canvas: true }, ["webgl"])).toBe("canvas");
    expect(pickRenderer({ webgl: true, canvas: true }, ["webgl", "canvas"])).toBe("css");
  });
});
