import * as stylex from "@stylexjs/stylex";
import { useRef, useState } from "react";
import { MAX_PERIOD, MIN_PERIOD, type LfoShape } from "../audio/lfo";
import type { Modulator } from "../audio/modulation";
import type { Mix } from "../presets";
import { colors } from "../theme.stylex";
import { useFrame } from "./Slider";
import { periodText, SHAPE_LABELS } from "./soundsLogic";
import { Tip } from "./Tip";

const LFO_COLORS = [colors.lfoTeal, colors.lfoViolet, colors.lfoAmber];
const NAMES = ["teal", "violet", "amber"];

const styles = stylex.create({
  box: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  summary: {
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    paddingInline: 16,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  body: { display: "flex", flexDirection: "column", gap: 12, padding: 12, paddingTop: 0 },
  hint: { margin: 0, fontSize: 14, color: colors.textMuted, lineHeight: 1.4 },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.thumb,
  },
  title: { display: "flex", alignItems: "center", gap: 8, fontSize: 15 },
  swatch: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  trace: { width: "100%", height: 48, display: "block" },
  range: { width: "100%", accentColor: colors.thumb },
  shapes: { display: "flex", flexWrap: "wrap", gap: 8 },
  shape: {
    minHeight: 44,
    paddingInline: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.accentSounds,
    backgroundColor: "transparent",
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
  },
  shapeOn: { backgroundColor: colors.accentSounds, color: colors.bg, fontWeight: 700 },
});

interface Sample {
  t: number;
  v: number;
}

/** One LFO's last full cycle, scrolling left, drawn from the modulator's live value. */
function Trace({ modulator, index }: { modulator: Modulator; index: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<Sample[]>([]);
  useFrame((now) => {
    const c = canvas.current;
    const lfo = modulator.bank.lfos[index];
    const ctx = c?.getContext("2d");
    if (!c || !lfo || !ctx) return;
    const list = history.current;
    list.push({ t: now, v: modulator.values[index] ?? 1 });
    while (list.length > 1 && now - (list[0]?.t ?? now) > lfo.period + 1) list.shift();
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
      ctx.fillStyle = lfo.color;
      ctx.beginPath();
      ctx.arc(w - 3, h - 4 - tip.v * (h - 8), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return (
    <canvas
      ref={canvas}
      width={300}
      height={48}
      aria-hidden="true"
      {...stylex.props(styles.trace)}
    />
  );
}

interface Props {
  modulator: Modulator;
  lfos: Mix["lfos"];
  onChange: (index: 0 | 1 | 2, patch: { period?: number; shape?: LfoShape }) => void;
}

/** A collapsed-by-default panel: each LFO's live trace, its period and its shape. */
export function LfoPanel({ modulator, lfos, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <details
      {...stylex.props(styles.box)}
      onToggle={(ev) => setOpen((ev.currentTarget as HTMLDetailsElement).open)}
    >
      <summary {...stylex.props(styles.summary)}>Volume waves (LFOs)</summary>
      {open && (
        <div {...stylex.props(styles.body)}>
          <p {...stylex.props(styles.hint)}>
            Three slow waves that raise and lower the volume of sounds you give an LFO. Saved with
            each preset.
          </p>
          {([0, 1, 2] as const).map((i) => (
            <div key={i} role="group" aria-label={`LFO ${i + 1}`} {...stylex.props(styles.card)}>
              <div {...stylex.props(styles.title)}>
                <span
                  aria-hidden="true"
                  {...stylex.props(styles.swatch)}
                  style={{ backgroundColor: LFO_COLORS[i] }}
                />
                LFO {i + 1} ({NAMES[i]}): {lfos[i].period} s per cycle
              </div>
              <Trace modulator={modulator} index={i} />
              <Tip text="How long one full rise and fall takes." grow="fill">
                <input
                  type="range"
                  aria-label={`LFO ${i + 1} speed`}
                  aria-valuetext={periodText(lfos[i].period)}
                  min={MIN_PERIOD}
                  max={MAX_PERIOD}
                  step={1}
                  value={lfos[i].period}
                  {...stylex.props(styles.range)}
                  onChange={(ev) => onChange(i, { period: Number(ev.target.value) })}
                />
              </Tip>
              <div {...stylex.props(styles.shapes)}>
                {(["sine", "smooth-random"] as const).map((s) => (
                  <Tip
                    key={s}
                    text={s === "sine" ? "Rises and falls evenly." : "Wanders without repeating."}
                  >
                    <button
                      type="button"
                      aria-pressed={lfos[i].shape === s}
                      aria-label={`LFO ${i + 1} ${SHAPE_LABELS[s]}`}
                      {...stylex.props(styles.shape, lfos[i].shape === s && styles.shapeOn)}
                      onClick={() => onChange(i, { shape: s })}
                    >
                      {SHAPE_LABELS[s]}
                    </button>
                  </Tip>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
