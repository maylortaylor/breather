import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { publishBreath } from "../background/feed";
import { getSession } from "../audio/session";
import { store, useStore } from "../store";
import { colors } from "../theme.stylex";
import { startBeats } from "./beats";
import { createPhaseMachine, type BreathState, type Phase, type PhaseMachine } from "./phases";

export const PHASE_WORDS: Record<Phase, string> = {
  inhale: "Breathe in through your nose",
  hold: "Hold",
  exhale: "Breathe out slowly through your mouth",
};

/** A breath visual draws itself from the phase machine's state; it never gets events. */
export interface BreathVisual {
  mount(el: HTMLElement): void;
  draw(state: BreathState): void;
  setDim(on: boolean): void;
  setReducedMotion(on: boolean): void;
  unmount(): void;
}

export type RingLook = { scale: number; glow: number };

const MIN_SCALE = 0.6;
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Ring size (1 = full) and glow radius in px for a state. Pure, so the shape is testable. */
export function ringLook(state: BreathState, reduced: boolean, dim: boolean): RingLook {
  const p = state.progress;
  const ease = reduced ? (x: number) => x : smooth;
  const level = state.phase === "inhale" ? ease(p) : state.phase === "hold" ? 1 : 1 - ease(p);
  const scale = MIN_SCALE + (1 - MIN_SCALE) * level;
  // Reduced motion keeps the glow steady: size alone carries the breath.
  let glow = reduced ? 18 : 10 + 40 * level;
  if (dim) glow *= 0.6;
  if (state.paused) glow *= 0.5;
  return { scale, glow };
}

const q = (el: HTMLElement, name: string) => el.querySelector<HTMLElement>(`[data-${name}]`);

/** The soft glowing ring. Expects the markup rendered by `Breath`. */
export function createRing(): BreathVisual {
  let root: HTMLElement | null = null;
  let reduced = false;
  let dim = false;
  let last: BreathState | null = null;

  const setText = (el: HTMLElement | null, text: string) => {
    // Writing only on change keeps the live region quiet between phase changes.
    if (el && el.textContent !== text) el.textContent = text;
  };

  return {
    mount(el) {
      root = el;
    },
    draw(state) {
      last = state;
      if (!root) return;
      const { scale, glow } = ringLook(state, reduced, dim);
      const ring = q(root, "ring");
      ring?.style.setProperty("--ring-scale", scale.toFixed(4));
      ring?.style.setProperty("--ring-glow", `${glow.toFixed(1)}px`);
      setText(q(root, "count"), String(state.countdown));
      setText(q(root, "word"), PHASE_WORDS[state.phase]);
    },
    setDim(on) {
      dim = on;
      if (last) this.draw(last);
    },
    setReducedMotion(on) {
      reduced = on;
      if (last) this.draw(last);
    },
    unmount() {
      root = null;
    },
  };
}

const styles = stylex.create({
  screen: {
    minHeight: "100vh",
    boxSizing: "border-box",
    // Cancels the shell padding so the screen fills the window.
    margin: -24,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    // A swipe up on the resting screen opens the sheet, so the page must not claim it as a pan.
    touchAction: "none",
    textAlign: "center",
    color: colors.text,
  },
  button: {
    position: "relative",
    width: 260,
    height: 260,
    padding: 0,
    borderWidth: 0,
    borderRadius: "50%",
    backgroundColor: "transparent",
    color: colors.text,
    fontFamily: "inherit",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  // The ring is an outline, not a filled orb: the countdown sits in its open middle.
  ring: {
    position: "absolute",
    inset: 0,
    boxSizing: "border-box",
    borderRadius: "50%",
    borderWidth: 6,
    borderStyle: "solid",
    borderColor: colors.accentBreath,
    transform: "scale(var(--ring-scale, 0.6))",
    boxShadow: `0 0 var(--ring-glow, 10px) ${colors.accentBreath}, inset 0 0 var(--ring-glow, 10px) ${colors.accentBreath}`,
  },
  count: { position: "relative", fontSize: 72, fontWeight: 300, lineHeight: 1 },
  word: { margin: 0, fontSize: 22, lineHeight: 1.4, maxWidth: 320, minHeight: "2.8em" },
});

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** Seconds on the audio clock, or on performance.now() when there is no audio. */
function defaultNow(): () => number {
  const ctx = getSession()?.engine.ctx;
  return ctx ? () => ctx.currentTime : () => performance.now() / 1000;
}

type BreathProps = { now?: () => number; machine?: PhaseMachine; children?: ReactNode };

/** The resting screen: the ring, the phase word, and nothing else. */
export function Breath({ now, machine, children }: BreathProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [clock] = useState(() => now ?? defaultNow());
  const [phases] = useState(() => machine ?? createPhaseMachine(1));
  const [visual] = useState(createRing);
  const paused = useStore((s) => s.paused);
  const dim = useStore((s) => s.dim);

  useEffect(() => {
    const el = rootRef.current!;
    visual.mount(el);
    phases.start(clock());
    store.set({ paused: false });
    const mq = window.matchMedia?.(REDUCED_QUERY);
    visual.setReducedMotion(Boolean(mq?.matches));
    const onMotion = (e: MediaQueryListEvent) => visual.setReducedMotion(e.matches);
    mq?.addEventListener?.("change", onMotion);
    let frame = 0;
    const loop = () => {
      const state = phases.stateAt(clock());
      visual.draw(state);
      publishBreath(state);
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(frame);
      publishBreath(null);
      mq?.removeEventListener?.("change", onMotion);
      visual.unmount();
    };
  }, [visual, phases, clock]);

  useEffect(() => visual.setDim(dim), [visual, dim]);

  // Beats and phase tones need the audio engine; without one the ring still runs silently.
  useEffect(() => {
    const engine = getSession()?.engine;
    return engine ? startBeats({ machine: phases, clock, engine, store }) : undefined;
  }, [phases, clock]);

  const toggle = () => {
    const t = clock();
    if (phases.stateAt(t).paused) phases.resume(t);
    else phases.pause(t);
    store.set({ paused: phases.stateAt(t).paused });
    visual.draw(phases.stateAt(t));
  };

  return (
    <div ref={rootRef} {...stylex.props(styles.screen)}>
      <button
        type="button"
        aria-label={paused ? "Resume breathing guide" : "Pause breathing guide"}
        {...stylex.props(styles.button)}
        onClick={toggle}
      >
        <span data-ring {...stylex.props(styles.ring)} />
        <span data-count aria-hidden="true" {...stylex.props(styles.count)} />
      </button>
      <p data-word role="status" {...stylex.props(styles.word)} />
      {children}
    </div>
  );
}
