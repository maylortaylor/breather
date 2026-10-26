// Throwaway page for ticket 08: audition every synthesized sound and approve or reject it.
import * as stylex from "@stylexjs/stylex";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, ONE_SHOT_LAYER, trimOf, type Entry } from "../audio/catalog";
import type { Sound } from "../audio/engine";
import { DEFAULT_METRONOME_VOICE } from "../audio/metronome";
import { createModulator, type ModSnapshot } from "../audio/modulation";
import { LfoPanel, RowLfo } from "./Lfo";
import { createEngine, DEFAULT_LAYER, type Engine } from "../audio/engine";

type Verdict = "approve" | "reject";
const ONE_SHOTS = new Set(CATALOG.filter((e) => "once" in e).map((e) => e.id));
const STORAGE_KEY = "breather.lab.verdicts.v1";
const LFO_KEY = "breather.lab.lfo.v1";

const styles = stylex.create({
  page: {
    minHeight: "100vh",
    backgroundColor: "#0b1020",
    color: "#e8ecf8",
    padding: 24,
    maxWidth: 720,
    marginInline: "auto",
    fontSize: 16,
  },
  h2: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#9fb0d8",
    marginTop: 28,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 1fr) auto minmax(80px, 160px) auto",
    gap: 12,
    alignItems: "center",
    paddingBlock: 8,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#1d2745",
  },
  btn: {
    backgroundColor: "#1a2547",
    color: "#e8ecf8",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#3a4c85",
    borderRadius: 8,
    paddingBlock: 8,
    paddingInline: 14,
    fontSize: 15,
    cursor: "pointer",
  },
  on: { backgroundColor: "#2f6f5e", borderColor: "#7fe0c0" },
  bad: { backgroundColor: "#7a2f45", borderColor: "#f08aa5" },
  big: { fontSize: 18, paddingBlock: 12, paddingInline: 22 },
  verdicts: { display: "flex", gap: 6 },
  summary: {
    width: "100%",
    minHeight: 160,
    marginTop: 8,
    backgroundColor: "#111936",
    color: "#e8ecf8",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#3a4c85",
    borderRadius: 8,
    padding: 10,
    fontFamily: "ui-monospace, monospace",
    boxSizing: "border-box",
  },
});

function loadVerdicts(): Record<string, Verdict> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Verdict>) : {};
  } catch {
    return {};
  }
}

function loadLfo(): Partial<ModSnapshot> {
  try {
    const raw = localStorage.getItem(LFO_KEY);
    return raw ? (JSON.parse(raw) as Partial<ModSnapshot>) : {};
  } catch {
    return {};
  }
}

// One modulator for the page: it owns the LFO bank and the 50 ms update timer.
const modulator = createModulator(loadLfo());

function saveLfo() {
  try {
    localStorage.setItem(LFO_KEY, JSON.stringify(modulator.snapshot()));
  } catch {
    // Storage blocked: the LFO setup just will not persist.
  }
}

