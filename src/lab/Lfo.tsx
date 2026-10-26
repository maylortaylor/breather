// Throwaway Lab UI: the LFO bank, the per-row volume control (single or range slider), and the
// small "i" help bubbles.
import * as stylex from "@stylexjs/stylex";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MAX_PERIOD, MIN_PERIOD, type LfoShape } from "../audio/lfo";
import type { LfoChoice, Modulator, RowSetting } from "../audio/modulation";
import {
  createDelayedAction,
  LONG_PRESS_MS,
  TOOLTIP_DELAY_MS,
  type DelayedAction,
} from "./tooltipTimer";

const FRAME_MS = 33;
const REDUCED_FRAME_MS = 250;
const NEUTRAL = "#7f93d0";
const THUMB = 18;
const LFO_NAMES = ["teal", "violet", "amber"];

// One shared requestAnimationFrame loop, about 30 fps, idle while the tab is hidden.
const subscribers = new Set<(now: number) => void>();
let raf = 0;
let last = 0;
const reduced = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function loop(now: number) {
  raf = 0;
  if (subscribers.size === 0 || document.hidden) return;
  if (now - last >= (reduced() ? REDUCED_FRAME_MS : FRAME_MS)) {
    last = now;
    for (const cb of subscribers) cb(now / 1000);
  }
  raf = requestAnimationFrame(loop);
}

function useFrame(cb: (nowSec: number) => void) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  useEffect(() => {
    const fn = (t: number) => ref.current(t);
    subscribers.add(fn);
    const wake = () => {
      if (!document.hidden && !raf) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      subscribers.delete(fn);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
}

const styles = stylex.create({
  panel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 12,
    marginBlock: 16,
  },
  card: {
    backgroundColor: "#111936",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#2a3869",
    borderRadius: 10,
    padding: 12,
  },
  title: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 6 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  trace: { width: "100%", height: 48, display: "block", marginBlock: 6 },
  inline: { display: "flex", alignItems: "center", gap: 6 },
  toggles: { display: "flex", alignItems: "center", gap: 6, marginTop: 6 },
  small: {
    backgroundColor: "#1a2547",
    color: "#e8ecf8",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#3a4c85",
    borderRadius: 6,
    paddingBlock: 4,
    paddingInline: 10,
    fontSize: 13,
    cursor: "pointer",
  },
  smallOn: { backgroundColor: "#2f4a8a", borderColor: "#9db4ff" },
  dots: { display: "inline-flex", gap: 0 },
  dotBtn: {
    width: 34,
    height: 34,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 24,
    height: 24,
    boxSizing: "border-box",
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.8,
  },
  dotOn: { opacity: 1, boxShadow: "0 0 0 2px #0b1020, 0 0 0 4px #ffffff" },
  cell: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#b8c4e8" },
  slider: { position: "relative", height: 28, flexGrow: 1 },
  bar: {
    position: "absolute",
    insetInline: 0,
    top: 10,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0e152d",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#2a3869",
    boxSizing: "border-box",
  },
  band: { position: "absolute", top: 10, height: 8, opacity: 0.28 },
  fill: { position: "absolute", top: 10, height: 8, borderRadius: 4, left: 0 },
  range: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: 28,
    margin: 0,
    backgroundColor: "transparent",
    appearance: "none",
    pointerEvents: "none",
    "::-webkit-slider-thumb": {
      appearance: "none",
      pointerEvents: "auto",
      width: THUMB,
      height: THUMB,
      borderRadius: "50%",
      backgroundColor: "#ffffff",
      borderWidth: 3,
      borderStyle: "solid",
      borderColor: "var(--thumb)",
      boxSizing: "border-box",
      cursor: "grab",
    },
    "::-moz-range-thumb": {
      pointerEvents: "auto",
      width: THUMB,
      height: THUMB,
      borderRadius: "50%",
      backgroundColor: "#ffffff",
      borderWidth: 3,
      borderStyle: "solid",
      borderColor: "var(--thumb)",
      boxSizing: "border-box",
      cursor: "grab",
    },
    "::-webkit-slider-runnable-track": { backgroundColor: "transparent" },
    "::-moz-range-track": { backgroundColor: "transparent" },
  },
  tipWrap: { position: "relative", display: "inline-flex", alignItems: "center", gap: 6 },
  tipFill: { flexGrow: 1, minWidth: 0 },
  tipVolume: { flexGrow: 2, flexBasis: 220, minWidth: 150, display: "flex" },
  tip: {
    position: "fixed",
    zIndex: 20,
    width: "max-content",
    maxWidth: "min(260px, calc(100vw - 16px))",
    padding: "8px 10px",
    borderRadius: 8,
    backgroundColor: "#060a18",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#5a6fae",
    color: "#e8ecf8",
    fontSize: 13,
    lineHeight: 1.35,
    textAlign: "left",
    pointerEvents: "none",
  },
});

