import { describe, expect, it } from "vitest";
import { createLoop, type LoopEnv } from "./loop";

function fakeEnv() {
  let nextId = 1;
  const pending = new Map<number, (t: number) => void>();
  const listeners: (() => void)[] = [];
  const env: LoopEnv & { hidden: boolean } = {
    hidden: false,
    raf: (cb: (t: number) => void) => {
      pending.set(nextId, cb);
      return nextId++;
    },
    caf: (id: number) => void pending.delete(id),
    onVisibility: (fn: () => void) => {
      listeners.push(fn);
      return () => void listeners.splice(listeners.indexOf(fn), 1);
    },
    isHidden: () => env.hidden,
  };
  return {
    env,
    pending,
    /** Runs the queued frame callbacks at time `t`, like one display refresh. */
    tick(t: number) {
      const batch = [...pending.entries()];
      pending.clear();
      for (const [, cb] of batch) cb(t);
    },
    setHidden(h: boolean) {
      env.hidden = h;
      for (const fn of [...listeners]) fn();
    },
    listeners,
  };
}

describe("createLoop", () => {
  it("draws at most 30 frames in a second of 60 Hz ticks", () => {
    const f = fakeEnv();
    let frames = 0;
    createLoop(() => frames++, f.env, 30).start();
    for (let i = 0; i < 60; i++) f.tick(i * (1000 / 60));
    expect(frames).toBeGreaterThanOrEqual(29);
    expect(frames).toBeLessThanOrEqual(31);
  });

  it("passes the seconds since the last drawn frame, never more than a quarter second", () => {
    const f = fakeEnv();
    const dts: number[] = [];
    createLoop((dt) => dts.push(dt), f.env, 30).start();
    f.tick(1000);
    f.tick(1040);
    f.tick(9000);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.04, 6);
    expect(dts[2]).toBe(0.25);
  });

  it("renders no frames while the tab is hidden and resumes on return", () => {
    const f = fakeEnv();
    let frames = 0;
    createLoop(() => frames++, f.env, 30).start();
    f.tick(0);
    expect(frames).toBe(1);
    f.setHidden(true);
    expect(f.pending.size).toBe(0);
    f.tick(1000);
    f.tick(2000);
    expect(frames).toBe(1);
    f.setHidden(false);
    f.tick(3000);
    expect(frames).toBe(2);
  });

  it("does not start while hidden, and starts when the tab shows", () => {
    const f = fakeEnv();
    f.env.hidden = true;
    let frames = 0;
    createLoop(() => frames++, f.env, 30).start();
    expect(f.pending.size).toBe(0);
    f.setHidden(false);
    f.tick(0);
    expect(frames).toBe(1);
  });

  it("stop cancels the queued frame and the visibility listener", () => {
    const f = fakeEnv();
    let frames = 0;
    const loop = createLoop(() => frames++, f.env, 30);
    loop.start();
    loop.stop();
    expect(f.pending.size).toBe(0);
    expect(f.listeners.length).toBe(0);
    f.tick(0);
    expect(frames).toBe(0);
  });

  it("start twice does not double the frames", () => {
    const f = fakeEnv();
    let frames = 0;
    const loop = createLoop(() => frames++, f.env, 30);
    loop.start();
    loop.start();
    f.tick(0);
    expect(frames).toBe(1);
    expect(f.pending.size).toBe(1);
  });
});
