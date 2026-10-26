import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { store, useStore } from "../store";
import { colors, dimTheme } from "../theme.stylex";
import { createCanvasAurora } from "./canvasAurora";
import { subscribeBreath } from "./feed";
import { breathLevel, IDLE_LEVEL, pickRenderer, type RendererKind } from "./logic";
import type { BackgroundRenderer, RendererOptions } from "./renderer";

const styles = stylex.create({
  // Behind everything: the page body paints first, then this, then the app.
  layer: {
    position: "fixed",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
    // The fallback of last resort, and what shows before the first frame.
    backgroundImage: `linear-gradient(160deg, ${colors.auroraA}, ${colors.auroraB} 55%, ${colors.auroraC})`,
  },
  canvas: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" },
});

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function contextAvailable(kind: "webgl" | "2d"): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(
      kind === "webgl"
        ? probe.getContext("webgl2") || probe.getContext("webgl")
        : probe.getContext("2d")
    );
  } catch {
    return false;
  }
}

type Create = (
  canvas: HTMLCanvasElement,
  opts: RendererOptions
) => Promise<BackgroundRenderer | null>;

// three.js loads only when WebGL exists, and after the first paint, so Begin is never blocked.
const creators: Record<Exclude<RendererKind, "css">, Create> = {
  webgl: async (canvas, opts) => (await import("./aurora")).createAurora(canvas, opts),
  canvas: async (canvas, opts) => createCanvasAurora(canvas, opts),
};

/** The aurora behind the app. Falls back WebGL, then canvas, then the CSS gradient; never throws. */
export function Background() {
  const dim = useStore((s) => s.dim);
  const [available] = useState(() => ({
    webgl: contextAvailable("webgl"),
    canvas: contextAvailable("2d"),
  }));
  const [failed, setFailed] = useState<RendererKind[]>([]);
  const kind = pickRenderer(available, failed);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BackgroundRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (kind === "css" || !canvas) return;
    let cancelled = false;
    let cleanup = () => {};
    const fail = () => setFailed((prev) => (prev.includes(kind) ? prev : [...prev, kind]));

    const mq = window.matchMedia?.(REDUCED_QUERY);
    const opts: RendererOptions = { reducedMotion: () => Boolean(mq?.matches), onLost: fail };

    creators[kind](canvas, opts)
      .then((r) => {
        if (cancelled) return r?.stop();
        if (!r) return fail();
        rendererRef.current = r;
        const fit = () => r.resize(window.innerWidth, window.innerHeight);
        fit();
        r.setDim(store.get().dim);
        const off = subscribeBreath((s) => r.setBreath(s ? breathLevel(s) : IDLE_LEVEL));
        window.addEventListener("resize", fit);
        r.start();
        cleanup = () => {
          off();
          window.removeEventListener("resize", fit);
        };
      })
      .catch(fail);

    return () => {
      cancelled = true;
      cleanup();
      rendererRef.current?.stop();
      rendererRef.current = null;
    };
  }, [kind]);

  // Keeps the live renderer's dim in step without rebuilding it.
  useEffect(() => rendererRef.current?.setDim(dim), [dim]);

  return (
    <div aria-hidden="true" {...stylex.props(styles.layer, dim && dimTheme)}>
      {kind !== "css" && <canvas key={kind} ref={canvasRef} {...stylex.props(styles.canvas)} />}
    </div>
  );
}
