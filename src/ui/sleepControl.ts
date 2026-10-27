// Wires the sleep timer to the running audio session and the store. The schedule itself is
// `audio/sleep.ts`; this file only connects it, so it carries no logic of its own to test.
import { toMasterGain } from "../audio/engine";
import { getSession } from "../audio/session";
import { createSleep, type SleepTimer } from "../audio/sleep";
import { DEFAULT_STATE, store } from "../store";

/** Seconds the sounds take to stop once the master is already silent. */
const STOP_SEC = 0.1;

let timer: SleepTimer | null = null;
let timerCtx: AudioContext | null = null;
let watching = false;

function ensure(): SleepTimer | null {
  const engine = getSession()?.engine;
  if (!engine) return null;
  if (!timer || timerCtx !== engine.ctx) {
    timerCtx = engine.ctx;
    timer = createSleep({
      param: engine.masterGain,
      now: () => engine.ctx.currentTime,
      level: () => toMasterGain(store.get().master),
    });
  }
  if (!watching) {
    watching = true;
    let master = store.get().master;
    store.subscribe(() => {
      const next = store.get().master;
      if (next === master) return;
      master = next;
      // The volume slider sets the gain in the same handler; rebuild once it has finished.
      queueMicrotask(() => timer?.reschedule());
    });
  }
  return timer;
}

/** The audio clock in seconds, or 0 when there is no sound. */
export const clockNow = (): number => getSession()?.engine.ctx.currentTime ?? 0;

export const canSleep = (): boolean => getSession() !== null;

export function startTimer(minutes: number): void {
  const t = ensure();
  if (t) store.set({ sleep: t.start(minutes) });
}

export function cancelTimer(): void {
  timer?.cancel();
  store.set({ sleep: null });
}

/** Ends the session calmly: silence, sounds stopped, animation stopped, back to Begin. */
function finish(): void {
  timer?.end();
  getSession()?.mixer.stopAll(STOP_SEC);
  getSession()?.pauseKeepAlive();
  store.set((s) => ({
    sleep: null,
    screen: "begin",
    rested: true,
    paused: false,
    master: DEFAULT_STATE.master,
    sheet: { ...s.sheet, open: false },
  }));
}

/** Call from a coarse repaint timer. Returns true when the timer ended on this call. */
export function checkTimer(): boolean {
  if (!timer?.due()) return false;
  finish();
  return true;
}
