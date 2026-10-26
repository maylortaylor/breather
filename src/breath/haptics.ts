// The haptic pulse on phase changes. Pure: the clock, the timer and the vibrate call are injected.
// Android browsers have `navigator.vibrate`; iOS does not, so there it is a silent no-op.
import type { Beat } from "./phases";

/** One short, soft pulse. */
export const PULSE_MS = 20;

export type Vibrate = (ms: number) => unknown;

export interface HapticsDeps {
  /** Null when the device cannot vibrate. */
  vibrate: Vibrate | null;
  /** Seconds on the clock the beats are stamped with (the audio clock in the app). */
  now: () => number;
  /** Runs `fn` after `ms`; returns a function that cancels it. */
  later: (fn: () => void, ms: number) => () => void;
  isPaused: () => boolean;
}

export interface Haptics {
  /** Call for every scheduled beat; only phase-start beats pulse. */
  onBeat(beat: Beat): void;
  /** Drops pulses that are queued but not yet due. */
  cancel(): void;
}

export function createHaptics({ vibrate, now, later, isPaused }: HapticsDeps): Haptics {
  const queued = new Set<() => void>();
  return {
    onBeat(beat) {
      if (!vibrate || !beat.phaseStart) return;
      // The scheduler hands beats out a little ahead of time; wait for the beat itself.
      const wait = Math.max(0, (beat.at - now()) * 1000);
      const stop = later(() => {
        queued.delete(stop);
        if (isPaused()) return;
        try {
          vibrate(PULSE_MS);
        } catch {
          // A browser may refuse without a recent tap. A missed pulse is not worth a message.
        }
      }, wait);
      queued.add(stop);
    },
    cancel() {
      for (const stop of queued) stop();
      queued.clear();
    },
  };
}

/** The device's vibrate, bound to the navigator, or null when it has none. */
export function vibrateFromNavigator(
  nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator
): Vibrate | null {
  if (!nav || typeof nav.vibrate !== "function") return null;
  return (ms) => nav.vibrate(ms);
}
