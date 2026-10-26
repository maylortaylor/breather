/** How long a pointer or keyboard focus must rest on a control before its tooltip appears. */
export const TOOLTIP_DELAY_MS = 2500;
/** How long a finger must stay down to show the tooltip on touch screens. */
export const LONG_PRESS_MS = 600;

export interface DelayedAction {
  /** Start waiting. Calling it again restarts the wait from zero. */
  start(): void;
  cancel(): void;
  readonly pending: boolean;
}

export function createDelayedAction(delayMs: number, action: () => void): DelayedAction {
  let id: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (id !== null) clearTimeout(id);
    id = null;
  };
  return {
    start() {
      cancel();
      id = setTimeout(() => {
        id = null;
        action();
      }, delayMs);
    },
    cancel,
    get pending() {
      return id !== null;
    },
  };
}
