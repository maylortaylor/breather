import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Engine } from "./engine";
import { createModulator } from "./modulation";

type Point = { at: number; value: number };

function rig(hidden: boolean) {
  const ramps: { id: string; points: Point[] }[] = [];
  const engine = {
    ctx: { currentTime: 10 },
    setMod: vi.fn(),
    rampMod: (id: string, points: Point[]) => void ramps.push({ id, points }),
  } as unknown as Engine;
  const mod = createModulator(
    () => 0.3,
    undefined,
    () => hidden
  );
  mod.setEngine(engine);
  mod.setRow("ocean", { lfo: 1, min: 0, max: 0.6 });
  return { mod, ramps, engine };
}

describe("modulator scheduling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("schedules about 0.25 s of ramp ahead on the audio clock while visible", () => {
    const { mod, ramps } = rig(false);
    vi.advanceTimersByTime(50);
    const last = ramps.at(-1)!.points;
    const span = last.at(-1)!.at - last[0]!.at;
    expect(span).toBeGreaterThanOrEqual(0.2);
    expect(span).toBeLessThan(0.6);
    mod.stop();
  });

  it("schedules 3 s ahead while hidden, so a 1 s timer leaves no stepped gap", () => {
    const { mod, ramps } = rig(true);
    vi.advanceTimersByTime(50);
    const pts = ramps.at(-1)!.points;
    expect(pts.at(-1)!.at - pts[0]!.at).toBeGreaterThanOrEqual(2.9);
    // Times only move forward, and start at the audio clock's now.
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.at).toBeGreaterThan(pts[i - 1]!.at);
    expect(pts[0]!.at).toBeGreaterThanOrEqual(10);
    mod.stop();
  });

  it("keeps the next ticks continuous, with no point repeated or skipped", () => {
    const { mod, ramps } = rig(true);
    vi.advanceTimersByTime(1000);
    const all = ramps.at(-1)!.points.map((p) => p.at);
    for (let i = 1; i < all.length; i++) {
      expect(all[i]! - all[i - 1]!).toBeCloseTo(0.05, 6);
    }
    mod.stop();
  });

  it("drops the LFO and resets the layer once, when its row loses the LFO", () => {
    const { mod, engine } = rig(false);
    vi.advanceTimersByTime(50);
    mod.setRow("ocean", { lfo: 0, min: 0, max: 0.6 });
    vi.advanceTimersByTime(200);
    expect((engine.setMod as ReturnType<typeof vi.fn>).mock.calls).toEqual([["ocean", 1]]);
    mod.stop();
  });
});
