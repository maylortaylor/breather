// Pure aurora logic: the breath mapping, the look it drives, resolution scaling, the frame gate
// and the renderer choice. Inputs are injected so every rule runs the same in a test.
import type { BreathState } from "../breath/phases";

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const smooth = (x: number) => x * x * (3 - 2 * x);

/** 0..1 for the aurora: rises through the inhale, stays at 1 on the hold, falls on the exhale. */
export function breathLevel(state: Pick<BreathState, "phase" | "progress">): number {
  const e = smooth(clamp01(state.progress));
  if (state.phase === "inhale") return e;
  if (state.phase === "hold") return 1;
  return 1 - e;
}

/** Moves `current` toward `target` at `rate` per second, frame-rate independent. */
export function approach(current: number, target: number, dtSec: number, rate: number): number {
  return target + (current - target) * Math.exp(-Math.max(0, dtSec) * rate);
}

export type AuroraInput = { level: number; dim: boolean; reduced: boolean };
export type AuroraLook = {
  /** Overall brightness, 0..1. Dim mode takes about half. */
  brightness: number;
  /** How far the curtains reach upward, 0..1. */
  height: number;
  /** How high the curtains' lower edge sits, 0..1. Falls on the exhale, so they drift down. */
  lift: number;
  /** Animation speed multiplier. */
  speed: number;
  /** Sway amplitude multiplier. */
  amplitude: number;
};

export const DIM_FACTOR = 0.5;

export function auroraLook({ level, dim, reduced }: AuroraInput): AuroraLook {
  const l = clamp01(level);
  return {
    brightness: (0.4 + 0.6 * l) * (dim ? DIM_FACTOR : 1),
    height: 0.35 + 0.65 * l,
    lift: l,
    speed: reduced ? 0.15 : 1,
    amplitude: reduced ? 0.35 : 1,
  };
}

export type DeviceHints = {
  dpr: number;
  cores: number | undefined;
  memory: number | undefined;
};

const MIN_RATIO = 0.3;

/** Pixel ratio to render at. The aurora is soft, so it can run well under native resolution. */
export function renderRatio({ dpr, cores, memory }: DeviceHints): number {
  const weak = (cores ?? 8) <= 4 || (memory ?? 8) <= 2;
  return Math.max(MIN_RATIO, Math.min(dpr, 2) * (weak ? 0.35 : 0.6));
}

export interface FrameGate {
  /** True when a frame is due at `nowMs`. */
  ready(nowMs: number): boolean;
  reset(): void;
}

/** Caps frames per second. A small allowance keeps a 60 Hz display at a steady 30. */
export function createFrameGate(fps: number): FrameGate {
  const interval = 1000 / fps;
  let last = -Infinity;
  return {
    ready(nowMs) {
      if (nowMs - last < interval - 2) return false;
      last = nowMs;
      return true;
    },
    reset() {
      last = -Infinity;
    },
  };
}

export type RendererKind = "webgl" | "canvas" | "css";

/** The best renderer that is available and has not already failed. */
export function pickRenderer(
  available: { webgl: boolean; canvas: boolean },
  failed: readonly RendererKind[]
): RendererKind {
  if (available.webgl && !failed.includes("webgl")) return "webgl";
  if (available.canvas && !failed.includes("canvas")) return "canvas";
  return "css";
}
