// Throwaway Lab UI: the LFO bank, the per-row volume control (single or range slider), and the
// small "i" help bubbles.
import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MAX_PERIOD, MIN_PERIOD, type LfoShape } from "../audio/lfo";
import type { LfoChoice, Modulator, RowSetting } from "../audio/modulation";

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
  volume: { flexGrow: 2, flexBasis: 220, minWidth: 150 },
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
  infoWrap: { position: "relative", display: "inline-flex" },
  infoBtn: {
    width: 20,
    height: 20,
    padding: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#5a6fae",
    backgroundColor: "transparent",
    color: "#b8c4e8",
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Georgia, serif",
    cursor: "help",
    lineHeight: 1,
  },
  tip: {
    position: "absolute",
    top: 26,
    zIndex: 20,
    width: "max-content",
    maxWidth: "min(240px, 70vw)",
    padding: "8px 10px",
    borderRadius: 8,
    backgroundColor: "#060a18",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#5a6fae",
    color: "#e8ecf8",
    fontSize: 13,
    lineHeight: 1.35,
    fontStyle: "normal",
    textAlign: "left",
  },
  tipLeft: { left: -4 },
  tipRight: { right: -4 },
});

/** The "i" button and its one-line bubble. Hover, keyboard focus or tap opens it; Escape or a tap elsewhere closes it. */
export function Info({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPinned(false);
    };
    const onDown = (ev: PointerEvent) => {
      if (!wrap.current?.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrap} {...stylex.props(styles.infoWrap)}>
      <button
        type="button"
        aria-label="More info"
        aria-describedby={id}
        aria-expanded={open}
        {...stylex.props(styles.infoBtn)}
        onPointerEnter={(ev) => ev.pointerType === "mouse" && setOpen(true)}
        onPointerLeave={(ev) => ev.pointerType === "mouse" && !pinned && setOpen(false)}
        onFocus={(ev) => ev.currentTarget.matches(":focus-visible") && setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setPinned(false);
        }}
        onClick={() => {
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        {...stylex.props(styles.tip, align === "left" ? styles.tipLeft : styles.tipRight)}
      >
        {text}
      </span>
    </span>
  );
}

/** A control with its "i" next to it. */
export function WithInfo({
  info,
  align,
  children,
}: {
  info: string;
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <span {...stylex.props(styles.cell)}>
      {children}
      <Info text={info} align={align} />
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
        <input
          type="range"
          aria-label={`LFO ${index + 1} period`}
          min={MIN_PERIOD}
          max={MAX_PERIOD}
          step={1}
          value={period}
          style={{ flexGrow: 1, minWidth: 0 }}
          onChange={(ev) => {
            const v = Number(ev.target.value);
            modulator.setPeriod(index, v);
            setPeriod(modulator.bank.lfos[index]?.period ?? v);
            onChange();
          }}
        />
        <Info text="How long one full rise and fall takes, 8 s to 120 s." align="right" />
      </div>
      <div {...stylex.props(styles.toggles)}>
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
        <Info
          text="Sine rises and falls evenly. Smooth random wanders and never repeats."
          align="right"
        />
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
      <span {...stylex.props(styles.cell, styles.volume)}>
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
        <Info
          text={
            ranged
              ? "Right thumb: the loudest this sound gets. Left thumb: the quietest it gets as the LFO swings. The colored fill shows the level right now."
              : "How loud this sound is."
          }
        />
      </span>
      {withLfo && (
        <WithInfo info="Tap a color to let that slow wave move this sound's volume. Tap it again to stop.">
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
        </WithInfo>
      )}
    </>
  );
}