/**
 * Wraps a control (or a small group of them) with a one-line tooltip. It shows after the pointer or
 * keyboard focus rests on the control for 4 s, or after a 600 ms touch long press; it hides on
 * leave, blur, Escape, scroll or a tap elsewhere. The text is linked to every control inside with
 * aria-describedby at all times, so screen readers get it without the delay.
 */
export function Tip({
  text,
  grow,
  children,
}: {
  text: string;
  grow?: "fill" | "volume";
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const hideSoon = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set after a touch long press so the lift of the finger does not also click the control.
  const swallowClick = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const timers = useRef<{ hover: DelayedAction; press: DelayedAction } | null>(null);

  useEffect(() => {
    const hover = createDelayedAction(TOOLTIP_DELAY_MS, () => setOpen(true));
    const press = createDelayedAction(LONG_PRESS_MS, () => {
      swallowClick.current = true;
      setOpen(true);
    });
    timers.current = { hover, press };
    return () => {
      hover.cancel();
      press.cancel();
      timers.current = null;
    };
  }, []);

  const hide = useCallback(() => {
    timers.current?.hover.cancel();
    timers.current?.press.cancel();
    if (hideSoon.current) clearTimeout(hideSoon.current);
    hideSoon.current = null;
    setOpen(false);
  }, []);

  // Link the text to every focusable control inside, whether or not the bubble is showing.
  useEffect(() => {
    for (const el of wrap.current?.querySelectorAll("button, input, select, [role=group]") ?? []) {
      el.setAttribute("aria-describedby", id);
    }
  });

  // While open: close on Escape, scroll, or a pointer press anywhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && hide();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [open, hide]);

  // Keep the bubble inside the viewport, below the control (so it never covers a thumb), or above
  // it when there is no room below.
  useLayoutEffect(() => {
    const t = tip.current;
    const w = wrap.current;
    if (!open || !t || !w) return;
    const r = w.getBoundingClientRect();
    const b = t.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), Math.max(8, innerWidth - b.width - 8));
    const below = r.bottom + 8;
    const top = below + b.height > innerHeight - 8 ? Math.max(8, r.top - b.height - 8) : below;
    t.style.left = `${left}px`;
    t.style.top = `${top}px`;
    t.style.visibility = "visible";
  }, [open]);

  return (
    <span
      ref={wrap}
      {...stylex.props(
        styles.tipWrap,
        grow === "fill" && styles.tipFill,
        grow === "volume" && styles.tipVolume
      )}
      onPointerEnter={(ev) => {
        if (ev.pointerType === "mouse") timers.current?.hover.start();
      }}
      onPointerMove={(ev) => {
        if (ev.pointerType === "mouse" && !open) timers.current?.hover.start();
        const t0 = touchStart.current;
        if (t0 && Math.hypot(ev.clientX - t0.x, ev.clientY - t0.y) > 10) {
          timers.current?.press.cancel();
        }
      }}
      onPointerLeave={(ev) => {
        if (ev.pointerType === "mouse") hide();
      }}
      onPointerDownCapture={(ev) => {
        swallowClick.current = false;
        if (ev.pointerType === "mouse") {
          hide();
        } else {
          touchStart.current = { x: ev.clientX, y: ev.clientY };
          timers.current?.press.start();
        }
      }}
      onPointerUp={() => {
        timers.current?.press.cancel();
        touchStart.current = null;
        if (open && swallowClick.current) {
          hideSoon.current = setTimeout(hide, 1500);
        }
      }}
      onPointerCancel={() => {
        timers.current?.press.cancel();
        touchStart.current = null;
      }}
      onClickCapture={(ev) => {
        if (swallowClick.current) {
          swallowClick.current = false;
          ev.preventDefault();
          ev.stopPropagation();
        }
      }}
      onContextMenu={(ev) => {
        if (swallowClick.current || timers.current?.press.pending) ev.preventDefault();
      }}
      onFocus={(ev) => {
        if ((ev.target as HTMLElement).matches(":focus-visible")) timers.current?.hover.start();
      }}
      onBlur={hide}
    >
      {children}
      <span
        ref={tip}
        id={id}
        role="tooltip"
        hidden={!open}
        style={{ visibility: "hidden" }}
        {...stylex.props(styles.tip)}
      >
        {text}
      </span>
    </span>
  );
}

