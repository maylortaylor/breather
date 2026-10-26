// Throwaway Lab UI: the LFO bank. The row volume slider and the tooltip live in src/ui/.
import * as stylex from "@stylexjs/stylex";
import { useRef, useState } from "react";
import { MAX_PERIOD, MIN_PERIOD, type LfoShape } from "../audio/lfo";
import type { Modulator } from "../audio/modulation";
import { useFrame } from "../ui/Slider";
import { Tip } from "../ui/Tip";

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
  cell: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#b8c4e8" },
});

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
