// Throwaway Lab UI for the LFO bank: a panel of three LFOs and a per-row picker with a live bar.
import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { MAX_PERIOD, MIN_PERIOD, type LfoShape } from "../audio/lfo";
import type { LfoChoice, Modulator } from "../audio/modulation";

const FRAME_MS = 33;
const REDUCED_FRAME_MS = 250;
const NEUTRAL = "#5a6a99";

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
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
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
  toggles: { display: "flex", gap: 6, marginTop: 6 },
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
  rowLfo: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    fontSize: 13,
    color: "#b8c4e8",
  },
  select: {
    backgroundColor: "#1a2547",
    color: "#e8ecf8",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#3a4c85",
    borderRadius: 6,
    paddingBlock: 4,
    paddingInline: 8,
    fontSize: 13,
  },
  track: {
    position: "relative",
    flexGrow: 1,
    minWidth: 120,
    height: 12,
    backgroundColor: "#0e152d",
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#2a3869",
    overflow: "hidden",
  },
  fill: { position: "absolute", insetBlock: 0, left: 0, borderRadius: 6 },
  dot: {
    position: "absolute",
    top: 1,
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
});

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
      </div>
    </div>
  );
}

interface Props {
  modulator: Modulator;
  /** Called after any LFO or assignment change so the Lab can persist it. */
  onChange: () => void;
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

/** LFO picker, depth slider and live level bar for one loop row. */
export function RowLfo({ id, modulator, onChange }: Props & { id: string }) {
  const [a, setA] = useState(() => modulator.assignmentOf(id));
  const fill = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const color = a.lfo === 0 ? NEUTRAL : (modulator.bank.lfos[a.lfo - 1]?.color ?? NEUTRAL);

  useFrame(() => {
    if (fill.current) fill.current.style.width = `${modulator.gainOf(id) * 100}%`;
    if (dot.current) {
      const v = a.lfo === 0 ? null : (modulator.values[a.lfo - 1] ?? 1);
      dot.current.style.display = v === null ? "none" : "block";
      if (v !== null) dot.current.style.left = `${v * 100}%`;
    }
  });

  const update = (next: typeof a) => {
    setA(next);
    modulator.assign(id, next);
    onChange();
  };

  return (
    <div {...stylex.props(styles.rowLfo)}>
      <label>
        LFO{" "}
        <select
          {...stylex.props(styles.select)}
          value={a.lfo}
          onChange={(ev) => update({ ...a, lfo: Number(ev.target.value) as LfoChoice })}
        >
          <option value={0}>None</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>
      <label>
        Depth{" "}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={a.depth}
          disabled={a.lfo === 0}
          onChange={(ev) => update({ ...a, depth: Number(ev.target.value) })}
        />
      </label>
      <div {...stylex.props(styles.track)} aria-hidden="true">
        <div
          ref={fill}
          {...stylex.props(styles.fill)}
          style={{ backgroundColor: color, opacity: a.lfo === 0 ? 0.35 : 0.85 }}
        />
        <div ref={dot} {...stylex.props(styles.dot)} />
      </div>
    </div>
  );
}
