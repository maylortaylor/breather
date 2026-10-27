// The sleep timer on the audio clock. The end is a clock value, and the fade is scheduled on the
// master gain at start, so it still happens if the page freezes (docs/research/ios-audio.md, 4).
// Pure: the param, clock and level are injected.

/** The last stretch of the timer, spent fading to silence (spec question 4). */
export const FINAL_FADE_SEC = 300;
/** How long a cancelled timer takes to bring the master back, so the return is not a jump. */
export const RESTORE_SEC = 1;

const BASE_MINUTES = [30, 60, 90];
const DEV_MINUTES = 2;

/** The timer lengths on offer. The 2 minute test timer exists only when `dev` is true. */
export const timerOptions = (dev: boolean): number[] =>
  dev ? [DEV_MINUTES, ...BASE_MINUTES] : [...BASE_MINUTES];

/** Whole minutes left, rounded up so the label reads 1 until the very end. */
export const minutesLeft = (endsAt: number, now: number): number =>
  Math.max(0, Math.ceil((endsAt - now) / 60));

/** The slice of AudioParam the timer uses. */
export interface SleepParam {
  value: number;
  cancelScheduledValues(t: number): unknown;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
}

export interface SleepDeps {
  /** The master gain. */
  param: SleepParam;
  /** Audio clock, seconds. */
  now: () => number;
  /** The gain the master has at the listener's volume setting. */
  level: () => number;
}

export interface SleepTimer {
  start(minutes: number): { minutes: number; endsAt: number };
  /** Drop the fade and bring the master back to its level. */
  cancel(): void;
  /** Rebuild the schedule after the master level changed. The end stays where it was. */
  reschedule(): void;
  /** Hold the master at silence and forget the timer. */
  end(): void;
  endsAt(): number | null;
  due(): boolean;
}

export function createSleep({ param, now, level }: SleepDeps): SleepTimer {
  let end: number | null = null;

  function schedule(): void {
    if (end === null) return;
    const t = now();
    const current = param.value;
    const fadeFrom = Math.max(t, end - FINAL_FADE_SEC);
    param.cancelScheduledValues(t);
    if (fadeFrom > t) {
      // Hold at the listener's level until the fade begins.
      param.setValueAtTime(level(), t);
      param.setValueAtTime(level(), fadeFrom);
    } else {
      // Already inside the fade: continue down from wherever the gain is.
      param.setValueAtTime(current, t);
    }
    param.linearRampToValueAtTime(0, end);
  }

  return {
    start(minutes) {
      end = now() + minutes * 60;
      schedule();
      return { minutes, endsAt: end };
    },
    cancel() {
      if (end === null) return;
      end = null;
      const t = now();
      const current = param.value;
      param.cancelScheduledValues(t);
      param.setValueAtTime(current, t);
      param.linearRampToValueAtTime(level(), t + RESTORE_SEC);
    },
    reschedule: schedule,
    end() {
      end = null;
      const t = now();
      param.cancelScheduledValues(t);
      param.setValueAtTime(0, t);
    },
    endsAt: () => end,
    due: () => end !== null && now() >= end,
  };
}
