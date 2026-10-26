import { describe, expect, it, vi } from "vitest";
import { createHaptics, PULSE_MS, vibrateFromNavigator } from "./haptics";
import type { Beat } from "./phases";

const beat = (at: number, phaseStart: boolean): Beat => ({
  at,
  index: 0,
  phase: "inhale",
  phaseStart,
});

// A clock and a timer queue that only advance when the test says so.
function setup(opts: { vibrate?: ((ms: number) => unknown) | null; paused?: boolean } = {}) {
  let t = 0;
  let paused = opts.paused ?? false;
  const pending: { at: number; fn: () => void; live: boolean }[] = [];
  const vibrate = opts.vibrate === undefined ? vi.fn(() => true) : opts.vibrate;
  const haptics = createHaptics({
    vibrate,
    now: () => t,
    later(fn, ms) {
      const job = { at: t + ms / 1000, fn, live: true };
      pending.push(job);
      return () => void (job.live = false);
    },
    isPaused: () => paused,
  });
  const advance = (to: number) => {
    t = to;
    for (const job of pending) {
      if (job.live && job.at <= t + 1e-9) {
        job.live = false;
        job.fn();
      }
    }
  };
  return { haptics, vibrate, advance, setPaused: (p: boolean) => (paused = p) };
}

describe("createHaptics", () => {
  it("pulses once for a phase-start beat, when the beat is due and not before", () => {
    const s = setup();
    s.haptics.onBeat(beat(0.08, true));
    s.advance(0.05);
    expect(s.vibrate).not.toHaveBeenCalled();
    s.advance(0.08);
    expect(s.vibrate).toHaveBeenCalledTimes(1);
    expect(s.vibrate).toHaveBeenCalledWith(PULSE_MS);
    s.advance(5);
    expect(s.vibrate).toHaveBeenCalledTimes(1);
  });

  it("keeps the pulse short and soft", () => {
    expect(PULSE_MS).toBeGreaterThanOrEqual(10);
    expect(PULSE_MS).toBeLessThanOrEqual(30);
  });

  it("ignores beats that are not phase starts", () => {
    const s = setup();
    s.haptics.onBeat(beat(0.05, false));
    s.advance(1);
    expect(s.vibrate).not.toHaveBeenCalled();
  });

  it("gives one call per phase change over a full cycle", () => {
    const s = setup();
    const starts = [0, 4, 11];
    for (let i = 0; i < 19; i++) s.haptics.onBeat(beat(i + 0.05, starts.includes(i)));
    s.advance(30);
    expect(s.vibrate).toHaveBeenCalledTimes(3);
  });

  it("fires at once for a beat already due", () => {
    const s = setup();
    s.advance(2);
    s.haptics.onBeat(beat(1.9, true));
    s.advance(2);
    expect(s.vibrate).toHaveBeenCalledTimes(1);
  });

  it("does not pulse while paused, even for a pulse already queued", () => {
    const s = setup();
    s.haptics.onBeat(beat(0.08, true));
    s.setPaused(true);
    s.advance(1);
    expect(s.vibrate).not.toHaveBeenCalled();
    s.haptics.onBeat(beat(1.5, true));
    s.advance(2);
    expect(s.vibrate).not.toHaveBeenCalled();
  });

  it("cancel drops queued pulses", () => {
    const s = setup();
    s.haptics.onBeat(beat(0.08, true));
    s.haptics.cancel();
    s.advance(1);
    expect(s.vibrate).not.toHaveBeenCalled();
  });

  it("does nothing, and throws nothing, without vibrate", () => {
    const s = setup({ vibrate: null });
    expect(() => {
      s.haptics.onBeat(beat(0.05, true));
      s.advance(1);
      s.haptics.cancel();
    }).not.toThrow();
  });

  it("swallows a vibrate call that throws", () => {
    const s = setup({
      vibrate: () => {
        throw new Error("blocked");
      },
    });
    s.haptics.onBeat(beat(0.05, true));
    expect(() => s.advance(1)).not.toThrow();
  });
});

describe("vibrateFromNavigator", () => {
  it("returns null when the navigator has no vibrate (iOS)", () => {
    expect(vibrateFromNavigator({} as Navigator)).toBeNull();
    expect(vibrateFromNavigator(undefined)).toBeNull();
  });

  it("calls the navigator's own vibrate with its receiver", () => {
    const calls: [unknown, number][] = [];
    const nav = {
      vibrate(this: unknown, ms: number) {
        calls.push([this, ms]);
        return true;
      },
    } as unknown as Navigator;
    vibrateFromNavigator(nav)?.(20);
    expect(calls).toEqual([[nav, 20]]);
  });
});