export function Lab() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [master, setMaster] = useState(0.7);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(loadVerdicts);
  const sounds = useRef(new Map<string, Sound>());
  const running = useRef(new Set<string>());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(verdicts));
    } catch {
      // Private mode or blocked storage: verdicts just will not persist.
    }
  }, [verdicts]);

  const volumeOf = (id: string) =>
    volumes[id] ?? (ONE_SHOTS.has(id) ? ONE_SHOT_LAYER : DEFAULT_LAYER);

  function begin() {
    const e = createEngine();
    void e.ctx.resume();
    e.setMaster(master);
    for (const entry of CATALOG) {
      e.setTrim(entry.id, trimOf(entry.id));
      e.setLayer(entry.id, volumeOf(entry.id));
    }
    modulator.setEngine(e);
    setEngine(e);
  }

  function toggle(entry: Extract<Entry, { loop: unknown }>) {
    if (!engine) return;
    let sound = sounds.current.get(entry.id);
    if (!sound) {
      sound = entry.loop(engine);
      sounds.current.set(entry.id, sound);
      engine.setLayer(entry.id, volumeOf(entry.id));
    }
    const on = !running.current.has(entry.id);
    if (on) {
      sound.start();
      running.current.add(entry.id);
    } else {
      sound.stop();
      running.current.delete(entry.id);
    }
    setPlaying((cur) => ({ ...cur, [entry.id]: on }));
  }

  function setVerdict(id: string, v: Verdict) {
    setVerdicts((cur) => {
      const next = { ...cur };
      if (cur[id] === v) delete next[id];
      else next[id] = v;
      return next;
    });
  }

  const groups = useMemo(() => {
    const out = new Map<string, Entry[]>();
    for (const e of CATALOG) out.set(e.group, [...(out.get(e.group) ?? []), e]);
    return [...out];
  }, []);

  const summary = CATALOG.filter((e) => verdicts[e.id])
    .map((e) => `${e.label.toLowerCase()}: ${verdicts[e.id]}`)
    .join("\n");

  return (
    <main {...stylex.props(styles.page)}>
      <h1>Listening Lab</h1>
      {!engine ? (
        <button {...stylex.props(styles.btn, styles.big)} onClick={begin}>
          Begin
        </button>
      ) : (
        <label>
          Master volume{" "}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={master}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              setMaster(v);
              engine.setMaster(v);
            }}
          />
        </label>
      )}

      <h2 {...stylex.props(styles.h2)}>LFO bank</h2>
      <LfoPanel modulator={modulator} onChange={saveLfo} />

      {groups.map(([group, entries]) => (
        <section key={group}>
          <h2 {...stylex.props(styles.h2)}>{group}</h2>
          {entries.map((entry) => (
            <div key={entry.id} {...stylex.props(styles.row)}>
              <span>
                {entry.label}
                {"once" in entry && entry.label === DEFAULT_METRONOME_VOICE ? " (default)" : ""}
              </span>
              {"loop" in entry ? (
                <button
                  {...stylex.props(styles.btn, playing[entry.id] && styles.on)}
                  disabled={!engine}
                  onClick={() => toggle(entry)}
                >
                  {playing[entry.id] ? "Stop" : "Play"}
                </button>
              ) : (
                <button
                  {...stylex.props(styles.btn)}
                  disabled={!engine}
                  onClick={() => {
                    if (!engine) return;
                    engine.setLayer(entry.id, volumeOf(entry.id));
                    entry.once(engine, engine.ctx.currentTime + 0.05, entry.id);
                  }}
                >
                  Play once
                </button>
              )}
              <input
                type="range"
                aria-label={`${entry.label} volume`}
                min={0}
                max={1}
                step={0.01}
                value={volumeOf(entry.id)}
                onChange={(ev) => {
                  const v = Number(ev.target.value);
                  setVolumes((cur) => ({ ...cur, [entry.id]: v }));
                  engine?.setLayer(entry.id, v);
                }}
              />
              <div {...stylex.props(styles.verdicts)}>
                <button
                  {...stylex.props(styles.btn, verdicts[entry.id] === "approve" && styles.on)}
                  aria-pressed={verdicts[entry.id] === "approve"}
                  onClick={() => setVerdict(entry.id, "approve")}
                >
                  Approve
                </button>
                <button
                  {...stylex.props(styles.btn, verdicts[entry.id] === "reject" && styles.bad)}
                  aria-pressed={verdicts[entry.id] === "reject"}
                  onClick={() => setVerdict(entry.id, "reject")}
                >
                  Reject
                </button>
              </div>
              {"loop" in entry && <RowLfo id={entry.id} modulator={modulator} onChange={saveLfo} />}
            </div>
          ))}
        </section>
      ))}

      <h2 {...stylex.props(styles.h2)}>Summary to copy back</h2>
      <textarea {...stylex.props(styles.summary)} readOnly value={summary} aria-label="Summary" />
    </main>
  );
}
