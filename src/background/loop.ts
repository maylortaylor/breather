// The frame loop both renderers share: a 30 fps cap, and no frames while the tab is hidden.
import { createFrameGate } from "./logic";

export type LoopEnv = {
  raf: (cb: (nowMs: number) => void) => number;
  caf: (id: number) => void;
  /** Subscribes to tab visibility changes; returns the unsubscribe. */
  onVisibility: (fn: () => void) => () => void;
  isHidden: () => boolean;
};

export const browserEnv: LoopEnv = {
  raf: (cb) => requestAnimationFrame(cb),
  caf: (id) => cancelAnimationFrame(id),
  onVisibility(fn) {
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  },
  isHidden: () => document.hidden,
};

// A long gap (a stalled tab) must not make the animation lurch.
const MAX_DT = 0.25;

export interface Loop {
  start(): void;
  stop(): void;
}

/** Calls `draw(dtSeconds)` at most `fps` times a second while the tab is visible. */
export function createLoop(draw: (dtSec: number) => void, env: LoopEnv, fps = 30): Loop {
  const gate = createFrameGate(fps);
  let id = 0;
  let running = false;
  let lastMs: number | null = null;
  let unsubscribe: (() => void) | null = null;

  const frame = (nowMs: number) => {
    id = env.raf(frame);
    if (!gate.ready(nowMs)) return;
    const dt = lastMs === null ? 0 : Math.min(MAX_DT, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    draw(dt);
  };

  const pause = () => {
    if (id) env.caf(id);
    id = 0;
  };

  const resume = () => {
    if (!running || id || env.isHidden()) return;
    gate.reset();
    lastMs = null;
    id = env.raf(frame);
  };

  const onVisibility = () => (env.isHidden() ? pause() : resume());

  return {
    start() {
      if (running) return;
      running = true;
      unsubscribe = env.onVisibility(onVisibility);
      resume();
    },
    stop() {
      running = false;
      pause();
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}
