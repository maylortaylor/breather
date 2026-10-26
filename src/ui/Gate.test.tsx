// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Screens } from "../App";
import { beginAudio, resetSession } from "../audio/session";
import { DEFAULT_MIX } from "../presets";
import { DEFAULT_STATE, store } from "../store";
import { Gate, SAFETY_LINE, STORAGE_LINE } from "./Gate";

beforeEach(() => {
  localStorage.clear();
  store.set({ ...DEFAULT_STATE });
});
afterEach(() => {
  cleanup();
  resetSession();
  vi.unstubAllGlobals();
});

describe("welcome card", () => {
  it("shows the agreed copy, the storage line and one Got it button", () => {
    render(<Gate />);
    expect(screen.getByRole("heading", { name: "Breather" })).toBeTruthy();
    expect(screen.getByText("Slow sound and a guided 4-7-8 breath to wind down.")).toBeTruthy();
    const steps = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(steps).toEqual([
      "Tap Begin to start the sound.",
      "Follow the ring: breathe in for 4, hold for 7, out for 8.",
      "Tap the Settings button for sounds, tempo and presets.",
    ]);
    expect(screen.getByText(SAFETY_LINE)).toBeTruthy();
    expect(screen.getByText("Your mix stays on this device. No cookies, no tracking.")).toBe(
      screen.getByText(STORAGE_LINE)
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Got it"]);
  });

  it("passes axe", async () => {
    const { container } = render(<Gate />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("Got it sets welcomeSeen, persists it and shows Begin", () => {
    render(<Gate />);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(store.get().welcomeSeen).toBe(true);
    expect(JSON.parse(localStorage.getItem("breather.state")!).value.welcomeSeen).toBe(true);
    expect(screen.getByRole("button", { name: "Begin" })).toBeTruthy();
  });
});

describe("Begin screen", () => {
  beforeEach(() => store.set({ welcomeSeen: true, screen: "begin" }));

  it("shows Begin straight away when the card was seen", () => {
    render(<Gate />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Begin"]);
  });

  it("puts the safety line before the button for a screen reader, with no opt-out", () => {
    render(<Gate />);
    const line = screen.getByText(SAFETY_LINE);
    const button = screen.getByRole("button", { name: "Begin" });
    expect(line.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/don.t show/i)).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("shows the safety line on every launch, even when welcomeSeen is stored", () => {
    for (let i = 0; i < 2; i++) {
      const { unmount } = render(<Gate />);
      expect(screen.getByText(SAFETY_LINE)).toBeTruthy();
      unmount();
    }
  });

  it("passes axe", async () => {
    const { container } = render(<Gate />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("starts the Sleep mix from the tap on first launch", () => {
    const begin = vi.fn();
    render(<Gate begin={begin} />);
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));
    expect(begin).toHaveBeenCalledTimes(1);
    const launch = begin.mock.calls[0]![0];
    expect(launch.presetId).toBe("sleep");
    expect(Object.keys(launch.mix.sounds)).toEqual(["brown", "ocean", "bubbles", "whale-b"]);
    expect(launch.master).toBe(0.7);
    expect(store.get().screen).toBe("resting");
  });

  it("starts the mix saved by the Sounds tab, even with no preset id", () => {
    const sounds = { white: { lfo: 2, min: 0.1, max: 0.5 } };
    localStorage.setItem(
      "breather.state",
      JSON.stringify({ version: 1, value: { mix: { ...DEFAULT_MIX, sounds } } })
    );
    const begin = vi.fn();
    render(<Gate begin={begin} />);
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));
    expect(begin.mock.calls[0]![0].mix.sounds).toEqual(sounds);
  });

  it("without AudioContext shows one calm line and still reaches the resting screen", () => {
    vi.stubGlobal("AudioContext", undefined);
    render(<Screens />);
    // Real beginAudio via the default wiring.
    expect(beginAudio).toBeTypeOf("function");
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));
    expect(store.get().audio).toBe("unsupported");
    expect(store.get().screen).toBe("resting");
    expect(screen.getAllByText("Sound is not available on this device.")).toHaveLength(1);
  });
});
