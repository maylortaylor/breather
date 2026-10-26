// The 4-7-8 phase machine. Pure: time is injected in seconds, so it runs the same on the audio
// clock, on performance.now(), and in a test.

export type Phase = "inhale" | "hold" | "exhale";

export type BreathState = {
  phase: Phase;
  /** 0..1 through the current phase. */
  progress: number;
  /** Whole beats left in the phase, counting the current one. */
  countdown: number;
  /** Beat within the cycle, 0..18. */
  beat: number;
  paused: boolean;
};

export type Beat = {
  /** When the beat sounds, in injected seconds. */
  at: number;
  /** Beat within the cycle, 0..18. */
  index: number;
  phase: Phase;
  /** True on beats 0, 4 and 11: the phase changes here. */
  phaseStart: boolean;
};

export interface PhaseMachine {
  start(t: number): void;
  pause(t: number): void;
  resume(t: number): void;
  /** Accumulates the beat position first, so a tempo change never jumps the ring. */
  setBeatSeconds(s: number, t: number): void;
  stateAt(t: number): BreathState;
  /**
   * Beats with t0 <= at < t1, each once. Valid for windows at or after the last start, resume or
   * tempo change; the scheduler only asks about the near future.
   */
  beatsBetween(t0: number, t1: number): Beat[];
}

export const PATTERN = { inhale: 4, hold: 7, exhale: 8 } as const;
export const CYCLE_BEATS = PATTERN.inhale + PATTERN.hold + PATTERN.exhale;

const PHASES: { phase: Phase; start: number; length: number }[] = [
  { phase: "inhale", start: 0, length: PATTERN.inhale },
  { phase: "hold", start: PATTERN.inhale, length: PATTERN.hold },
  { phase: "exhale", start: PATTERN.inhale + PATTERN.hold, length: PATTERN.exhale },
];

// Absorbs float error so a beat that lands on a boundary counts as reached.
const EPS = 1e-9;

function slotOf(beatInCycle: number) {
  return PHASES.findLast((p) => beatInCycle >= p.start)!;
}

export function createPhaseMachine(initialBeatSeconds = 1): PhaseMachine {
  let beatSeconds = initialBeatSeconds;
  // Beat position (fractional, unwrapped) at anchorT. While running it advances with time.
  let basePos = 0;
  let anchorT = 0;
  let paused = true;

  const posAt = (t: number) =>
    paused ? basePos : basePos + Math.max(0, t - anchorT) / beatSeconds;

  return {
    start(t) {
      basePos = 0;
      anchorT = t;
      paused = false;
    },
    pause(t) {
      if (paused) return;
      basePos = posAt(t);
      anchorT = t;
      paused = true;
    },
    resume(t) {
      if (!paused) return;
      anchorT = t;
      paused = false;
    },
    setBeatSeconds(s, t) {
      basePos = posAt(t);
      anchorT = t;
      beatSeconds = s;
    },
    stateAt(t) {
      const pos = posAt(t);
      const inCycle = ((pos % CYCLE_BEATS) + CYCLE_BEATS) % CYCLE_BEATS;
      const slot = slotOf(inCycle);
      const elapsed = inCycle - slot.start;
      return {
        phase: slot.phase,
        progress: elapsed / slot.length,
        countdown: Math.max(1, Math.ceil(slot.length - elapsed - EPS)),
        beat: Math.floor(inCycle + EPS) % CYCLE_BEATS,
        paused,
      };
    },
    beatsBetween(t0, t1) {
      if (paused || t1 <= t0) return [];
      const out: Beat[] = [];
      const from = Math.max(t0, anchorT);
      // Start one beat early and filter on the computed time, so rounding can neither drop a beat
      // nor report it in two adjacent windows.
      for (let k = Math.floor(posAt(from)); ; k++) {
        const at = anchorT + (k - basePos) * beatSeconds;
        if (at >= t1) break;
        if (at < t0) continue;
        const index = k % CYCLE_BEATS;
        const slot = slotOf(index);
        out.push({ at, index, phase: slot.phase, phaseStart: index === slot.start });
      }
      return out;
    },
  };
}