interface Props {
  modulator: Modulator;
  /** Called after any LFO or row change so the Lab can persist it. */
  onChange: () => void;
}

interface Sample {
  t: number;
  v: number;
}

function LfoCard({ modulator, index, onChange }: Props & { index: number }) {
  const lfo = modulator.bank.lfos[index]!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<Sample[]>([]);
  const [period, setPeriod] = useState(lfo.period);
  const [shape, setShape] = useState<LfoShape>(lfo.shape);

  useFrame((now) => {
    const c = canvas.current;
    if (!c) return;
    const list = history.current;
    list.push({ t: now, v: modulator.values[index] ?? 1 });
    while (list.length > 1 && now - (list[0]?.t ?? now) > lfo.period + 1) list.shift();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = lfo.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    list.forEach((s, i) => {
      const x = w - ((now - s.t) / lfo.period) * (w - 6) - 3;
      const y = h - 4 - s.v * (h - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    const tip = list[list.length - 1];
    if (tip) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(w - 3, h - 4 - tip.v * (h - 8), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return (
    <div {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.title)}>
        <span {...stylex.props(styles.swatch)} style={{ backgroundColor: lfo.color }} />
        LFO {index + 1} <span style={{ color: "#9fb0d8" }}>{period} s per cycle</span>
      </div>
      <canvas ref={canvas} width={260} height={48} {...stylex.props(styles.trace)} />
      <div {...stylex.props(styles.inline)}>
        <Tip text="How long one full rise and fall takes, 8 s to 120 s." grow="fill">
          <input
            type="range"
            aria-label={`LFO ${index + 1} period`}
            min={MIN_PERIOD}
            max={MAX_PERIOD}
            step={1}
            value={period}
            style={{ width: "100%" }}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              modulator.setPeriod(index, v);
              setPeriod(modulator.bank.lfos[index]?.period ?? v);
              onChange();
            }}
          />
        </Tip>
      </div>
      <div {...stylex.props(styles.toggles)}>
        <Tip text="Sine rises and falls evenly. Smooth random wanders and never repeats.">
          {(["sine", "smooth-random"] as const).map((s) => (
            <button
              key={s}
              aria-pressed={shape === s}
              {...stylex.props(styles.small, shape === s && styles.smallOn)}
              onClick={() => {
                modulator.setShape(index, s);
                setShape(s);
                onChange();
              }}
            >
              {s === "sine" ? "Sine" : "Smooth random"}
            </button>
          ))}
        </Tip>
      </div>
    </div>
  );
}

export function LfoPanel(props: Props) {
  return (
    <div {...stylex.props(styles.panel)}>
      {[0, 1, 2].map((i) => (
        <LfoCard key={i} index={i} {...props} />
      ))}
    </div>
  );
}

const pos = (v: number) => `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${v})`;

/**
 * The one volume control for a row. No LFO: a single volume slider. With an LFO: a range slider,
 * right thumb = loudest, left thumb = quietest, and the LFO-colored fill ends at the live level.
 * Also renders the LFO picker for loop rows. `onVolume` receives the maximum volume.
 */
export function RowVolume({
  id,
  name,
  withLfo,
  modulator,
  onVolume,
  onChange,
}: Props & {
  id: string;
  name: string;
  withLfo: boolean;
  onVolume: (max: number) => void;
}) {
  const [row, setRow] = useState<RowSetting>(() => modulator.rowOf(id));
  const fill = useRef<HTMLDivElement>(null);
  const color = row.lfo === 0 ? NEUTRAL : (modulator.bank.lfos[row.lfo - 1]?.color ?? NEUTRAL);
  const ranged = row.lfo !== 0;

  useFrame(() => {
    if (fill.current) fill.current.style.width = pos(modulator.levelOf(id));
  });

  const update = (next: RowSetting) => {
    setRow(next);
    modulator.setRow(id, next);
    onVolume(next.max);
    onChange();
  };

  const thumbVars = { "--thumb": color } as CSSProperties;

  return (
    <>
      <Tip
        grow="volume"
        text={
          ranged
            ? "Right thumb: the loudest this sound gets. Left thumb: the quietest it gets as the LFO swings. The colored fill shows the level right now."
            : "How loud this sound is."
        }
      >
        <span {...stylex.props(styles.slider)}>
          <span {...stylex.props(styles.bar)} />
          {ranged && (
            <span
              {...stylex.props(styles.band)}
              style={{
                left: pos(row.min),
                width: `calc((100% - ${THUMB}px) * ${row.max - row.min})`,
                backgroundColor: color,
              }}
            />
          )}
          <span
            ref={fill}
            {...stylex.props(styles.fill)}
            style={{ width: pos(row.max), backgroundColor: color, opacity: ranged ? 0.9 : 0.45 }}
          />
          {ranged && (
            <input
              type="range"
              aria-label={`${name} minimum volume`}
              min={0}
              max={1}
              step={0.01}
              value={row.min}
              {...stylex.props(styles.range)}
              style={{ ...thumbVars, zIndex: row.min > 0.5 ? 3 : 1 }}
              onChange={(ev) => update({ ...row, min: Math.min(Number(ev.target.value), row.max) })}
            />
          )}
          <input
            type="range"
            aria-label={ranged ? `${name} maximum volume` : `${name} volume`}
            min={0}
            max={1}
            step={0.01}
            value={row.max}
            {...stylex.props(styles.range)}
            style={{ ...thumbVars, zIndex: 2 }}
            onChange={(ev) => update({ ...row, max: Math.max(Number(ev.target.value), row.min) })}
          />
        </span>
      </Tip>
      {withLfo && (
        <Tip text="Tap a color to let that slow wave move this sound's volume. Tap it again to stop.">
          <span role="group" aria-label={`${name} LFO`} {...stylex.props(styles.dots)}>
            {modulator.bank.lfos.map((lfo, i) => {
              const choice = (i + 1) as LfoChoice;
              const active = row.lfo === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={active}
                  aria-label={`LFO ${choice} (${LFO_NAMES[i]})`}
                  {...stylex.props(styles.dotBtn)}
                  onClick={() => {
                    const next = active ? 0 : choice;
                    // Leave room to swing: if the thumbs are stacked, start the minimum below the maximum.
                    const min = next !== 0 && row.min >= row.max ? row.max * 0.4 : row.min;
                    update({ ...row, lfo: next, min });
                  }}
                >
                  <span
                    {...stylex.props(styles.dot, active && styles.dotOn)}
                    style={{
                      borderColor: lfo.color,
                      backgroundColor: active ? lfo.color : "transparent",
                      color: active ? "#0b1020" : lfo.color,
                    }}
                  >
                    {choice}
                  </span>
                </button>
              );
            })}
          </span>
        </Tip>
      )}
    </>
  );
}
