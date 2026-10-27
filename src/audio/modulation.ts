import { createRng } from "./dsp";
import type { Engine } from "./engine";
import {
  clampPeriod,
  createLfoBank,
  DEFAULT_LFOS,
  levelAt,
  modGain,
  type LfoBank,
  type LfoShape,
} from "./lfo";

const UPDATE_MS = 50;
/** Seconds of LFO motion scheduled ahead on the audio clock while the page is visible. */
const AHEAD_SEC = 0.25;
/** The same while hidden or locked, when timers fire about once a second and must be covered. */
const HIDDEN_AHEAD_SEC = 3;
/** Spacing of the ramp points handed to the audio clock. */
const STEP_SEC = 0.05;

/** 0 means no LFO; 1 to 3 pick one from the bank. */
export type LfoChoice = 0 | 1 | 2 | 3;

/** One sound's volume setup. Without an LFO the volume is `max`; with one it swings min to max. */
export interface RowSetting {
  lfo: LfoChoice;
  min: number;
  max: number;
}

export interface ModSnapshot {
  periods: number[];
  shapes: LfoShape[];
  rows: Record<string, RowSetting>;
}

export interface Modulator {
  readonly bank: LfoBank;
  /** Latest LFO values, refreshed every 50 ms. */
  readonly values: readonly number[];
  setEngine(engine: Engine): void;
  setPeriod(index: number, period: number): void;
  setShape(index: number, shape: LfoShape): void;
  setRow(id: string, row: RowSetting): void;
  rowOf(id: string): RowSetting;
  /** Slider-space level right now: the live LFO level, or the maximum when there is no LFO. */
  levelOf(id: string): number;
  snapshot(): ModSnapshot;
  stop(): void;
}

/**
 * Samples the LFO bank on a ~50 ms timer and schedules each LFO-driven layer's multiplier a little
 * ahead as a ramp on the audio clock. A locked phone throttles the timer to about once a second;
 * the ramps keep the volume moving smoothly through the gap instead of stepping. `defaultMax`
 * gives a sound's starting volume.
 */
export function createModulator(
  defaultMax: (id: string) => number,
  saved?: Partial<ModSnapshot>,
  hidden: () => boolean = () => typeof document !== "undefined" && document.hidden
): Modulator {
  const configs = DEFAULT_LFOS.map((c, i) => ({
    ...c,
    period: clampPeriod(saved?.periods?.[i] ?? c.period),
    shape: saved?.shapes?.[i] ?? c.shape,
  }));
  const bank = createLfoBank(configs, createRng(Math.floor(Math.random() * 2 ** 32)));
  const rows = new Map<string, RowSetting>(Object.entries(saved?.rows ?? {}));
  const values: number[] = bank.sample(performance.now() / 1000);
  let engine: Engine | null = null;
  // Layers we have modulated, so one that loses its LFO is reset to 1 exactly once.
  const touched = new Set<string>();

  const rowOf = (id: string): RowSetting => {
    const max = defaultMax(id);
    return rows.get(id) ?? { lfo: 0, min: max * 0.4, max };
  };

  // LFO values already sampled for the near future. The LFOs only move forward in time, so a
  // sample is taken once and kept until its moment passes.
  let ahead: { t: number; vec: number[] }[] = [];

  const tick = () => {
    const now = performance.now() / 1000;
    const goal = now + (hidden() ? HIDDEN_AHEAD_SEC : AHEAD_SEC);
    // A long freeze leaves nothing worth replaying: start again from now.
    if (ahead.length && ahead[ahead.length - 1]!.t < now) ahead = [];
    if (!ahead.length) ahead.push({ t: now, vec: bank.sample(now) });
    let t = ahead[ahead.length - 1]!.t;
    while (t < goal) {
      t += STEP_SEC;
      ahead.push({ t, vec: bank.sample(t) });
    }
    ahead = ahead.filter((p, i) => p.t >= now || i === ahead.length - 1 || ahead[i + 1]!.t >= now);
    // The readout follows the present, not the scheduled future.
    const current = [...ahead].reverse().find((p) => p.t <= now + STEP_SEC) ?? ahead[0]!;
    current.vec.forEach((v, i) => (values[i] = v));
    const clockNow = engine?.ctx.currentTime ?? 0;
    for (const [id, r] of rows) {
      if (r.lfo === 0) {
        if (touched.delete(id)) engine?.setMod(id, 1);
        continue;
      }
      touched.add(id);
      engine?.rampMod(
        id,
        ahead
          .filter((p) => p.t >= now)
          .map((p) => ({
            at: clockNow + (p.t - now),
            value: modGain(r.min, r.max, p.vec[r.lfo - 1] ?? 1),
          }))
      );
    }
  };
  const timer = setInterval(tick, UPDATE_MS);

  return {
    bank,
    values,
    setEngine: (e) => {
      engine = e;
    },
    setPeriod: (i, p) => bank.lfos[i]?.setPeriod(p),
    setShape: (i, s) => bank.lfos[i]?.setShape(s),
    setRow: (id, row) => {
      rows.set(id, row);
    },
    rowOf,
    levelOf: (id) => {
      const r = rowOf(id);
      return r.lfo === 0 ? r.max : levelAt(r.min, r.max, values[r.lfo - 1] ?? 1);
    },
    snapshot: () => ({
      periods: bank.lfos.map((l) => l.period),
      shapes: bank.lfos.map((l) => l.shape),
      rows: Object.fromEntries(rows),
    }),
    stop: () => clearInterval(timer),
  };
}
