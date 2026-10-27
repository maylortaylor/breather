import { describe, expect, it } from "vite-plus/test";
import { classifyGesture, createAutoHide, IDLE_MS, isWide, WIDE_QUERY_PX } from "./sheetLogic";

/** A manual clock: `after` queues a callback, `advance` runs what has come due. */
function fakeClock() {
  let now = 0;
  const queue: { at: number; fn: () => void; live: boolean }[] = [];
  return {
    after(ms: number, fn: () => void) {
      const item = { at: now + ms, fn, live: true };
      queue.push(item);
      return () => {
        item.live = false;
      };
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = queue.filter((q) => q.live && q.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at;
        next.live = false;
        next.fn();
      }
      now = end;
    },
  };
}

function setup() {
  const clock = fakeClock();
  const seen: boolean[] = [];
  const hide = createAutoHide({
    after: (ms, fn) => clock.after(ms, fn),
    onChange: (d) => seen.push(d),
  });
  return { clock, seen, hide };
}

describe("createAutoHide", () => {
  it("closes after 8 s with no input", () => {
    const { clock, seen, hide } = setup();
    hide.start();
    clock.advance(IDLE_MS - 1);
    expect(hide.dissolved()).toBe(false);
    clock.advance(1);
    expect(hide.dissolved()).toBe(true);
    expect(seen).toEqual([true]);
  });

  it("restarts the wait on every input", () => {
    const { clock, hide } = setup();
    hide.start();
    clock.advance(IDLE_MS - 1000);
    hide.activity();
    clock.advance(IDLE_MS - 1000);
    expect(hide.dissolved()).toBe(false);
    clock.advance(1000);
    expect(hide.dissolved()).toBe(true);
  });

  it("brings the sheet back on input after the dissolve, then waits again", () => {
    const { clock, seen, hide } = setup();
    hide.start();
    clock.advance(IDLE_MS);
    hide.activity();
    expect(hide.dissolved()).toBe(false);
    expect(seen).toEqual([true, false]);
    clock.advance(IDLE_MS);
    expect(seen).toEqual([true, false, true]);
  });

  it("reports nothing when input arrives while already shown", () => {
    const { seen, hide } = setup();
    hide.start();
    hide.activity();
    hide.activity();
    expect(seen).toEqual([]);
  });

  it("never dissolves while held, and waits a full 8 s after the hold ends", () => {
    const { clock, hide } = setup();
    hide.start();
    hide.setHeld(true);
    clock.advance(IDLE_MS * 4);
    expect(hide.dissolved()).toBe(false);
    hide.setHeld(false);
    clock.advance(IDLE_MS - 1);
    expect(hide.dissolved()).toBe(false);
    clock.advance(1);
    expect(hide.dissolved()).toBe(true);
  });

  it("shows a dissolved sheet when a hold begins and ignores input timers while held", () => {
    const { clock, seen, hide } = setup();
    hide.start();
    clock.advance(IDLE_MS);
    hide.setHeld(true);
    expect(hide.dissolved()).toBe(false);
    hide.activity();
    clock.advance(IDLE_MS * 2);
    expect(hide.dissolved()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it("stop cancels the wait and shows the sheet", () => {
    const { clock, seen, hide } = setup();
    hide.start();
    clock.advance(IDLE_MS);
    hide.stop();
    expect(hide.dissolved()).toBe(false);
    clock.advance(IDLE_MS * 2);
    expect(seen).toEqual([true, false]);
  });
});

describe("classifyGesture", () => {
  it("calls a short, still press a tap", () => {
    expect(classifyGesture({ dx: 2, dy: -3, ms: 120 })).toBe("tap");
  });
  it("calls a long upward drag a swipe up", () => {
    expect(classifyGesture({ dx: 10, dy: -90, ms: 250 })).toBe("swipe-up");
  });
  it("ignores a downward or sideways drag", () => {
    expect(classifyGesture({ dx: 0, dy: 90, ms: 250 })).toBeNull();
    expect(classifyGesture({ dx: 90, dy: -20, ms: 250 })).toBeNull();
  });
  it("ignores a long hold in place", () => {
    expect(classifyGesture({ dx: 0, dy: 0, ms: 900 })).toBeNull();
  });
  it("ignores a short upward move", () => {
    expect(classifyGesture({ dx: 0, dy: -30, ms: 200 })).toBeNull();
  });
});

describe("isWide", () => {
  it("switches to the panel at 900 px", () => {
    expect(WIDE_QUERY_PX).toBe(900);
    expect(isWide(899)).toBe(false);
    expect(isWide(900)).toBe(true);
  });
});
