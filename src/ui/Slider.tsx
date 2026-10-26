import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LfoChoice, Modulator, RowSetting } from "../audio/modulation";
import { colors } from "../theme.stylex";
import { Tip } from "./Tip";

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

export function useFrame(cb: (nowSec: number) => void) {
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
});

const plain = stylex.create({
  wrap: { display: "flex", alignItems: "center", gap: 12, color: colors.tabInk, fontSize: 16 },
  label: { minWidth: 64 },
  input: { flexGrow: 1, minWidth: 0, height: 28, margin: 0, accentColor: colors.thumb },
});

/** One plain volume slider (0..1). The row slider above is for sounds that can have an LFO. */
export function Slider({
  label,
  value,
  onChange,
  tip,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tip: string;
}) {
  return (
    <Tip text={tip} grow="fill">
      <label {...stylex.props(plain.wrap)}>
        <span {...stylex.props(plain.label)}>{label}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          {...stylex.props(plain.input)}
          onChange={(ev) => onChange(Number(ev.target.value))}
        />
      </label>
    </Tip>
  );
}

interface Props {
  modulator: Modulator;
  /** Called after any LFO or row change so the caller can persist it. */
  onChange: () => void;
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
  lfoColors,
  digitInk,
}: Props & {
  id: string;
  name: string;
  withLfo: boolean;
  onVolume: (max: number) => void;
  /** Overrides the bank's LFO colours, e.g. with the theme's deepened ones. */
  lfoColors?: readonly string[];
  /** Colour of an unselected LFO button's number, when the LFO colour is too faint for text. */
  digitInk?: string;
}) {
  const colorOf = (i: number) => lfoColors?.[i] ?? modulator.bank.lfos[i]?.color ?? NEUTRAL;
  const [row, setRow] = useState<RowSetting>(() => modulator.rowOf(id));
  const fill = useRef<HTMLDivElement>(null);
  const color = row.lfo === 0 ? NEUTRAL : colorOf(row.lfo - 1);
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
            {modulator.bank.lfos.map((_lfo, i) => {
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
                      borderColor: colorOf(i),
                      backgroundColor: active ? colorOf(i) : "transparent",
                      color: active ? "#0b1020" : (digitInk ?? colorOf(i)),
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
