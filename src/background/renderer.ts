import type { LoopEnv } from "./loop";

/** A background that follows the breath (ADR-0003). The host picks one and never sees its guts. */
export interface BackgroundRenderer {
  start(): void;
  /** 0..1, from `breathLevel`. */
  setBreath(v: number): void;
  setDim(on: boolean): void;
  /** CSS pixels. */
  resize(w: number, h: number): void;
  stop(): void;
}

export type RendererOptions = {
  /** Read every frame, so a change in the system setting applies at once. */
  reducedMotion: () => boolean;
  /** Called once if the renderer cannot continue (a lost WebGL context). */
  onLost?: () => void;
  /** Frame-loop environment; tests and the host can supply their own. */
  env?: LoopEnv;
  /** Device density and capability hints for the render scale. */
  pixelRatio?: number;
};
