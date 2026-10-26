// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { BUILT_INS, MAX_USER_PRESETS, type Preset } from "../presets";
import { presetStore } from "../presetStore";
import { DEFAULT_STATE, store } from "../store";
import { Gate, STORAGE_LINE } from "./Gate";
import { SessionTab } from "./SessionTab";

const apply = vi.fn();
const setMaster = vi.fn();
let hasSession = true;
vi.mock("../audio/session", () => ({
  getSession: () => (hasSession ? { mixer: { apply, setMaster } } : null),
  beginAudio: vi.fn(),
}));

const [sleep, focus] = BUILT_INS as [Preset, Preset, Preset];
const mine = (id: string, name: string): Preset => ({ ...sleep, id, name, builtIn: false });

beforeEach(() => {
  localStorage.clear();
  apply.mockClear();
  setMaster.mockClear();
  hasSession = true;
  presetStore.set({ presets: [] });
  store.set({
    ...DEFAULT_STATE,
    screen: "resting",
    mix: JSON.parse(JSON.stringify(sleep.mix)),
    dim: true,
    presetId: "sleep",
    master: 0.4,
  });
});
afterEach(cleanup);

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const saved = () => JSON.parse(localStorage.getItem("breather.presets") ?? "null");

function saveAs(name: string) {
  fireEvent.click(button("Save as new"));
  fireEvent.change(screen.getByRole("textbox", { name: "Preset name" }), {
    target: { value: name },
  });
  fireEvent.click(button("Save"));
}
const edit = () => store.set((s) => ({ mix: { ...s.mix, tempo: 0.31 } }));

