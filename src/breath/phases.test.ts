import { describe, expect, it } from "vitest";
import { CYCLE_BEATS, createPhaseMachine } from "./phases";

function started(beatSeconds = 1, t = 0) {
  const m = createPhaseMachine(beatSeconds);
  m.start(t);
  return m;
}

describe("stateAt", () => {
  it("starts at the top of the inhale with a countdown of 4", () => {
    expect(started().stateAt(0)).toEqual({
      phase: "inhale",
      progress: 0,
      countdown: 4,
      beat: 0,
      paused: false,
    });
  });

  it("counts down whole seconds and tracks progress through the inhale", () => {
    const m = started();
    expect(m.stateAt(0.5)).toMatchObject({ phase: "inhale", progress: 0.125, countdown: 4 });
    expect(m.stateAt(1)).toMatchObject({ phase: "inhale", progress: 0.25, countdown: 3, beat: 1 });
    expect(m.stateAt(3.999)).toMatchObject({ phase: "inhale", countdown: 1, beat: 3 });
  });

  it("holds for 7 beats from beat 4", () => {
    const m = started();
    expect(m.stateAt(4)).toMatchObject({ phase: "hold", progress: 0, countdown: 7, beat: 4 });
    expect(m.stateAt(7.5)).toMatchObject({ phase: "hold", countdown: 4, beat: 7 });
    expect(m.stateAt(10.9)).toMatchObject({ phase: "hold", countdown: 1, beat: 10 });
  });

  it("exhales for 8 beats from beat 11", () => {
    const m = started();
    expect(m.stateAt(11)).toMatchObject({ phase: "exhale", progress: 0, countdown: 8, beat: 11 });
    expect(m.stateAt(15)).toMatchObject({ phase: "exhale", progress: 0.5, countdown: 4 });
    expect(m.stateAt(18.9)).toMatchObject({ phase: "exhale", countdown: 1, beat: 18 });
  });

  it("wraps after a 19-beat cycle", () => {
    expect(CYCLE_BEATS).toBe(19);
    const m = started();
    expect(m.stateAt(19)).toMatchObject({ phase: "inhale", progress: 0, countdown: 4, beat: 0 });
    expect(m.stateAt(19 * 5 + 11)).toMatchObject({ phase: "exhale", beat: 11 });
  });

  it("scales with the beat length", () => {
    const m = started(0.5);
    expect(m.stateAt(2)).toMatchObject({ phase: "hold", beat: 4 });
    expect(m.stateAt(9.5)).toMatchObject({ phase: "inhale", beat: 0 });
  });

  it("measures from the start time", () => {
    const m = started(1, 100);
    expect(m.stateAt(100)).toMatchObject({ phase: "inhale", beat: 0 });
    expect(m.stateAt(105)).toMatchObject({ phase: "hold", beat: 5 });
    expect(m.stateAt(90)).toMatchObject({ phase: "inhale", beat: 0 });
  });

  it("reports paused and idle before start", () => {
    const m = createPhaseMachine(1);
    expect(m.stateAt(50)).toMatchObject({ phase: "inhale", beat: 0, paused: true });
  });
});

describe("setBeatSeconds", () => {
  it("keeps the position when the tempo changes mid-phase", () => {
    const m = started();
    const before = m.stateAt(6.5);
    m.setBeatSeconds(0.5, 6.5);
    const after = m.stateAt(6.5);
    expect(after).toEqual(before);
    // Half a second per beat from here: 4.5 beats left in the hold slot takes 2.25 s.
    expect(m.stateAt(6.5 + 2.25)).toMatchObject({ phase: "exhale", beat: 11, progress: 0 });
  });

  it("does not jump when slowed either", () => {
    const m = started();
    m.setBeatSeconds(2, 2);
    expect(m.stateAt(2)).toMatchObject({ phase: "inhale", beat: 2, progress: 0.5 });
    expect(m.stateAt(4)).toMatchObject({ beat: 3 });
  });

  it("applies while paused without moving", () => {
    const m = started();
    m.pause(5.5);
    m.setBeatSeconds(0.5, 8);
    expect(m.stateAt(8)).toMatchObject({ phase: "hold", beat: 5, paused: true });
    m.resume(10);
    expect(m.stateAt(10.5)).toMatchObject({ beat: 6 });
  });
});

