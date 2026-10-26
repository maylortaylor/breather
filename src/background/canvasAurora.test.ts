// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createCanvasAurora } from "./canvasAurora";
import type { LoopEnv } from "./loop";

function fakeCtx() {
  const gradient = { addColorStop: vi.fn() };
  return {
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    fillStyle: "",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
  };
}

function manualEnv() {
  let cb: ((t: number) => void) | null = null;
  const env: LoopEnv = {
    raf: (fn) => ((cb = fn), 1),
    caf: () => (cb = null),
    onVisibility: () => () => {},
    isHidden: () => false,
  };
  return { env, tick: (t: number) => cb?.(t) };
}

function canvasWith(ctx: unknown) {
  const canvas = document.createElement("canvas");
  canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;
  return canvas;
}

describe("createCanvasAurora", () => {
  it("returns null when the browser gives no 2D context", () => {
    const r = createCanvasAurora(canvasWith(null), { reducedMotion: () => false });
    expect(r).toBeNull();
  });

  it("draws frames on the 2D context and stops drawing after stop", () => {
    const ctx = fakeCtx();
    const { env, tick } = manualEnv();
    const r = createCanvasAurora(canvasWith(ctx), { reducedMotion: () => false, env })!;
    r.resize(1200, 800);
    r.start();
    tick(0);
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(100);
    const drawn = ctx.fillRect.mock.calls.length;
    r.stop();
    tick(100);
    expect(ctx.fillRect.mock.calls.length).toBe(drawn);
  });

  it("caps the backing store and keeps the aspect ratio", () => {
    const canvas = canvasWith(fakeCtx());
    const r = createCanvasAurora(canvas, { reducedMotion: () => false })!;
    r.resize(1200, 600);
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(240);
    r.resize(300, 600);
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(600);
  });
});
