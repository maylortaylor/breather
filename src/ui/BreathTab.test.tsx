// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { createFakeEngine, type FakeEngine } from "../audio/fakeAudio";
import { startBeats } from "../breath/beats";
import { createPhaseMachine } from "../breath/phases";
import { D1, D2 } from "../breath/tempo";
import { DEFAULT_STATE, loadState, store } from "../store";
import { BreathTab } from "./BreathTab";

let fake: FakeEngine | null = null;
vi.mock("../audio/session", () => ({
  getSession: () => (fake ? { engine: fake.engine, mixer: {} } : null),
}));

beforeEach(() => {
  localStorage.clear();
  fake = null;
  store.set({ ...DEFAULT_STATE });
});
afterEach(cleanup);

const tempo = () => screen.getByRole("slider", { name: "Tempo" }) as HTMLInputElement;
const metronome = () => screen.getByRole("slider", { name: "Metronome" }) as HTMLInputElement;
const change = (el: HTMLElement, value: number) => fireEvent.change(el, { target: { value } });

describe("labels and names", () => {
  it("shows Slow and Fast, a hint, and no BPM number anywhere (AC1, AC2, AC3)", () => {
    store.set((s) => ({ mix: { ...s.mix, tempo: 0.5 } }));
    const { container } = render(<BreathTab />);
    expect(screen.getByText("Slow")).toBeTruthy();
    expect(screen.getByText("Fast")).toBeTruthy();
    expect(screen.getByText("Inhale about 4s")).toBeTruthy();
    expect(tempo().getAttribute("aria-valuetext")).toBe("Resting pace");
    for (const el of [tempo(), metronome()]) {
      const names = [el.getAttribute("aria-valuetext") ?? "", el.labels?.[0]?.textContent ?? ""];
      for (const n of names) expect(n).not.toMatch(/\bBPM\b|\d/i);
    }
    expect(container.textContent).not.toMatch(/BPM/i);
  });

  it("passes vitest-axe (AC8)", async () => {
    const { container } = render(<BreathTab />);
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("tempo", () => {
  it("moves the hint as the slider moves (AC2)", () => {
    render(<BreathTab />);
    change(tempo(), 0);
    expect(screen.getByText("Inhale about 6s")).toBeTruthy();
    expect(tempo().getAttribute("aria-valuetext")).toBe("Slowest");
    change(tempo(), 1);
    expect(screen.getByText("Inhale about 3s")).toBeTruthy();
    expect(tempo().getAttribute("aria-valuetext")).toBe("Fastest");
  });

  it("snaps to exactly 0.5 when released near the center, and only then (AC1)", () => {
    render(<BreathTab />);
    change(tempo(), 0.52);
    expect(store.get().mix.tempo).toBe(0.52);
    fireEvent.pointerUp(tempo());
    expect(store.get().mix.tempo).toBe(0.5);
    change(tempo(), 0.7);
    fireEvent.pointerUp(tempo());
    expect(store.get().mix.tempo).toBe(0.7);
  });

  it("steps with the arrow keys and stops on the center (AC7)", () => {
    store.set((s) => ({ mix: { ...s.mix, tempo: 0.49 } }));
    render(<BreathTab />);
    fireEvent.keyDown(tempo(), { key: "ArrowRight" });
    expect(store.get().mix.tempo).toBe(0.5);
    fireEvent.keyDown(tempo(), { key: "ArrowRight" });
    expect(store.get().mix.tempo).toBeCloseTo(0.525, 6);
    fireEvent.keyDown(tempo(), { key: "ArrowLeft" });
    expect(store.get().mix.tempo).toBe(0.5);
  });
});

describe("metronome", () => {
  it("snaps to off, phase changes and all beats below detent 2, free above (AC4)", () => {
    render(<BreathTab />);
    change(metronome(), 0.07);
    expect(store.get().mix.metronome.level).toBe(0);
    expect(metronome().getAttribute("aria-valuetext")).toBe("Off");
    change(metronome(), 0.16);
    expect(store.get().mix.metronome.level).toBe(D1);
    change(metronome(), 0.33);
    expect(store.get().mix.metronome.level).toBe(D2);
    change(metronome(), 0.62);
    expect(store.get().mix.metronome.level).toBe(0.62);
    expect(metronome().getAttribute("aria-valuetext")).toBe("All beats, louder");
  });

  it("shows the live setting as text next to the label, matching aria-valuetext", () => {
    render(<BreathTab />);
    const live = (text: string) => {
      expect(metronome().getAttribute("aria-valuetext")).toBe(text);
      expect(metronome().closest("label")?.firstElementChild?.textContent).toContain(text);
    };
    change(metronome(), 0);
    live("Off");
    change(metronome(), 0.16);
    live("Phase changes");
    change(metronome(), 0.33);
    live("All beats, quiet");
    change(metronome(), 0.7);
    live("All beats, louder");
  });

  it("reserves a fixed-width live box that does not depend on the current phrase", () => {
    render(<BreathTab />);
    const box = () => metronome().closest("label")!.querySelector<HTMLElement>("[data-live]")!;
    const widths = new Set<string>();
    for (const v of [0, 0.16, 0.33, 0.7]) {
      change(metronome(), v);
      widths.add(box().style.minWidth);
    }
    expect([...widths]).toEqual([`${"All beats, louder".length}ch`]);
    change(tempo(), 0.5);
    const tempoBox = tempo().closest("label")!.querySelector<HTMLElement>("[data-live]")!;
    expect(tempoBox.style.minWidth).toBe(`${"Resting pace".length}ch`);
  });

  it("puts words only at the two ends, never under the interior marks", () => {
    render(<BreathTab />);
    const marks = metronome().closest("label")!.querySelectorAll("[aria-hidden]");
    // Ticks hold no text; the end row holds exactly the left and right labels, in that order.
    const [ticks, ends] = [marks[0]!, marks[1]!];
    expect(ticks.textContent).toBe("");
    expect(ticks.children).toHaveLength(3);
    expect([...ends.children].map((c) => c.textContent)).toEqual(["Off", "Louder"]);
    for (const word of ["Phase", "Beats"]) expect(screen.queryByText(word)).toBeNull();
  });

  it("moves stop to stop with the arrow keys (AC7)", () => {
    store.set((s) => ({ mix: { ...s.mix, metronome: { ...s.mix.metronome, level: 0 } } }));
    render(<BreathTab />);
    fireEvent.keyDown(metronome(), { key: "ArrowRight" });
    expect(store.get().mix.metronome.level).toBe(D1);
    fireEvent.keyDown(metronome(), { key: "ArrowRight" });
    expect(store.get().mix.metronome.level).toBe(D2);
    fireEvent.keyDown(metronome(), { key: "ArrowRight" });
    expect(store.get().mix.metronome.level).toBeCloseTo(D2 + 0.05, 6);
    fireEvent.keyDown(metronome(), { key: "ArrowDown" });
    expect(store.get().mix.metronome.level).toBe(D2);
    fireEvent.keyDown(metronome(), { key: "ArrowLeft" });
    expect(store.get().mix.metronome.level).toBe(D1);
  });
});

describe("voice picker", () => {
  it("offers four voices by name with the heartbeat thump selected (AC5)", () => {
    render(<BreathTab />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.parentElement?.textContent)).toEqual([
      "Heartbeat thump",
      "Wood block",
      "Soft tick 700 Hz",
      "Soft tick 350 Hz",
    ]);
    expect((screen.getByLabelText("Heartbeat thump") as HTMLInputElement).checked).toBe(true);
  });

  it("stores the pick and plays it once as a preview on its own layer (AC5)", () => {
    fake = createFakeEngine();
    render(<BreathTab />);
    expect(fake.oscillators).toHaveLength(0);
    fireEvent.click(screen.getByLabelText("Wood block"));
    expect(store.get().mix.metronome.voice).toBe("metro-wood-block");
    // The wood block is two partials; each beat is one note of them.
    expect(fake.oscillators).toHaveLength(2);
    expect(fake.calls).toContain("layer metro-preview 0.8");
    expect(fake.feeding("metro-preview").length).toBeGreaterThan(0);
  });

  it("still stores the pick when there is no audio", () => {
    render(<BreathTab />);
    fireEvent.click(screen.getByLabelText("Soft tick 350 Hz"));
    expect(store.get().mix.metronome.voice).toBe("metro-soft-tick-350-hz");
  });
});

describe("persistence (AC6)", () => {
  it("writes every change to breather.state", () => {
    render(<BreathTab />);
    change(tempo(), 0.8);
    change(metronome(), 0.7);
    fireEvent.click(screen.getByLabelText("Wood block"));
    const saved = JSON.parse(localStorage.getItem("breather.state") ?? "{}") as {
      version: number;
      value: { mix: { tempo: number; metronome: { level: number; voice: string } } };
    };
    expect(saved.version).toBe(1);
    expect(saved.value.mix.tempo).toBe(0.8);
    expect(saved.value.mix.metronome).toEqual({ level: 0.7, voice: "metro-wood-block" });
  });
});

describe("the running guide", () => {
  it("picks up a tempo change with no jump and a level change in the trims", () => {
    const f = createFakeEngine();
    const trims: [string, number][] = [];
    f.engine.setTrim = (id: string, v: number) => void trims.push([id, v]);
    let t = 0;
    const machine = createPhaseMachine(1);
    machine.start(0);
    const stop = startBeats({
      machine,
      clock: () => t,
      engine: f.engine,
      store,
      every: () => () => {},
    });
    render(<BreathTab />);
    t = 2.3;
    const before = machine.stateAt(t);
    change(tempo(), 0.9);
    const after = machine.stateAt(t);
    expect(after.phase).toBe(before.phase);
    expect(after.progress).toBeCloseTo(before.progress, 9);
    expect(after.countdown).toBe(before.countdown);
    // Faster tempo: three seconds now hold at least three beats, not the two at 1.5 s each.
    expect(machine.beatsBetween(t, t + 3).length).toBeGreaterThanOrEqual(3);
    trims.length = 0;
    change(metronome(), 1);
    const voiceTrim = trims.find(([id]) => id === "metro-heartbeat-thump");
    expect(voiceTrim?.[1]).toBeGreaterThan(0.69 * 0.99);
    stop();
  });
});

describe("seconds mode", () => {
  const secondsSwitch = () =>
    screen.getByRole("switch", { name: /seconds mode/i }) as HTMLInputElement;

  it("is off by default and flips the store when toggled (AC1)", () => {
    render(<BreathTab />);
    expect(secondsSwitch().checked).toBe(false);
    expect(tempo().disabled).toBe(false);
    fireEvent.click(secondsSwitch());
    expect(store.get().secondsMode).toBe(true);
    expect(secondsSwitch().checked).toBe(true);
    expect(screen.getByText("Inhale about 4s")).toBeTruthy();
  });

  it("disables the tempo slider and says why, in the tooltip and to screen readers (AC3)", () => {
    store.set({ secondsMode: true });
    render(<BreathTab />);
    expect(tempo().disabled).toBe(true);
    const why = document.getElementById(tempo().getAttribute("aria-describedby")!)!;
    expect(why.getAttribute("role")).toBe("tooltip");
    expect(why.textContent).toMatch(/off because seconds mode is on/i);
    expect(metronome().disabled).toBe(false);
  });

  it("brings the tempo slider back when the mode goes off (AC4)", () => {
    store.set({ secondsMode: true });
    render(<BreathTab />);
    fireEvent.click(secondsSwitch());
    expect(store.get().secondsMode).toBe(false);
    expect(tempo().disabled).toBe(false);
    const why = document.getElementById(tempo().getAttribute("aria-describedby")!)!;
    expect(why.textContent).not.toMatch(/seconds mode is on/i);
  });

  it("persists across a reload (AC5)", () => {
    render(<BreathTab />);
    fireEvent.click(secondsSwitch());
    expect(loadState().secondsMode).toBe(true);
  });

  it("passes vitest-axe with the mode on", async () => {
    store.set({ secondsMode: true });
    const { container } = render(<BreathTab />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
