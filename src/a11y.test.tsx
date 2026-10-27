// @vitest-environment jsdom
// The accessibility audit: every screen and tab through axe in both themes, keyboard order, focus
// visibility, spoken slider values, tooltip links, Escape and focus return, the phase announcer
// and the reduced-motion forms. Things only a real screen reader can judge are not claimed here.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { App, Screens } from "./App";
import { auditPalette, contrastRatio, findTextAlpha, parseThemeSource } from "./contrast";
import { createPhaseMachine } from "./breath/phases";
import { Breath, createRing, PHASE_WORDS, ringLook } from "./breath/Ring";
import { auroraLook, createAuroraClock } from "./background/logic";
import { BUILT_INS } from "./presets";
import { DEFAULT_STATE, store, type TabName } from "./store";
import { About } from "./ui/About";
import { volumeText } from "./ui/soundsLogic";

vi.mock("./audio/session", () => ({
  getSession: () => null,
  beginAudio: vi.fn(),
  resetSession: vi.fn(),
}));

const src = join(import.meta.dirname);
const { night, dim } = parseThemeSource(readFileSync(join(src, "theme.stylex.ts"), "utf8"));
const css = readFileSync(join(src, "index.css"), "utf8");

let reduced = false;

beforeEach(() => {
  reduced = false;
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion") ? reduced : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const sleep = BUILT_INS[0]!;
const resting = (over: Partial<typeof DEFAULT_STATE> = {}) =>
  store.set({
    ...DEFAULT_STATE,
    screen: "resting",
    welcomeSeen: true,
    mix: JSON.parse(JSON.stringify(sleep.mix)),
    presetId: "sleep",
    ...over,
  });

const names = (els: Element[]) => els.map(accessibleName);

function accessibleName(el: Element): string {
  const label = el.getAttribute("aria-label");
  if (label) return label;
  // aria-labelledby wins over a wrapping <label>, as in browsers: the slider labels name
  // themselves from their own label element, not from the live value text beside it.
  const by = el.getAttribute("aria-labelledby");
  if (by) {
    return by
      .split(/\s+/)
      .map((id) => visibleText(el.ownerDocument.getElementById(id) ?? el))
      .join(" ")
      .trim();
  }
  const wrapped = el.closest("label");
  return visibleText(wrapped ?? el);
}

/** Text a screen reader would read: aria-hidden parts are left out. */
function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll("[aria-hidden=true], input")) hidden.remove();
  return clone.textContent!.replace(/\s+/g, " ").trim();
}

const FOCUSABLE = "button, input, select, textarea, a[href], [tabindex]";

/** The elements Tab would visit, in DOM order: roving tabindex and radio groups honoured. */
function tabStops(root: ParentNode = document): HTMLElement[] {
  const seenGroups = new Set<string>();
  const radios = [...root.querySelectorAll<HTMLInputElement>("input[type=radio]")];
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if ((el as HTMLButtonElement).disabled || el.closest("[hidden]")) return false;
    const idx = el.getAttribute("tabindex");
    if (idx !== null && Number(idx) < 0) return false;
    if (el instanceof HTMLInputElement && el.type === "radio") {
      const group = radios.filter((r) => r.name === el.name);
      const stop = group.find((r) => r.checked) ?? group[0]!;
      if (seenGroups.has(el.name) || el !== stop) return false;
      seenGroups.add(el.name);
    }
    return true;
  });
}

