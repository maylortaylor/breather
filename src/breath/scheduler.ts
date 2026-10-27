// The lookahead beat scheduler. Pure: time and the machine are injected, so it runs on the audio
// clock in the app and on a fake clock in tests. Call `tick` about every 25 ms.
import type { Beat, PhaseMachine } from "./phases";

export interface BeatSchedulerOptions {
  /** Seconds on the clock the machine runs on (the audio clock in the app). */
  now: () => number;
  machine: PhaseMachine;
  /** How far ahead of `now` to hand out beats, in seconds. */
  lookahead?: number | (() => number);
  /** A tick later than this after the last one skips past beats instead of replaying them. */
  maxCatchUp?: number;
  onBeat: (beat: Beat) => void;
}

export interface BeatScheduler {
  tick(): void;
  /**
   * Call after the machine's start, pause, resume or tempo change. Beats already handed out stay
   * handed out, so a tempo change neither repeats nor drops the beat that was already scheduled.
   */
  reset(): void;
}

export function createBeatScheduler({
  now,
  machine,
  lookahead = 0.1,
  maxCatchUp = 0.25,
  onBeat,
}: BeatSchedulerOptions): BeatScheduler {
  // Beats before `horizon` were already handed out. Null until the first tick or after a reset.
  let horizon: number | null = null;
  // Nothing before this is handed out again, even after a reset.
  let floor = -Infinity;

  return {
    tick() {
      const t = now();
      let from = horizon !== null && t - horizon <= maxCatchUp ? horizon : t;
      from = Math.max(from, floor);
      const to = t + (typeof lookahead === "function" ? lookahead() : lookahead);
      if (to > from) {
        for (const beat of machine.beatsBetween(from, to)) onBeat(beat);
      }
      horizon = Math.max(to, from);
    },
    reset() {
      if (horizon !== null) floor = Math.max(floor, horizon);
      horizon = null;
    },
  };
}
