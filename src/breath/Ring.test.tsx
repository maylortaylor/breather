// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { DEFAULT_STATE, store } from "../store";
import { createPhaseMachine, type BreathState } from "./phases";
import { Breath, createRing, PHASE_WORDS, ringLook } from "./Ring";

const st = (phase: BreathState["phase"], progress: number, paused = false): BreathState => ({
  phase,
  progress,
  countdown: 1,
  beat: 0,
  paused,
});

beforeEach(() => store.set({ ...DEFAULT_STATE, screen: "resting" }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ringLook", () => {
  it("grows over the inhale, holds full, and shrinks over the exhale", () => {
    const inhale = [0, 0.25, 0.5, 0.75, 1].map((p) => ringLook(st("inhale", p), false, false));
    expect(inhale[0]!.scale).toBeCloseTo(0.6, 6);
    expect(inhale[4]!.scale).toBeCloseTo(1, 6);
    inhale.slice(1).forEach((l, i) => expect(l.scale).toBeGreaterThan(inhale[i]!.scale));
    expect(ringLook(st("hold", 0), false, false).scale).toBe(1);
    expect(ringLook(st("hold", 0.9), false, false).scale).toBe(1);
    const exhale = [0, 0.5, 1].map((p) => ringLook(st("exhale", p), false, false));
    expect(exhale[0]!.scale).toBeCloseTo(1, 6);
    expect(exhale[2]!.scale).toBeCloseTo(0.6, 6);
    expect(exhale[1]!.scale).toBeLessThan(exhale[0]!.scale);
  });

  it("swells the glow with the breath", () => {
    const low = ringLook(st("inhale", 0), false, false).glow;
    const high = ringLook(st("hold", 0.5), false, false).glow;
    expect(low).toBe(10);
    expect(high).toBe(50);
  });

  it("under reduced motion eases linearly and keeps the glow steady", () => {
    const a = ringLook(st("inhale", 0.25), true, false);
    const b = ringLook(st("hold", 0.5), true, false);
    expect(a.scale).toBeCloseTo(0.6 + 0.4 * 0.25, 6);
    expect(a.glow).toBe(b.glow);
    expect(ringLook(st("inhale", 0.25), false, false).scale).toBeLessThan(a.scale);
  });

  it("dims the glow in dim mode and when paused", () => {
    const base = ringLook(st("hold", 0), false, false).glow;
    expect(ringLook(st("hold", 0), false, true).glow).toBeCloseTo(base * 0.6, 6);
    expect(ringLook(st("hold", 0, true), false, false).glow).toBeCloseTo(base * 0.5, 6);
  });
});

describe("createRing", () => {
  it("draws into the markup it is mounted on and goes quiet after unmount", () => {
    const el = document.createElement("div");
    el.innerHTML = "<span data-ring></span><span data-count></span><p data-word></p>";
    const ring = createRing();
    ring.mount(el);
    ring.draw({ phase: "hold", progress: 0, countdown: 7, beat: 4, paused: false });
    expect(el.querySelector("[data-count]")!.textContent).toBe("7");
    expect(el.querySelector("[data-word]")!.textContent).toBe("Hold");
    expect(
      el.querySelector<HTMLElement>("[data-ring]")!.style.getPropertyValue("--ring-scale")
    ).toBe("1.0000");
    ring.unmount();
    ring.draw({ phase: "exhale", progress: 0, countdown: 8, beat: 11, paused: false });
    expect(el.querySelector("[data-word]")!.textContent).toBe("Hold");
  });
});

describe("Breath", () => {
  function setup() {
    let t = 0;
    const machine = createPhaseMachine(1);
    const view = render(<Breath now={() => t} machine={machine} />);
    return { at: (s: number) => (t = s), ...view };
  }
  const guide = () => screen.getByRole("button");
  const count = () => guide().querySelector("[data-count]")!.textContent;

  it("says the three phase words", () => {
    expect(PHASE_WORDS).toEqual({
      inhale: "Breathe in through your nose",
      hold: "Hold",
      exhale: "Breathe out slowly through your mouth",
    });
    expect(screen.queryByRole("status")).toBeNull();
    setup();
    expect(screen.getByRole("status").textContent).toBe("Breathe in through your nose");
    expect(count()).toBe("4");
  });

  it("taps to pause, freezes the countdown, and resumes on the same beat", () => {
    const { at } = setup();
    at(5.5);
    fireEvent.click(guide());
    expect(store.get().paused).toBe(true);
    expect(guide().getAttribute("aria-label")).toBe("Resume breathing guide");
    expect(count()).toBe("6");
    expect(screen.getByRole("status").textContent).toBe("Hold");
    at(200);
    fireEvent.click(guide());
    expect(store.get().paused).toBe(false);
    expect(guide().getAttribute("aria-label")).toBe("Pause breathing guide");
    expect(count()).toBe("6");
  });

  it("does not pause on a tap outside the ring", () => {
    const { at, container } = setup();
    at(2);
    fireEvent.click(container.firstElementChild!);
    fireEvent.click(screen.getByRole("status"));
    fireEvent.click(document.body);
    expect(store.get().paused).toBe(false);
  });

  it("takes reduced motion from the media query", () => {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
      removeEventListener: () => {},
    }));
    const { container } = setup();
    const ring = container.querySelector<HTMLElement>("[data-ring]")!;
    // Beat 0 of the inhale: reduced motion starts at the base size and a steady glow.
    expect(ring.style.getPropertyValue("--ring-glow")).toBe("18.0px");
    expect(listeners).toHaveLength(1);
    listeners[0]!({ matches: false });
    expect(ring.style.getPropertyValue("--ring-glow")).toBe("10.0px");
  });

  it("passes axe", async () => {
    const { container, at } = setup();
    at(1);
    expect((await axe(container)).violations).toEqual([]);
  });
});