describe("axe on every screen, in both themes", () => {
  const themes = [
    ["normal", false],
    ["dim", true],
  ] as const;

  it.each(themes)("welcome card (%s)", async (_n, isDim) => {
    store.set({ ...DEFAULT_STATE, dim: isDim });
    const { container } = render(
      <App>
        <Screens />
      </App>
    );
    expect(screen.getByRole("heading", { name: "Breather" })).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });

  it.each(themes)("Begin screen (%s)", async (_n, isDim) => {
    store.set({ ...DEFAULT_STATE, dim: isDim, welcomeSeen: true, screen: "begin" });
    const { container } = render(
      <App>
        <Screens />
      </App>
    );
    expect(screen.getByRole("button", { name: "Begin" })).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });

  it.each(themes)("resting screen with the Settings button (%s)", async (_n, isDim) => {
    resting({ dim: isDim });
    const { container } = render(
      <App>
        <Screens />
      </App>
    );
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });

  const tabs: TabName[] = ["breath", "sounds", "session"];
  it.each(themes.flatMap(([n, d]) => tabs.map((t) => [n, d, t] as const)))(
    "sheet open on the %s theme, %s",
    async (_n, isDim, tab) => {
      resting({ dim: isDim, sheet: { open: true, tab } });
      const { container } = render(
        <App>
          <Screens />
        </App>
      );
      expect(screen.getByRole("tab", { name: /./, selected: true })).toBeTruthy();
      expect((await axe(container)).violations).toEqual([]);
    }
  );

  it.each(themes)("the About line (%s)", async (_n, isDim) => {
    store.set({ ...DEFAULT_STATE, dim: isDim });
    const { container } = render(<About />);
    expect(screen.getByRole("link", { name: "Licence notices" })).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("tab order", () => {
  it("welcome card: Got it only", () => {
    store.set({ ...DEFAULT_STATE });
    render(<Screens />);
    expect(names(tabStops())).toEqual(["Got it"]);
  });

  it("Begin screen: Begin only", () => {
    store.set({ ...DEFAULT_STATE, welcomeSeen: true, screen: "begin" });
    render(<Screens />);
    expect(names(tabStops())).toEqual(["Begin"]);
  });

  it("resting screen: the ring, then Settings", () => {
    resting();
    render(<Screens />);
    expect(names(tabStops())).toEqual(["Pause breathing guide", "Settings"]);
  });

  it("Breath tab: ring, Settings, handle, the tab strip, then the controls top to bottom", () => {
    resting({ sheet: { open: true, tab: "breath" } });
    render(<Screens />);
    expect(names(tabStops())).toEqual([
      "Pause breathing guide",
      "Settings",
      "Close controls",
      "Breath",
      "Tempo",
      "Seconds mode",
      "Metronome",
      "Heartbeat thump",
      "Phase sound volume",
      "Rising tones",
    ]);
  });

  it("Session tab: presets, Save as new, Dim mode, How it works, then the licence link", () => {
    resting({ sheet: { open: true, tab: "session" } });
    render(<Screens />);
    // The sleep timer buttons are disabled until Begin has made an audio session.
    expect(names(tabStops())).toEqual([
      "Pause breathing guide",
      "Settings",
      "Close controls",
      "Session",
      "Sleep (changed)",
      "Focus",
      "Reset",
      "Save as new",
      "Dim mode",
      "How it works",
      "Licence notices",
    ]);
  });

  it("Sounds tab: master, the chips, then each playing row's sliders and LFO buttons", () => {
    resting({ sheet: { open: true, tab: "sounds" } });
    render(<Screens />);
    const stops = names(tabStops());
    expect(stops.slice(0, 5)).toEqual([
      "Pause breathing guide",
      "Settings",
      "Close controls",
      "Sounds",
      "Master",
    ]);
    expect(stops.slice(5, 14)).toEqual([
      "White noise",
      "Pink noise",
      "Brown noise",
      "Ocean waves",
      "Underwater bubbles",
      "Whale B: blue moan",
      "Pad: Dreamy",
      "Pad: Tonal",
      "Pad: Deep",
    ]);
    // Each row: its volume slider (two thumbs when an LFO is on), then its three LFO buttons.
    expect(stops.slice(14, 18)).toEqual([
      "Brown noise volume",
      "LFO 1 (teal)",
      "LFO 2 (violet)",
      "LFO 3 (amber)",
    ]);
    expect(stops.slice(18, 20)).toEqual([
      "Ocean waves minimum volume",
      "Ocean waves maximum volume",
    ]);
  });
});

describe("focus visibility", () => {
  const rule = (/:focus-visible\s*\{([^}]*)\}/.exec(css) ?? [])[1] ?? "";

  it("has an explicit :focus-visible outline at least 2px wide", () => {
    expect(rule).toMatch(/outline:\s*(\d+)px\s+solid\s+var\(--focus[,)]/);
    expect(Number(/outline:\s*(\d+)px/.exec(rule)![1])).toBeGreaterThanOrEqual(2);
  });

  it("takes its colour from a token that passes 3:1 on every ground, in both themes", () => {
    const night_ = /\.shell\s*\{[^}]*--focus:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
    const dim_ = /\.shell\[data-dim\]\s*\{[^}]*--focus:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
    expect(night_).toBeTruthy();
    expect(dim_).toBeTruthy();
    for (const [palette, ring] of [
      [night, night_!],
      [dim, dim_!],
    ] as const) {
      for (const ground of ["bg", "surface", "tabBreath", "tabSounds", "tabSession"]) {
        expect(contrastRatio(ring, palette[ground]!), ground).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("never removes an outline without a visible replacement", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx|css)$/.test(full) && !/\.test\./.test(full)) files.push(full);
      }
    };
    walk(src);
    for (const f of files) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/outline(Style)?\s*:\s*["']?(none|0)\b/);
    }
  });

  it("marks the shell dim so the dim ring colour applies", () => {
    resting({ dim: true });
    const { container } = render(
      <App>
        <Screens />
      </App>
    );
    expect(container.querySelector("main.shell")?.hasAttribute("data-dim")).toBe(true);
    cleanup();
    resting({ dim: false });
    const again = render(
      <App>
        <Screens />
      </App>
    );
    expect(again.container.querySelector("main.shell")?.hasAttribute("data-dim")).toBe(false);
  });
});

describe("sliders", () => {
  const sliders = (tab: TabName) => {
    resting({ sheet: { open: true, tab } });
    render(<Screens />);
    return [...document.querySelectorAll<HTMLInputElement>("input[type=range]")];
  };

  it.each(["breath", "sounds"] as const)("every slider on %s has a name and words", (tab) => {
    const found = sliders(tab);
    expect(found.length).toBeGreaterThan(1);
    for (const input of found) {
      const name = accessibleName(input);
      const spoken = input.getAttribute("aria-valuetext");
      expect(name.length, "name").toBeGreaterThan(0);
      expect(spoken, name).toBeTruthy();
      // Words only: no BPM figure, no raw 0.35.
      expect(spoken, name).not.toMatch(/\d/);
    }
  });

  it("the spoken value follows the slider", () => {
    const master = sliders("sounds").find((i) => accessibleName(i).startsWith("Master"))!;
    fireEvent.change(master, { target: { value: "0.05" } });
    const quiet = master.getAttribute("aria-valuetext");
    fireEvent.change(master, { target: { value: "0.95" } });
    expect(master.getAttribute("aria-valuetext")).not.toBe(quiet);
  });

  it("LFO buttons announce number, colour and on state", () => {
    sliders("sounds");
    const group = screen.getAllByRole("group", { name: /LFO$/ })[0]!;
    const buttons = [...group.querySelectorAll("button")];
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "LFO 1 (teal)",
      "LFO 2 (violet)",
      "LFO 3 (amber)",
    ]);
    const second = buttons[1]!;
    const before = second.getAttribute("aria-pressed");
    fireEvent.click(second);
    expect(second.getAttribute("aria-pressed")).toBe(before === "true" ? "false" : "true");
    expect(second.getAttribute("aria-pressed")).toMatch(/^(true|false)$/);
    fireEvent.click(second);
    expect(second.getAttribute("aria-pressed")).toBe(before);
  });
});

