// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { createFakeEngine, type FakeEngine } from "../audio/fakeAudio";
import { createMixer, type Mixer } from "../audio/mixer";
import { createModulator, type Modulator } from "../audio/modulation";
import { DEFAULT_MIX, restoreLaunch, type LoopId } from "../presets";
import { DEFAULT_STATE, loadState, store } from "../store";
import { mixRmsDb, CLIP_SAFE_RMS_DB } from "./soundsLogic";
import { SoundsTab } from "./SoundsTab";

let fake: FakeEngine;
let mixer: Mixer;
let modulator: Modulator;
let session: { mixer: Mixer; modulator: Modulator } | null;
const started: LoopId[] = [];
const timers: (() => void)[] = [];

vi.mock("../audio/session", () => ({ getSession: () => session }));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  fake = createFakeEngine();
  modulator = createModulator(() => 0.3);
  mixer = createMixer(fake.engine, modulator, {
    makeSound: (id) => ({
      start: () => void started.push(id),
      stop: () => {},
    }),
    after: (_ms, fn) => {
      timers.push(fn);
      return () => {};
    },
  });
  session = { mixer, modulator };
  started.length = 0;
  timers.length = 0;
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  store.set({ ...DEFAULT_STATE, mix: { ...DEFAULT_MIX, sounds: {} }, screen: "resting" });
});
afterEach(() => {
  cleanup();
  modulator.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const chip = (name: string) => screen.getByRole("button", { name });

describe("chips (AC1)", () => {
  it("groups the 9 loops as Noise, Nature, Music", () => {
    render(<SoundsTab />);
    // The LFO panel is a <details>, which also reads as a group; only the chip groups have legends.
    const groups = screen
      .getAllByRole("group")
      .filter((g) => g.querySelector("legend"))
      .map((g) => [
        g.querySelector("legend")?.textContent,
        within(g)
          .getAllByRole("button")
          .map((b) => b.textContent),
      ]);
    expect(groups).toEqual([
      ["Noise", ["White noise", "Pink noise", "Brown noise"]],
      ["Nature", ["Ocean waves", "Underwater bubbles", "Whale B: blue moan"]],
      ["Music", ["Pad: Dreamy", "Pad: Tonal", "Pad: Deep"]],
    ]);
  });

  it("marks a playing chip as pressed", () => {
    render(<SoundsTab />);
    expect(chip("Brown noise").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip("Brown noise"));
    expect(chip("Brown noise").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("adding and removing (AC2, AC3)", () => {
  it("adds a row and starts the sound, then fades it out and removes the row", () => {
    render(<SoundsTab />);
    expect(screen.queryByRole("list", { name: "Playing sounds" })).toBeNull();
    fireEvent.click(chip("Ocean waves"));
    expect(started).toEqual(["ocean"]);
    expect(mixer.playing()).toEqual(["ocean"]);
    expect(screen.getByRole("slider", { name: "Ocean waves volume" })).toBeTruthy();
    fireEvent.click(chip("Ocean waves"));
    expect(fake.calls).toContain("silence ocean over 1.5");
    expect(mixer.playing()).toEqual([]);
    expect(screen.queryByRole("slider", { name: "Ocean waves volume" })).toBeNull();
    expect(store.get().mix.sounds).toEqual({});
  });

  it("lets the 3 pads play together and turning one off leaves the others", () => {
    render(<SoundsTab />);
    for (const n of ["Pad: Dreamy", "Pad: Tonal", "Pad: Deep"]) fireEvent.click(chip(n));
    expect(mixer.playing()).toEqual(["pad-dreamy", "pad-tonal", "pad-deep"]);
    expect(screen.getAllByRole("slider")).toHaveLength(3 + 1);
    fireEvent.click(chip("Pad: Tonal"));
    expect(mixer.playing()).toEqual(["pad-dreamy", "pad-deep"]);
    expect(fake.calls.filter((c) => c.startsWith("silence"))).toEqual([
      "silence pad-tonal over 1.5",
    ]);
  });
});

describe("LFO rows (AC4, AC5)", () => {
  const withOcean = () => {
    render(<SoundsTab />);
    fireEvent.click(chip("Ocean waves"));
  };

  it("names each LFO button with its number and colour", () => {
    withOcean();
    const names = within(screen.getByRole("group", { name: "Ocean waves LFO" }))
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["LFO 1 (teal)", "LFO 2 (violet)", "LFO 3 (amber)"]);
  });

  it("turns the slider into a min/max range on a colour, and back on a second tap", () => {
    withOcean();
    expect(screen.queryByRole("slider", { name: "Ocean waves minimum volume" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "LFO 3 (amber)" }));
    expect(screen.getByRole("slider", { name: "Ocean waves maximum volume" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Ocean waves minimum volume" })).toBeTruthy();
    const row = store.get().mix.sounds.ocean!;
    expect(row.lfo).toBe(3);
    expect(row.min).toBeLessThan(row.max);
    expect(modulator.rowOf("ocean").lfo).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "LFO 3 (amber)" }));
    expect(store.get().mix.sounds.ocean!.lfo).toBe(0);
    expect(screen.queryByRole("slider", { name: "Ocean waves minimum volume" })).toBeNull();
  });

  it("reaches true silence when the minimum handle is dragged to 0", () => {
    withOcean();
    fireEvent.click(screen.getByRole("button", { name: "LFO 1 (teal)" }));
    fireEvent.change(screen.getByRole("slider", { name: "Ocean waves minimum volume" }), {
      target: { value: "0" },
    });
    expect(store.get().mix.sounds.ocean?.min).toBe(0);
    // The modulator turns min 0 into a gain of 0 at the bottom of the swing.
    expect(modulator.rowOf("ocean").min).toBe(0);
  });

  it("changes the volume live through the mixer", () => {
    withOcean();
    fireEvent.change(screen.getByRole("slider", { name: "Ocean waves volume" }), {
      target: { value: "0.55" },
    });
    expect(store.get().mix.sounds.ocean?.max).toBe(0.55);
    expect(fake.calls).toContain("layer ocean 0.55 over 0.1");
  });
});

describe("persistence (AC6)", () => {
  it("saves every change under breather.state and Begin restores the same rows", () => {
    render(<SoundsTab />);
    fireEvent.click(chip("Brown noise"));
    fireEvent.click(chip("Ocean waves"));
    const ocean = screen.getByRole("group", { name: "Ocean waves LFO" });
    fireEvent.click(within(ocean).getByRole("button", { name: "LFO 3 (amber)" }));
    const saved = JSON.parse(localStorage.getItem("breather.state")!);
    expect(Object.keys(saved.value.mix.sounds)).toEqual(["brown", "ocean"]);
    // A reload: read the stored state back, then restore the launch mix the way Begin does.
    const launch = restoreLaunch({ version: 1, ...loadState() });
    expect(launch.mix.sounds).toEqual(store.get().mix.sounds);
    expect(launch.mix.sounds.ocean?.lfo).toBe(3);
  });
});

describe("master and headroom (AC7)", () => {
  it("never calls setMaster from a chip or a row, and the master slider tops out at 1", () => {
    const setMaster = vi.spyOn(mixer, "setMaster");
    render(<SoundsTab />);
    fireEvent.click(chip("Brown noise"));
    fireEvent.change(screen.getByRole("slider", { name: "Brown noise volume" }), {
      target: { value: "0.8" },
    });
    expect(setMaster).not.toHaveBeenCalled();
    const master = screen.getByRole("slider", { name: "Master" }) as HTMLInputElement;
    expect(Number(master.max)).toBe(1);
    fireEvent.change(master, { target: { value: "1" } });
    expect(setMaster).toHaveBeenCalledWith(1);
  });

  it("keeps all 3 pads and 3 loops at default levels well under the clip line", () => {
    render(<SoundsTab />);
    for (const n of [
      "Pad: Dreamy",
      "Pad: Tonal",
      "Pad: Deep",
      "Brown noise",
      "Ocean waves",
      "Underwater bubbles",
    ]) {
      fireEvent.click(chip(n));
    }
    expect(mixer.playing()).toHaveLength(6);
    expect(mixRmsDb(store.get().mix.sounds)).toBeLessThan(CLIP_SAFE_RMS_DB);
  });
});

describe("without an audio session", () => {
  it("still adds rows and saves the mix", () => {
    session = null;
    render(<SoundsTab />);
    fireEvent.click(chip("Pink noise"));
    expect(screen.getByRole("slider", { name: "Pink noise volume" })).toBeTruthy();
    expect(store.get().mix.sounds.pink).toBeTruthy();
  });
});

describe("accessibility (AC8)", () => {
  it("passes axe with two rows", async () => {
    vi.useRealTimers(); // axe needs real timers
    const { container } = render(<SoundsTab />);
    fireEvent.click(chip("Brown noise"));
    fireEvent.click(chip("Ocean waves"));
    const ocean = screen.getByRole("group", { name: "Ocean waves LFO" });
    fireEvent.click(within(ocean).getByRole("button", { name: "LFO 2 (violet)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("LFO panel", () => {
  const summary = () => screen.getByText("Volume waves (LFOs)");
  const open = () => {
    const details = summary().closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
  };

  it("is collapsed at the very bottom of the tab, showing nothing until opened", () => {
    render(<SoundsTab />);
    const tab = summary().closest("details")!;
    expect(tab.open).toBe(false);
    expect(tab.parentElement!.lastElementChild).toBe(tab);
    expect(screen.queryByLabelText("LFO 1 speed")).toBeNull();
  });

  it("shows all three LFOs with a trace, a speed and two shapes once opened", () => {
    render(<SoundsTab />);
    open();
    expect(screen.getAllByRole("group", { name: /^LFO \d$/ })).toHaveLength(3);
    for (const n of [1, 2, 3]) {
      expect(screen.getByLabelText(`LFO ${n} speed`)).toBeTruthy();
      expect(screen.getByLabelText(`LFO ${n} Sine`)).toBeTruthy();
      expect(screen.getByLabelText(`LFO ${n} Smooth random`)).toBeTruthy();
    }
  });

  it("a speed change reaches the mix, the running modulator and the saved state", () => {
    render(<SoundsTab />);
    open();
    fireEvent.change(screen.getByLabelText("LFO 2 speed"), { target: { value: "60" } });
    expect(store.get().mix.lfos[1].period).toBe(60);
    expect(modulator.bank.lfos[1]!.period).toBe(60);
    expect(store.get().mix.lfos[0].period).toBe(DEFAULT_MIX.lfos[0].period);
    expect(JSON.stringify(loadState().mix?.lfos)).toContain('"period":60');
  });

  it("a shape button sets that LFO's shape and marks itself pressed", () => {
    render(<SoundsTab />);
    open();
    fireEvent.click(screen.getByLabelText("LFO 1 Smooth random"));
    expect(store.get().mix.lfos[0].shape).toBe("smooth-random");
    expect(screen.getByLabelText("LFO 1 Smooth random").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("LFO 1 Sine").getAttribute("aria-pressed")).toBe("false");
    expect(modulator.bank.lfos[0]!.shape).toBe("smooth-random");
  });

  it("has no accessibility violations when opened", async () => {
    vi.useRealTimers(); // axe needs real timers
    const { container } = render(<SoundsTab />);
    open();
    expect((await axe(container)).violations).toEqual([]);
  });
});
