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
 * Samples the LFO bank on a ~50 ms timer and pushes each LFO-driven layer's multiplier to its
 * modulation gain node. The node smooths the steps (setTargetAtTime), so there is no zipper noise.
 * `defaultMax` gives a sound's starting volume.
 */
export function createModulator(
  defaultMax: (id: string) => number,
  saved?: Partial<ModSnapshot>
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

  const tick = () => {
    const sampled = bank.sample(performance.now() / 1000);
    sampled.forEach((v, i) => (values[i] = v));
    for (const [id, r] of rows) {
      if (r.lfo === 0) {
        if (touched.delete(id)) engine?.setMod(id, 1);
        continue;
      }
      touched.add(id);
      engine?.setMod(id, modGain(r.min, r.max, values[r.lfo - 1] ?? 1));
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