describe("pause and resume", () => {
  it("freezes the position while paused", () => {
    const m = started();
    m.pause(5.5);
    const frozen = m.stateAt(5.5);
    expect(frozen).toMatchObject({ phase: "hold", beat: 5, countdown: 6, paused: true });
    expect(m.stateAt(500)).toEqual(frozen);
  });

  it("resumes from the same beat", () => {
    const m = started();
    m.pause(5.5);
    m.resume(60);
    expect(m.stateAt(60)).toMatchObject({ beat: 5, countdown: 6, paused: false });
    expect(m.stateAt(60.5)).toMatchObject({ beat: 6 });
    expect(m.stateAt(65.5)).toMatchObject({ phase: "exhale", beat: 11 });
  });

  it("ignores a second pause or resume", () => {
    const m = started();
    m.pause(2);
    m.pause(9);
    m.resume(20);
    m.resume(30);
    expect(m.stateAt(20)).toMatchObject({ beat: 2, paused: false });
    expect(m.stateAt(30)).toMatchObject({ beat: 12, paused: false });
  });
});

describe("beatsBetween", () => {
  it("returns each beat in the window once", () => {
    const m = started();
    expect(m.beatsBetween(0, 3).map((b) => [b.at, b.index])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(m.beatsBetween(3, 5).map((b) => b.index)).toEqual([3, 4]);
  });

  it("splits a span into windows without a gap or a repeat", () => {
    const m = started();
    const seen: number[] = [];
    // Accumulated float time, as a real tick loop would carry it.
    let t = 0;
    for (let i = 0; i < 400; i++) {
      const next = t + 0.1;
      for (const b of m.beatsBetween(t, next)) seen.push(b.at);
      t = next;
    }
    // Beats 0..39 once each; the carried time ends a hair past 40, so beat 40 may also land.
    expect(seen.slice(0, 40)).toEqual(Array.from({ length: 40 }, (_, i) => i));
    expect(seen.length).toBeLessThanOrEqual(41);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("marks phase starts on beats 0, 4 and 11", () => {
    const beats = started().beatsBetween(0, 38);
    expect(beats).toHaveLength(38);
    const starts = beats.filter((b) => b.phaseStart).map((b) => [b.index, b.phase]);
    expect(starts).toEqual([
      [0, "inhale"],
      [4, "hold"],
      [11, "exhale"],
      [0, "inhale"],
      [4, "hold"],
      [11, "exhale"],
    ]);
    expect(beats.slice(0, 19).map((b) => b.phase)).toEqual([
      ...Array(4).fill("inhale"),
      ...Array(7).fill("hold"),
      ...Array(8).fill("exhale"),
    ]);
  });

  it("uses the beat length for timing", () => {
    const m = started(0.5);
    expect(m.beatsBetween(0, 2).map((b) => b.at)).toEqual([0, 0.5, 1, 1.5]);
  });

  it("follows the position through a tempo change", () => {
    const m = started();
    m.setBeatSeconds(2, 2.5);
    // Beat 2.5 reached at t=2.5; beat 3 comes half a beat later, i.e. 1 s on.
    expect(m.beatsBetween(2.5, 7).map((b) => [b.index, b.at])).toEqual([
      [3, 3.5],
      [4, 5.5],
    ]);
  });

  it("returns nothing while paused", () => {
    const m = started();
    expect(m.beatsBetween(0, 10)).toHaveLength(10);
    m.pause(5.5);
    expect(m.beatsBetween(5.5, 20)).toEqual([]);
  });

  it("resumes the beat grid from the resume time", () => {
    const m = started();
    m.pause(5.5);
    m.resume(10);
    expect(m.beatsBetween(10, 12).map((b) => [b.index, b.at])).toEqual([
      [6, 10.5],
      [7, 11.5],
    ]);
  });

  it("returns nothing before start or for an empty window", () => {
    expect(createPhaseMachine(1).beatsBetween(0, 10)).toEqual([]);
    expect(started().beatsBetween(2, 2)).toEqual([]);
    expect(started().beatsBetween(5, 2)).toEqual([]);
  });
});