describe("volumeText", () => {
  it("speaks each band in words and never a number", () => {
    const said = [0, 0.1, 0.3, 0.5, 0.7, 1].map(volumeText);
    expect(said).toEqual(["Silent", "Very quiet", "Quiet", "Medium", "Loud", "Very loud"]);
  });
});

describe("tooltips", () => {
  it.each(["breath", "sounds", "session"] as const)(
    "on %s each is linked and already in the DOM",
    (tab) => {
      resting({ sheet: { open: true, tab } });
      render(<Screens />);
      const tips = [...document.querySelectorAll<HTMLElement>("[role=tooltip]")];
      expect(tips.length).toBeGreaterThan(0);
      for (const tip of tips) {
        expect(tip.id).toBeTruthy();
        expect(tip.textContent!.trim().length).toBeGreaterThan(5);
        const owners = document.querySelectorAll(`[aria-describedby~="${tip.id}"]`);
        expect(owners.length, tip.textContent!).toBeGreaterThan(0);
      }
      for (const el of document.querySelectorAll("[aria-describedby]")) {
        for (const id of el.getAttribute("aria-describedby")!.split(/\s+/)) {
          expect(document.getElementById(id), id).toBeTruthy();
        }
      }
    }
  );

  it("the Settings tooltip is linked while it is hidden", () => {
    resting();
    render(<Screens />);
    const settings = screen.getByRole("button", { name: "Settings" });
    const tip = document.getElementById(settings.getAttribute("aria-describedby")!)!;
    expect(tip.hidden).toBe(true);
    expect(tip.textContent).toBe("Sounds, tempo and presets");
  });
});

