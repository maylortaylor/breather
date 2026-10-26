import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createDelayedAction, LONG_PRESS_MS, TOOLTIP_DELAY_MS } from "./tooltipTimer";

describe("createDelayedAction", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a 4 s hover and focus delay and a 600 ms long press", () => {
    expect(TOOLTIP_DELAY_MS).toBe(4000);
    expect(LONG_PRESS_MS).toBe(600);
  });

  it("fires at exactly the delay, not a tick before", () => {
    const action = vi.fn();
    const t = createDelayedAction(TOOLTIP_DELAY_MS, action);
    t.start();
    vi.advanceTimersByTime(3999);
    expect(action).not.toHaveBeenCalled();
    expect(t.pending).toBe(true);
    vi.advanceTimersByTime(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(t.pending).toBe(false);
  });

  it("cancel stops it from ever firing", () => {
    const action = vi.fn();
    const t = createDelayedAction(TOOLTIP_DELAY_MS, action);
    t.start();
    vi.advanceTimersByTime(2000);
    t.cancel();
    vi.advanceTimersByTime(10_000);
    expect(action).not.toHaveBeenCalled();
    expect(t.pending).toBe(false);
  });

  it("start again restarts the wait from zero", () => {
    const action = vi.fn();
    const t = createDelayedAction(TOOLTIP_DELAY_MS, action);
    t.start();
    vi.advanceTimersByTime(3000);
    t.start();
    vi.advanceTimersByTime(3999);
    expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("fires once per start", () => {
    const action = vi.fn();
    const t = createDelayedAction(600, action);
    t.start();
    vi.advanceTimersByTime(5000);
    expect(action).toHaveBeenCalledTimes(1);
    t.start();
    vi.advanceTimersByTime(600);
    expect(action).toHaveBeenCalledTimes(2);
  });
});
