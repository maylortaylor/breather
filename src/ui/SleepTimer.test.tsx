// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { toMasterGain } from "../audio/engine";
import { DEFAULT_STATE, store } from "../store";
import { Moon, SleepSection } from "./SleepTimer";

type Ev = [string, number, number];
const clock = { t: 0 };
const events: Ev[] = [];
const stopAll = vi.fn();
let hasSession = true;
const masterGain = {
  value: 0.15 * 0.49,
  cancelScheduledValues: (t: number) => events.push(["cancel", 0, t]),
  setValueAtTime: (v: number, t: number) => events.push(["set", v, t]),
  linearRampToValueAtTime: (v: number, t: number) => events.push(["ramp", v, t]),
};
vi.mock("../audio/session", () => ({
  getSession: () =>
    hasSession
      ? {
          engine: {
            masterGain,
            ctx: {
              get currentTime() {
                return clock.t;
              },
            },
          },
          mixer: { stopAll },
        }
      : null,
}));

beforeEach(() => {
  vi.useFakeTimers();
  clock.t = 100;
  events.length = 0;
  stopAll.mockClear();
  hasSession = true;
  store.set({ ...DEFAULT_STATE, screen: "resting", master: 0.7 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const tick = (seconds: number) => {
  clock.t += seconds;
  act(() => {
    vi.advanceTimersByTime(1000);
  });
};

describe("timer controls (AC1, AC5)", () => {
  it("offers the 2 minute test timer in dev, then 30, 60 and 90", () => {
    render(<SleepSection />);
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["2 min", "30 min", "60 min", "90 min"]);
  });

  it("starting 30 minutes stores an audio-clock end and schedules the ramp at once", () => {
    render(<SleepSection />);
    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    expect(store.get().sleep).toEqual({ minutes: 30, endsAt: 100 + 1800 });
    expect(events).toContainEqual(["ramp", 0, 1900]);
    expect(events).toContainEqual(["set", expect.any(Number), 1600]);
    expect(screen.getByRole("button", { name: "30 min" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("Cancel clears the timer and ramps the master back", () => {
    render(<SleepSection />);
    fireEvent.click(screen.getByRole("button", { name: "60 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel timer" }));
    expect(store.get().sleep).toBeNull();
    expect(events.at(-1)).toEqual(["ramp", toMasterGain(0.7), 101]);
    expect(screen.queryByRole("button", { name: "Cancel timer" })).toBeNull();
  });

  it("tells the listener to keep the screen on", () => {
    render(<SleepSection />);
    expect(screen.getByText(/keep the screen on/i)).toBeTruthy();
  });

  it("disables the lengths when there is no sound", () => {
    hasSession = false;
    render(<SleepSection />);
    expect(screen.getByRole("button", { name: "30 min" }).hasAttribute("disabled")).toBe(true);
  });

  it("passes axe (AC8)", async () => {
    vi.useRealTimers();
    const { container } = render(<SleepSection />);
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("corner moon (AC3, AC4, AC6)", () => {
  it("is absent with no timer", () => {
    const { container } = render(<Moon />);
    expect(container.textContent).toBe("");
  });

  it("shows minutes left from the audio clock and drops a minute at a time", () => {
    render(<SleepSection />);
    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    render(<Moon />);
    expect(screen.getByText("30 min", { selector: "span" })).toBeTruthy();
    tick(60);
    expect(screen.getByText("29 min", { selector: "span" })).toBeTruthy();
    tick(600);
    expect(screen.getByText("19 min", { selector: "span" })).toBeTruthy();
  });

  it("stays on screen whether the sheet is open or dissolved", () => {
    store.set({ sleep: { minutes: 30, endsAt: 1900 } });
    render(<Moon />);
    store.set({ sheet: { open: true, tab: "session" } });
    expect(screen.getByRole("group", { name: "Sleep timer" })).toBeTruthy();
    store.set({ sheet: { open: false, tab: "session" } });
    expect(screen.getByRole("group", { name: "Sleep timer" })).toBeTruthy();
  });

  it("at the end: master silent, sounds stopped, animation stopped, back to Begin", () => {
    render(<SleepSection />);
    fireEvent.click(screen.getByRole("button", { name: "2 min" }));
    render(<Moon />);
    store.set({ paused: true, sheet: { open: true, tab: "session" } });
    tick(119);
    expect(store.get().screen).toBe("resting");
    tick(2);
    const s = store.get();
    expect(s.screen).toBe("begin");
    expect(s.rested).toBe(true);
    expect(s.sleep).toBeNull();
    expect(s.paused).toBe(false);
    expect(s.sheet.open).toBe(false);
    expect(s.master).toBe(0.7);
    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toEqual(["set", 0, 221]);
    expect(screen.queryByText(/min$/, { selector: "span" })).toBeNull();
  });

  it("passes axe (AC8)", async () => {
    vi.useRealTimers();
    store.set({ sleep: { minutes: 30, endsAt: 1900 } });
    const { container } = render(<Moon />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