describe("Escape and focus return", () => {
  it("Escape closes the sheet and focus goes back to Settings", () => {
    resting();
    render(<Screens />);
    const settings = screen.getByRole("button", { name: "Settings" });
    settings.focus();
    fireEvent.click(settings);
    expect(store.get().sheet.open).toBe(true);
    screen.getByRole("tab", { selected: true }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(store.get().sheet.open).toBe(false);
    expect(document.activeElement).toBe(settings);
  });

  it("returns focus to a control that was not Settings when that opened it", () => {
    resting();
    render(<Screens />);
    const ring = screen.getByRole("button", { name: "Pause breathing guide" });
    ring.focus();
    fireEvent.keyDown(ring, { key: "ArrowUp" });
    expect(store.get().sheet.open).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(store.get().sheet.open).toBe(false);
    expect(document.activeElement).toBe(ring);
  });

  it("the Close controls handle returns focus too", () => {
    resting();
    render(<Screens />);
    const settings = screen.getByRole("button", { name: "Settings" });
    settings.focus();
    fireEvent.click(settings);
    const close = screen.getByRole("button", { name: "Close controls" });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(settings);
  });
});

describe("phase announcer", () => {
  const setup = () => {
    let t = 0;
    const machine = createPhaseMachine(1);
    store.set({ ...DEFAULT_STATE, screen: "resting" });
    const view = render(<Breath now={() => t} machine={machine} />);
    return {
      view,
      at: (s: number) =>
        act(() => {
          t = s;
        }),
    };
  };

  it("has one polite live region for the phase word and keeps the countdown out of it", () => {
    const { view } = setup();
    const word = view.container.querySelector("[data-word]")!;
    expect(word.getAttribute("role")).toBe("status");
    expect(view.container.querySelector("[data-count]")!.getAttribute("aria-hidden")).toBe("true");
    expect(word.contains(view.container.querySelector("[data-count]"))).toBe(false);
  });

  it("writes the word once per phase, not once per frame, beat or countdown number", () => {
    const root = document.createElement("div");
    root.innerHTML = `<span data-ring></span><span data-count></span><p data-word></p><p data-paused></p>`;
    const ring = createRing();
    ring.mount(root);
    const watch = new MutationObserver(() => {});
    watch.observe(root.querySelector("[data-word]")!, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    const machine = createPhaseMachine(1);
    machine.start(0);
    // One full 19 s cycle at 60 frames a second.
    for (let f = 0; f <= 19 * 60; f++) ring.draw(machine.stateAt(f / 60));
    const writes = watch
      .takeRecords()
      .filter((r) => r.addedNodes.length > 0)
      .map((r) => r.addedNodes[0]!.textContent);
    watch.disconnect();
    expect(writes).toEqual([
      PHASE_WORDS.inhale,
      PHASE_WORDS.hold,
      PHASE_WORDS.exhale,
      PHASE_WORDS.inhale,
    ]);
  });

  it("announces Paused and Resumed once each, through a second polite region", () => {
    const { view, at } = setup();
    at(1);
    const live = view.container.querySelector("[data-paused]")!;
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Pause breathing guide" }));
    expect(live.textContent).toBe("Paused");
    at(3);
    expect(live.textContent).toBe("Paused");
    fireEvent.click(screen.getByRole("button", { name: "Resume breathing guide" }));
    expect(live.textContent).toBe("Resumed");
  });

  it("the announcer text is visually hidden by a real class, not display:none", () => {
    const { view } = setup();
    const live = view.container.querySelector<HTMLElement>("[data-paused]")!;
    expect(live.className).toContain("sr-only");
    expect(css).toMatch(/\.sr-only\s*\{[^}]*position:\s*absolute/);
    expect(/\.sr-only\s*\{([^}]*)\}/.exec(css)![1]).not.toMatch(/display:\s*none/);
  });
});

describe("reduced motion", () => {
  it("ring: linear size and a steady glow, in the markup", () => {
    const root = document.createElement("div");
    root.innerHTML = `<span data-ring></span><span data-count></span><p data-word></p><p data-paused></p>`;
    const ring = createRing();
    ring.mount(root);
    ring.setReducedMotion(true);
    const glow = (progress: number, phase: "inhale" | "hold") => {
      ring.draw({ phase, progress, countdown: 1, beat: 0, paused: false });
      return root.querySelector<HTMLElement>("[data-ring]")!.style.getPropertyValue("--ring-glow");
    };
    expect(glow(0.1, "inhale")).toBe(glow(0.9, "hold"));
    expect(
      ringLook(
        { phase: "inhale", progress: 0.5, countdown: 1, beat: 0, paused: false },
        true,
        false
      ).scale
    ).toBeCloseTo(0.8, 6);
  });

  it("aurora: slower and flatter, and its clock advances more slowly", () => {
    const base = { level: 0.5, dim: false };
    const calm = auroraLook({ ...base, reduced: true });
    const lively = auroraLook({ ...base, reduced: false });
    expect(calm.speed).toBeLessThan(lively.speed);
    expect(calm.amplitude).toBeLessThan(lively.amplitude);
    const a = createAuroraClock();
    const b = createAuroraClock();
    expect(a.step(1, true).time).toBeLessThan(b.step(1, false).time);
  });
});

describe("contrast", () => {
  it.each([
    ["night", night],
    ["dim", dim],
  ] as const)("passes all three tables in the %s theme", (_n, palette) => {
    expect(auditPalette(palette)).toEqual([]);
  });

  it("no text colour in any stylesheet or component carries alpha", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx|css)$/.test(full) && !/\.test\./.test(full)) files.push(full);
      }
    };
    walk(src);
    expect(files.length).toBeGreaterThan(10);
    expect(files.flatMap((f) => findTextAlpha(readFileSync(f, "utf8")))).toEqual([]);
  });
});
