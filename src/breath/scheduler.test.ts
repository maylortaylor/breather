import { describe, expect, it } from "vitest";
import { createPhaseMachine, type Beat } from "./phases";
import { createBeatScheduler } from "./scheduler";

function setup(opts: { lookahead?: number; maxCatchUp?: number; beatSeconds?: number } = {}) {
  let t = 0;
  const machine = createPhaseMachine(opts.beatSeconds ?? 1);
  machine.start(0);
  const fired: Beat[] = [];
  const scheduler = createBeatScheduler({
    now: () => t,
    machine,
    lookahead: opts.lookahead,
    maxCatchUp: opts.maxCatchUp,
    onBeat: (b) => fired.push(b),
  });
  return {
    machine,
    scheduler,
    fired,
    advance(to: number) {
      t = to;
      scheduler.tick();
    },
    times: () => fired.map((b) => b.at),
  };
}

describe("createBeatScheduler", () => {
  it("fires beat 0 on the first tick at the start time", () => {
    const s = setup();
    s.advance(0);
    expect(s.times()).toEqual([0]);
    expect(s.fired[0]).toMatchObject({ index: 0, phase: "inhale", phaseStart: true });
  });

  it("fires each beat exactly once across 25 ms ticks", () => {
    const s = setup();
    for (let ms = 0; ms <= 6000; ms += 25) s.advance(ms / 1000);
    expect(s.times()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("fires beats up to `lookahead` seconds ahead of the clock, not further", () => {
    const s = setup({ lookahead: 0.1 });
    s.advance(0.5);
    s.fired.length = 0;
    s.advance(0.95);
    expect(s.times()).toEqual([1]);
    s.advance(0.9);
    expect(s.times()).toEqual([1]);
  });

  it("does not fire a beat farther ahead than the lookahead", () => {
    const s = setup({ lookahead: 0.1 });
    s.advance(0.5);
    s.fired.length = 0;
    s.advance(0.85);
    expect(s.times()).toEqual([]);
  });

  it("plays a short stall within maxCatchUp late rather than losing the beat", () => {
    const s = setup({ maxCatchUp: 0.25 });
    s.advance(0.8);
    s.fired.length = 0;
    // The tick that should have caught beat 1 at 0.9 arrives at 1.05: 0.15 s late, inside
    // maxCatchUp, so the beat still sounds.
    s.advance(1.05);
    expect(s.times()).toEqual([1]);
  });

  it("skips past beats after a gap longer than maxCatchUp and fires the next future beat", () => {
    const s = setup({ lookahead: 0.1 });
    s.advance(0.5);
    s.fired.length = 0;
    s.advance(5.5); // five seconds asleep
    expect(s.times()).toEqual([]);
    s.advance(5.95);
    expect(s.times()).toEqual([6]);
  });

  it("reports the phase-start flag on beats 0, 4 and 11", () => {
    const s = setup();
    for (let ms = 0; ms <= 19000; ms += 25) s.advance(ms / 1000);
    const starts = s.fired.filter((b) => b.phaseStart).map((b) => [b.index, b.phase]);
    expect(starts).toEqual([
      [0, "inhale"],
      [4, "hold"],
      [11, "exhale"],
      [0, "inhale"],
    ]);
  });

  it("fires nothing while paused and resumes on the next beat", () => {
    const s = setup();
    for (let ms = 0; ms <= 2000; ms += 25) s.advance(ms / 1000);
    s.machine.pause(2.0);
    s.scheduler.reset();
    s.fired.length = 0;
    for (let ms = 2025; ms <= 8000; ms += 25) s.advance(ms / 1000);
    expect(s.fired).toEqual([]);
    s.machine.resume(8.0);
    for (let ms = 8025; ms <= 10000; ms += 25) s.advance(ms / 1000);
    expect(s.times()).toEqual([9, 10]);
  });

  it("does not double-fire or drop beats across a tempo change", () => {
    const s = setup({ beatSeconds: 1 });
    for (let ms = 0; ms <= 2000; ms += 25) s.advance(ms / 1000);
    // Half-second beats from here on. The beat at 3 was already scheduled.
    s.machine.setBeatSeconds(0.5, 2.0);
    s.scheduler.reset();
    for (let ms = 2025; ms <= 5000; ms += 25) s.advance(ms / 1000);
    const times = s.times();
    expect(times.slice(0, 3)).toEqual([0, 1, 2]);
    expect(times.slice(3)).toEqual([2.5, 3, 3.5, 4, 4.5, 5]);
    expect(new Set(times).size).toBe(times.length);
  });

  it("starts fresh after reset when the machine restarts", () => {
    const s = setup();
    for (let ms = 0; ms <= 1000; ms += 25) s.advance(ms / 1000);
    s.fired.length = 0;
    s.machine.start(10);
    s.scheduler.reset();
    for (let ms = 10000; ms <= 10100; ms += 25) s.advance(ms / 1000);
    expect(s.times()).toEqual([10]);
  });
});
