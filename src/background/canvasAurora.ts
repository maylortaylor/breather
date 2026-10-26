import { browserEnv, createLoop } from "./loop";
import { createAuroraClock, type AuroraFrame } from "./logic";
import type { BackgroundRenderer, RendererOptions } from "./renderer";

// The canvas draws on a tiny backing store that CSS scales up; the aurora is soft, so it shows.
const COLUMN_PX = 3;
const MAX_BACKING_W = 480;

type Curtain = { seed: number; speed: number; base: number; rgb: [number, number, number] };

const CURTAINS: Curtain[] = [
  { seed: 1.0, speed: 0.8, base: 0.34, rgb: [26, 204, 128] },
  { seed: 2.3, speed: 0.6, base: 0.42, rgb: [20, 153, 184] },
  { seed: 3.7, speed: 0.5, base: 0.5, rgb: [128, 77, 217] },
];

// Fixed star positions (unit square) so the sky does not shimmer with the frame loop.
const STARS = Array.from({ length: 60 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.7;
  return { x: a - Math.floor(a), y: b - Math.floor(b), phase: i * 1.7 };
});

/** Draws a 2D approximation of the aurora, or returns null when no 2D context exists. */
export function createCanvasAurora(
  canvas: HTMLCanvasElement,
  opts: RendererOptions
): BackgroundRenderer | null {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d", { alpha: false });
  } catch {
    return null;
  }
  if (!ctx) return null;
  const g = ctx;

  const clock = createAuroraClock();
  let w = 1;
  let h = 1;

  const draw = (f: AuroraFrame) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#04060f");
    sky.addColorStop(1, "#0a0f22");
    g.globalCompositeOperation = "source-over";
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    g.fillStyle = "#cfd8ff";
    for (const s of STARS) {
      g.globalAlpha = (0.35 + 0.25 * Math.sin(f.time * 0.8 + s.phase)) * f.brightness;
      g.fillRect(s.x * w, s.y * h * 0.8, 1, 1);
    }

    g.globalCompositeOperation = "lighter";
    const columns = Math.ceil(w / COLUMN_PX);
    for (const c of CURTAINS) {
      const t = f.time * c.speed;
      for (let i = 0; i < columns; i++) {
        const u = i / columns;
        const sway =
          Math.sin(u * 5 + c.seed * 7 + t * 0.9) * 0.18 + Math.sin(u * 11 + t * 0.5) * 0.08;
        const edge = c.base + f.lift * 0.2 + sway * f.amplitude * 0.8;
        const rays = 0.55 + 0.45 * Math.sin(u * 80 + c.seed * 3 + t * 1.3);
        const bottom = (1 - edge) * h;
        const reach = (0.25 + 0.45 * f.height) * h;
        const grad = g.createLinearGradient(0, bottom, 0, bottom - reach);
        const [r, gr, b] = c.rgb;
        const a = Math.min(1, 0.75 * f.brightness * rays);
        grad.addColorStop(0, `rgba(${r},${gr},${b},${a.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
        g.globalAlpha = 1;
        g.fillStyle = grad;
        g.fillRect(i * COLUMN_PX, bottom - reach, COLUMN_PX, reach);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const loop = createLoop(
    (dt) => draw(clock.step(dt, opts.reducedMotion())),
    opts.env ?? browserEnv,
    30
  );

  return {
    start: () => loop.start(),
    setBreath: (v) => clock.setBreath(v),
    setDim: (on) => clock.setDim(on),
    resize(cssW, cssH) {
      // Keep the aspect ratio, cap the backing store.
      w = Math.max(1, Math.min(MAX_BACKING_W, Math.round(cssW)));
      h = Math.max(1, Math.round((w * cssH) / Math.max(1, cssW)));
      canvas.width = w;
      canvas.height = h;
    },
    stop: () => loop.stop(),
  };
}
