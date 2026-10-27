// Pure rules for the controls sheet: when it closes, what counts as a tap or a swipe, which
// layout fits the width. No DOM here, so every rule is testable.

/** Idle time before the sheet closes. */
export const IDLE_MS = 8000;
/** At this width and wider the sheet becomes a right-side panel. */
export const WIDE_QUERY_PX = 900;

export const isWide = (width: number) => width >= WIDE_QUERY_PX;

export interface AutoHideDeps {
  /** Run `fn` after `ms`; returns a canceller. Injected so tests need no real clock. */
  after: (ms: number, fn: () => void) => () => void;
  /** Called only when the dissolved state changes. */
  onChange: (dissolved: boolean) => void;
  idleMs?: number;
}

export interface AutoHide {
  /** Begin waiting (the sheet just opened). */
  start(): void;
  /** Any pointer, touch or key input: show the sheet and wait again. */
  activity(): void;
  /** True while a control has keyboard focus. A held sheet never dissolves. */
  setHeld(held: boolean): void;
  /** Cancel the wait and show the sheet (it closed). */
  stop(): void;
  dissolved(): boolean;
}

export function createAutoHide({ after, onChange, idleMs = IDLE_MS }: AutoHideDeps): AutoHide {
  let cancel: (() => void) | null = null;
  let held = false;
  let gone = false;

  const setGone = (next: boolean) => {
    if (gone === next) return;
    gone = next;
    onChange(gone);
  };
  const clear = () => {
    cancel?.();
    cancel = null;
  };
  const arm = () => {
    clear();
    if (held) return;
    cancel = after(idleMs, () => {
      cancel = null;
      setGone(true);
    });
  };

  return {
    start: arm,
    activity() {
      setGone(false);
      arm();
    },
    setHeld(next) {
      held = next;
      if (held) {
        clear();
        setGone(false);
      } else {
        arm();
      }
    },
    stop() {
      clear();
      setGone(false);
    },
    dissolved: () => gone,
  };
}

export type Gesture = "tap" | "swipe-up" | null;

const TAP_SLOP = 10;
const TAP_MAX_MS = 500;
const SWIPE_MIN = 60;

/** Classify one finger or pointer stroke by how far it moved (px) and how long it lasted. */
export function classifyGesture({ dx, dy, ms }: { dx: number; dy: number; ms: number }): Gesture {
  if (Math.hypot(dx, dy) <= TAP_SLOP) return ms <= TAP_MAX_MS ? "tap" : null;
  // Upward and mostly vertical.
  if (-dy >= SWIPE_MIN && Math.abs(dx) <= -dy) return "swipe-up";
  return null;
}
