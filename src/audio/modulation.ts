import { createRng } from "./dsp";
import type { Engine } from "./engine";
import {
  clampPeriod,
  createLfoBank,
  DEFAULT_LFOS,
  modGain,
  type LfoBank,
  type LfoShape,
} from "./lfo";

const UPDATE_MS = 50;

/** 0 means no LFO; 1 to 3 pick one from the bank. */
export type LfoChoice = 0 | 1 | 2 | 3;

export interface Assignment {
  lfo: LfoChoice;
  depth: number;
}

export interface ModSnapshot {
  periods: number[];
  shapes: LfoShape[];
  assignments: Record<string, Assignment>;
}

export interface Modulator {
  readonly bank: LfoBank;
  /** Latest LFO values, refreshed every 50 ms. */
  readonly values: readonly number[];
  setEngine(engine: Engine): void;
  setPeriod(index: number, period: number): void;
  setShape(index: number, shape: LfoShape): void;
  assign(id: string, a: Assignment): void;
  assignmentOf(id: string): Assignment;
  /** Current modulation multiplier for a layer, 1 when it has no LFO. */
  gainOf(id: string): number;
  snapshot(): ModSnapshot;
  stop(): void;
}

/**
 * Samples the LFO bank on a ~50 ms timer and pushes each assigned layer's multiplier to its
 * modulation gain node. The node smooths the steps (setTargetAtTime), so there is no zipper noise.
 */
export function createModulator(saved?: Partial<ModSnapshot>): Modulator {
  const configs = DEFAULT_LFOS.map((c, i) => ({
    ...c,
    period: clampPeriod(saved?.periods?.[i] ?? c.period),
    shape: saved?.shapes?.[i] ?? c.shape,
  }));
  const bank = createLfoBank(configs, createRng(Math.floor(Math.random() * 2 ** 32)));
  const assignments = new Map<string, Assignment>(Object.entries(saved?.assignments ?? {}));
  const gains = new Map<string, number>();
  const values: number[] = bank.sample(performance.now() / 1000);
  let engine: Engine | null = null;
  // Layers we have modulated, so one that loses its LFO is reset to 1 exactly once.
  const touched = new Set<string>();

  const tick = () => {
    const sampled = bank.sample(performance.now() / 1000);
    sampled.forEach((v, i) => (values[i] = v));
    for (const [id, a] of assignments) {
      const g = a.lfo === 0 ? 1 : modGain(a.depth, values[a.lfo - 1] ?? 1);
      gains.set(id, g);
      if (a.lfo === 0 && !touched.has(id)) continue;
      engine?.setMod(id, g);
      if (a.lfo === 0) touched.delete(id);
      else touched.add(id);
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
    assign: (id, a) => {
      assignments.set(id, a);
    },
    assignmentOf: (id) => assignments.get(id) ?? { lfo: 0, depth: 0.5 },
    gainOf: (id) => gains.get(id) ?? 1,
    snapshot: () => ({
      periods: bank.lfos.map((l) => l.period),
      shapes: bank.lfos.map((l) => l.shape),
      assignments: Object.fromEntries(assignments),
    }),
    stop: () => clearInterval(timer),
  };
}