describe("preset list (AC1)", () => {
  it("lists Sleep, Focus and Reset, then user presets, and marks the active one", () => {
    presetStore.set({ presets: [mine("a", "Evening")] });
    render(<SessionTab />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("button")?.textContent)).toEqual([
      "Sleep",
      "Focus",
      "Reset",
      "Evening",
    ]);
    expect(button("Sleep").getAttribute("aria-pressed")).toBe("true");
    expect(button("Focus").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("choosing a preset (AC2, AC8)", () => {
  it("applies the mix over 3 s and the store follows, with tempo, metronome and dim", () => {
    render(<SessionTab />);
    fireEvent.click(button("Focus"));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(focus.mix, { fadeSec: 3 });
    const s = store.get();
    expect(s.presetId).toBe("focus");
    expect(s.mix).toEqual(focus.mix);
    expect(s.mix.tempo).toBe(0.5);
    expect(s.mix.metronome.level).toBe(0);
    expect(s.dim).toBe(false);
  });

  it("never changes master volume on a switch", () => {
    render(<SessionTab />);
    for (const name of ["Focus", "Reset", "Sleep"]) fireEvent.click(button(name));
    expect(store.get().master).toBe(0.4);
    expect(setMaster).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it("still switches with no audio session", () => {
    hasSession = false;
    render(<SessionTab />);
    fireEvent.click(button("Focus"));
    expect(store.get().presetId).toBe("focus");
  });
});

describe("Save as new (AC3, AC4, AC5)", () => {
  it("offers nothing while the mix matches its preset", () => {
    render(<SessionTab />);
    expect(screen.queryByRole("button", { name: "Save as new" })).toBeNull();
  });

  it("offers Save as new after an edit, and the built-in itself never changes", () => {
    edit();
    render(<SessionTab />);
    expect(button("Save as new")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Update/ })).toBeNull();
    expect(BUILT_INS[0]!.mix.tempo).toBe(0);
  });

  it("saves under a name, marks it active and persists it in breather.presets", () => {
    edit();
    render(<SessionTab />);
    saveAs("  Night walk ");
    expect(presetStore.get().presets.map((p) => p.name)).toEqual(["Night walk"]);
    expect(presetStore.get().presets[0]!.mix.tempo).toBe(0.31);
    expect(store.get().presetId).toBe(presetStore.get().presets[0]!.id);
    expect(saved().version).toBe(1);
    expect(saved().presets[0].name).toBe("Night walk");
    expect(saved().presets[0].builtIn).toBe(false);
  });

  it("refuses an empty name and a name over 24 characters with a calm message", () => {
    edit();
    render(<SessionTab />);
    saveAs("   ");
    expect(screen.getByRole("status").textContent).toBe("Give it a name first.");
    fireEvent.change(screen.getByRole("textbox", { name: "Preset name" }), {
      target: { value: "x".repeat(25) },
    });
    fireEvent.click(button("Save"));
    expect(screen.getByRole("status").textContent).toBe("Keep the name to 24 characters or fewer.");
    expect(presetStore.get().presets).toEqual([]);
  });

  it("refuses an eleventh preset", () => {
    presetStore.set({
      presets: Array.from({ length: MAX_USER_PRESETS }, (_, i) => mine(`p${i}`, `P${i}`)),
    });
    edit();
    render(<SessionTab />);
    saveAs("One too many");
    expect(screen.getByRole("status").textContent).toBe(
      "You have 10 saved presets. Delete one to save another."
    );
    expect(presetStore.get().presets).toHaveLength(MAX_USER_PRESETS);
  });

  it("updates a modified user preset in place", () => {
    presetStore.set({ presets: [mine("a", "Evening")] });
    store.set({ presetId: "a" });
    edit();
    render(<SessionTab />);
    fireEvent.click(button("Update Evening"));
    expect(presetStore.get().presets[0]!.mix.tempo).toBe(0.31);
    expect(presetStore.get().presets).toHaveLength(1);
  });
});

describe("rename and delete (AC5)", () => {
  beforeEach(() => presetStore.set({ presets: [mine("a", "Evening"), mine("b", "Rain")] }));

  it("renames a user preset and persists it; built-ins have no rename", () => {
    render(<SessionTab />);
    expect(screen.queryByRole("button", { name: "Rename Sleep" })).toBeNull();
    fireEvent.click(button("Rename Rain"));
    fireEvent.change(screen.getByRole("textbox", { name: "New name for Rain" }), {
      target: { value: "Storm" },
    });
    fireEvent.click(button("Rename"));
    expect(saved().presets.map((p: Preset) => p.name)).toEqual(["Evening", "Storm"]);
  });

  it("refuses a bad rename and keeps the old name", () => {
    render(<SessionTab />);
    fireEvent.click(button("Rename Rain"));
    fireEvent.change(screen.getByRole("textbox", { name: "New name for Rain" }), {
      target: { value: "" },
    });
    fireEvent.click(button("Rename"));
    expect(screen.getByRole("status").textContent).toBe("Give it a name first.");
    expect(presetStore.get().presets[1]!.name).toBe("Rain");
  });

  it("deletes after a confirmation, frees the active mark and keeps the sound playing", () => {
    store.set({ presetId: "b" });
    render(<SessionTab />);
    fireEvent.click(button("Delete Rain"));
    expect(presetStore.get().presets).toHaveLength(2);
    fireEvent.click(button("Yes, delete"));
    expect(saved().presets.map((p: Preset) => p.name)).toEqual(["Evening"]);
    expect(store.get().presetId).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it("keeps a preset when the delete is cancelled", () => {
    render(<SessionTab />);
    fireEvent.click(button("Delete Rain"));
    fireEvent.click(button("Keep it"));
    expect(presetStore.get().presets).toHaveLength(2);
  });
});

describe("dim mode (AC6)", () => {
  it("flips the store at once and persists it", () => {
    store.set({ dim: false });
    render(<SessionTab />);
    const sw = screen.getByRole("switch", { name: "Dim mode" }) as HTMLInputElement;
    expect(sw.checked).toBe(false);
    fireEvent.click(sw);
    expect(store.get().dim).toBe(true);
    expect(JSON.parse(localStorage.getItem("breather.state")!).value.dim).toBe(true);
    fireEvent.click(sw);
    expect(store.get().dim).toBe(false);
  });
});

describe("storage line and How it works (AC7)", () => {
  it("shows the storage line", () => {
    render(<SessionTab />);
    expect(screen.getByText("Your mix stays on this device. No cookies, no tracking.")).toBe(
      screen.getByText(STORAGE_LINE)
    );
  });

  it("reopens the welcome card without clearing the mix, preset or master", () => {
    const before = store.get();
    render(<SessionTab />);
    fireEvent.click(button("How it works"));
    const after = store.get();
    expect(after.reviewWelcome).toBe(true);
    expect({ ...after, reviewWelcome: false }).toEqual({ ...before, reviewWelcome: false });
    cleanup();
    render(<Gate />);
    expect(screen.getByRole("heading", { name: "Breather" })).toBeTruthy();
    fireEvent.click(button("Got it"));
    expect(store.get().reviewWelcome).toBe(false);
    expect(store.get().screen).toBe("resting");
    expect(store.get().mix).toEqual(before.mix);
    expect(screen.queryByRole("heading", { name: "Breather" })).toBeNull();
  });
});

describe("accessibility (AC9)", () => {
  it("passes axe with a modified mix, a user preset and an open form", async () => {
    presetStore.set({ presets: [mine("a", "Evening")] });
    edit();
    const { container } = render(<SessionTab />);
    fireEvent.click(button("Save as new"));
    expect((await axe(container)).violations).toEqual([]);
  });
});
