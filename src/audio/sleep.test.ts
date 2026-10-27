import { describe, expect, it } from "vitest";
import {
  createSleep,
  devTimerFlag,
  FINAL_FADE_SEC,
  minutesLeft,
  RESTORE_SEC,
  timerOptions,
  type SleepParam,
} from "./sleep";

type Ev = { kind: "set" | "ramp"; value: number; at: number };

/** An AudioParam stand-in that records scheduled events and honours cancelScheduledValues. */
function fakeParam(value: number) {
  const events: Ev[] = [];
  const param: SleepParam & { events: Ev[] } = {
    value,
    events,
    cancelScheduledValues(t) {
      for (let i = events.length - 1; i >= 0; i--) if (events[i]!.at >= t) events.splice(i, 1);
    },
    setValueAtTime(v, at) {
      events.push({ kind: "set", value: v, at });
    },
    linearRampToValueAtTime(v, at) {
      events.push({ kind: "ramp", value: v, at });
    },
  };
  return param;
}

function setup(start = 100, level = 0.12) {
  const clock = { t: start };
  const param = fakeParam(level);
  const sleep = createSleep({ param, now: () => clock.t, level: () => level });
  return { clock, param, sleep };
}

describe("minutesLeft", () => {
  it("rounds up so the label never reads 0 while time remains", () => {
    expect(minutesLeft(1800, 0)).toBe(30);
    expect(minutesLeft(1800, 1)).toBe(30);
    expect(minutesLeft(1800, 1740)).toBe(1);
    expect(minutesLeft(1800, 1799.9)).toBe(1);
    expect(minutesLeft(1800, 1741)).toBe(1);
    expect(minutesLeft(1800, 1680)).toBe(2);
  });

  it("is 0 at and after the end", () => {
    expect(minutesLeft(1800, 1800)).toBe(0);
    expect(minutesLeft(1800, 2000)).toBe(0);
  });
});

describe("timerOptions", () => {
  it("offers 30, 60 and 90 in a production build", () => {
    expect(timerOptions(false)).toEqual([30, 60, 90]);
  });

  it("adds the 2 minute test timer first in a dev build", () => {
    expect(timerOptions(true)).toEqual([2, 30, 60, 90]);
  });
});

describe("devTimerFlag", () => {
  it("needs a dev build and ?devtimer=1", () => {
    expect(devTimerFlag(true, "?devtimer=1")).toBe(true);
    expect(devTimerFlag(true, "?a=b&devtimer=1")).toBe(true);
    expect(devTimerFlag(true, "")).toBe(false);
    expect(devTimerFlag(true, "?devtimer=0")).toBe(false);
    expect(devTimerFlag(false, "?devtimer=1")).toBe(false);
  });
});

describe("start (AC1, AC2)", () => {
  it("stores the end as an audio clock value", () => {
    const { sleep } = setup(100);
    expect(sleep.start(30)).toEqual({ minutes: 30, endsAt: 100 + 1800 });
  });

  it("holds the level, then ramps to silence over the last 5 minutes", () => {
    const { sleep, param } = setup(100, 0.12);
    sleep.start(30);
    expect(FINAL_FADE_SEC).toBe(300);
    expect(param.events).toEqual([
      { kind: "set", value: 0.12, at: 100 },
      { kind: "set", value: 0.12, at: 1900 - 300 },
      { kind: "ramp", value: 0, at: 1900 },
    ]);
  });

  it("fades a 2 minute timer over its whole length", () => {
    const { sleep, param } = setup(50, 0.12);
    sleep.start(2);
    expect(param.events).toEqual([
      { kind: "set", value: 0.12, at: 50 },
      { kind: "ramp", value: 0, at: 170 },
    ]);
  });

  it("replaces an earlier timer instead of stacking ramps", () => {
    const { sleep, param, clock } = setup(0);
    sleep.start(60);
    clock.t = 10;
    sleep.start(30);
    expect(param.events.filter((e) => e.kind === "ramp")).toEqual([
      { kind: "ramp", value: 0, at: 10 + 1800 },
    ]);
  });
});

describe("cancel (AC2)", () => {
  it("drops the schedule and ramps back to the master level", () => {
    const { sleep, param, clock } = setup(0, 0.12);
    sleep.start(30);
    clock.t = 600;
    sleep.cancel();
    expect(sleep.endsAt()).toBeNull();
    // Nothing scheduled for the future survives except the restore.
    expect(param.events.filter((e) => e.at >= 600)).toEqual([
      { kind: "set", value: 0.12, at: 600 },
      { kind: "ramp", value: 0.12, at: 600 + RESTORE_SEC },
    ]);
  });

  it("starts the restore from the level the fade had reached, so nothing jumps", () => {
    const { sleep, param, clock } = setup(0, 0.12);
    sleep.start(30);
    clock.t = 1700;
    param.value = 0.05; // what the audio clock says mid-ramp
    sleep.cancel();
    expect(param.events.filter((e) => e.at >= 1700)).toEqual([
      { kind: "set", value: 0.05, at: 1700 },
      { kind: "ramp", value: 0.12, at: 1700 + RESTORE_SEC },
    ]);
  });

  it("restores the new master level when it changed during the timer", () => {
    const clock = { t: 0 };
    const param = fakeParam(0.12);
    let level = 0.12;
    const sleep = createSleep({ param, now: () => clock.t, level: () => level });
    sleep.start(30);
    level = 0.3;
    sleep.cancel();
    expect(param.events.at(-1)).toEqual({ kind: "ramp", value: 0.3, at: RESTORE_SEC });
  });

  it("does nothing when no timer runs", () => {
    const { sleep, param } = setup();
    sleep.cancel();
    expect(param.events).toEqual([]);
  });
});

describe("reschedule", () => {
  it("rebuilds the hold at a new master level before the fade begins", () => {
    const clock = { t: 0 };
    const param = fakeParam(0.12);
    let level = 0.12;
    const sleep = createSleep({ param, now: () => clock.t, level: () => level });
    sleep.start(30);
    clock.t = 60;
    level = 0.2;
    sleep.reschedule();
    expect(param.events).toEqual([
      { kind: "set", value: 0.12, at: 0 },
      { kind: "set", value: 0.2, at: 60 },
      { kind: "set", value: 0.2, at: 1500 },
      { kind: "ramp", value: 0, at: 1800 },
    ]);
  });

  it("keeps the same end and ramps down from the current value inside the fade", () => {
    const { sleep, param, clock } = setup(0, 0.12);
    sleep.start(30);
    clock.t = 1600;
    param.value = 0.04;
    sleep.reschedule();
    expect(sleep.endsAt()).toBe(1800);
    expect(param.events.filter((e) => e.at >= 1600)).toEqual([
      { kind: "set", value: 0.04, at: 1600 },
      { kind: "ramp", value: 0, at: 1800 },
    ]);
  });
});

describe("end and due", () => {
  it("is due once the clock reaches the end, not before", () => {
    const { sleep, clock } = setup(0);
    expect(sleep.due()).toBe(false);
    sleep.start(30);
    clock.t = 1799;
    expect(sleep.due()).toBe(false);
    clock.t = 1800;
    expect(sleep.due()).toBe(true);
  });

  it("end leaves the master at silence with nothing scheduled after it", () => {
    const { sleep, param, clock } = setup(0, 0.12);
    sleep.start(30);
    clock.t = 1800;
    sleep.end();
    expect(sleep.endsAt()).toBeNull();
    expect(sleep.due()).toBe(false);
    expect(param.events.filter((e) => e.at >= 1800)).toEqual([{ kind: "set", value: 0, at: 1800 }]);
  });
});
