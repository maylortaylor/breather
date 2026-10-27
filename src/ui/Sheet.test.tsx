// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { DEFAULT_STATE, store, type TabName } from "../store";
import { Sheet } from "./Sheet";

const setMaster = vi.fn();
vi.mock("../audio/session", () => ({ getSession: () => ({ mixer: { setMaster } }) }));

let wide = false;
let reduced = false;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setMaster.mockClear();
  wide = false;
  reduced = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width")
      ? wide
      : query.includes("reduced-motion")
        ? reduced
        : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  store.set({ ...DEFAULT_STATE, screen: "resting", welcomeSeen: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const openSheet = (tab: TabName = "breath") => {
  store.set({ sheet: { open: true, tab } });
  render(<Sheet />);
  return document.querySelector<HTMLElement>("[data-sheet]")!;
};

const tap = (el: Element | Document, at = { x: 100, y: 100 }) => {
  fireEvent.pointerDown(el, { clientX: at.x, clientY: at.y });
  fireEvent.pointerUp(el, { clientX: at.x, clientY: at.y });
};

describe("opening", () => {
  it("opens on a tap away from the ring, on Breath the first time (AC1)", () => {
    render(<Sheet />);
    expect(document.querySelector("[data-sheet]")).toBeNull();
    tap(document.body);
    expect(store.get().sheet).toEqual({ open: true, tab: "breath" });
    expect(screen.getByRole("tab", { name: "Breath", selected: true })).toBeTruthy();
  });

  it("opens on the last-used tab", () => {
    store.set({ sheet: { open: false, tab: "session" } });
    render(<Sheet />);
    tap(document.body);
    expect(screen.getByRole("tab", { name: "Session", selected: true })).toBeTruthy();
  });

  it("opens on a swipe up, even starting on a button", () => {
    render(
      <>
        <button type="button">ring</button>
        <Sheet />
      </>
    );
    const ring = screen.getByRole("button", { name: "ring" });
    fireEvent.pointerDown(ring, { clientX: 100, clientY: 400 });
    fireEvent.pointerUp(ring, { clientX: 104, clientY: 300 });
    expect(store.get().sheet.open).toBe(true);
  });

  it("leaves a tap on a button to the button", () => {
    render(
      <>
        <button type="button">ring</button>
        <Sheet />
      </>
    );
    tap(screen.getByRole("button", { name: "ring" }));
    expect(store.get().sheet.open).toBe(false);
  });

  it("does not open before the app is resting", () => {
    store.set({ screen: "begin" });
    render(<Sheet />);
    tap(document.body);
    expect(store.get().sheet.open).toBe(false);
  });

  it("opens with the Up arrow and puts focus on the active tab", () => {
    render(<Sheet />);
    fireEvent.keyDown(document.body, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Breath" }));
  });

  it("closes from the handle and on Escape", () => {
    openSheet();
    fireEvent.click(screen.getByRole("button", { name: "Close controls" }));
    expect(store.get().sheet.open).toBe(false);
    cleanup();
    store.set({ sheet: { open: true, tab: "breath" } });
    render(<Sheet />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(store.get().sheet.open).toBe(false);
  });
});

describe("Settings button", () => {
  const button = () => screen.getByRole("button", { name: "Settings" });

  it("is on screen while the sheet is closed, collapsed, and not before resting", () => {
    render(<Sheet />);
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(button().hasAttribute("aria-controls")).toBe(false);
    cleanup();
    store.set({ screen: "begin" });
    render(<Sheet />);
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
  });

  it("toggles the sheet and keeps aria-expanded in step", () => {
    render(<Sheet />);
    fireEvent.click(button());
    expect(store.get().sheet.open).toBe(true);
    expect(button().getAttribute("aria-expanded")).toBe("true");
    const sheet = document.querySelector("[data-sheet]")!;
    expect(button().getAttribute("aria-controls")).toBe(sheet.id);
    fireEvent.click(button());
    expect(store.get().sheet.open).toBe(false);
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("stays on screen when the sheet closes by itself, with the sheet gone", () => {
    render(<Sheet />);
    fireEvent.click(button());
    act(() => void vi.advanceTimersByTime(8000));
    expect(document.querySelector("[data-sheet]")).toBeNull();
    expect(store.get().sheet.open).toBe(false);
    expect(button()).toBeTruthy();
  });

  it("a press on it does not also open the sheet as a tap away", () => {
    render(<Sheet />);
    tap(button());
    expect(store.get().sheet.open).toBe(false);
  });

  it("shows its tooltip after 2500 ms of hover", () => {
    render(<Sheet />);
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(tip.textContent).toBe("Sounds, tempo and presets");
    fireEvent.pointerEnter(button(), { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(2500));
    expect(tip.hidden).toBe(false);
  });

  it("passes axe closed and open", async () => {
    vi.useRealTimers();
    const { unmount } = render(<Sheet />);
    expect((await axe(document.body)).violations).toEqual([]);
    unmount();
    openSheet("sounds");
    expect((await axe(document.body)).violations).toEqual([]);
  });
});

describe("layout", () => {
  it("is a bottom sheet below 900 px (AC2)", () => {
    expect(openSheet().dataset.layout).toBe("sheet");
  });
  it("is a right-side panel at 900 px and wider (AC2)", () => {
    wide = true;
    expect(openSheet().dataset.layout).toBe("panel");
  });
  it("has three tabs and the tab bar switches the body", () => {
    openSheet();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Breath",
      "Sounds",
      "Session",
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Sounds" }));
    expect(store.get().sheet.tab).toBe("sounds");
    expect(screen.getByRole("slider", { name: "Master" })).toBeTruthy();
  });
  it("moves between tabs with the arrow keys", () => {
    openSheet();
    const breath = screen.getByRole("tab", { name: "Breath" });
    breath.focus();
    fireEvent.keyDown(breath, { key: "ArrowRight" });
    expect(store.get().sheet.tab).toBe("sounds");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Sounds" }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(store.get().sheet.tab).toBe("session");
  });
});

describe("idle close", () => {
  it("closes after 8 s idle, with no fade, drift or mask (AC3)", () => {
    const sheet = openSheet();
    act(() => void vi.advanceTimersByTime(7999));
    expect(document.contains(sheet)).toBe(true);
    expect(sheet.style.opacity).toBe("");
    act(() => void vi.advanceTimersByTime(1));
    expect(document.contains(sheet)).toBe(false);
    expect(store.get().sheet.open).toBe(false);
  });

  it("a pointer move late in the wait keeps it open (AC4)", () => {
    const sheet = openSheet();
    act(() => void vi.advanceTimersByTime(7000));
    fireEvent.pointerMove(document.body);
    act(() => void vi.advanceTimersByTime(7000));
    expect(document.contains(sheet)).toBe(true);
    act(() => void vi.advanceTimersByTime(1000));
    expect(document.contains(sheet)).toBe(false);
  });

  it("never closes while a control has keyboard focus (AC6)", () => {
    const sheet = openSheet();
    fireEvent.keyDown(document.body, { key: "Tab" });
    screen.getByRole("tab", { name: "Sounds" }).focus();
    act(() => void vi.advanceTimersByTime(30000));
    expect(document.contains(sheet)).toBe(true);
    act(() => screen.getByRole("tab", { name: "Sounds" }).blur());
    act(() => void vi.advanceTimersByTime(8000));
    expect(document.contains(sheet)).toBe(false);
  });

  it("does not hold on mouse focus, so a clicked tab still closes", () => {
    const sheet = openSheet();
    fireEvent.pointerDown(screen.getByRole("tab", { name: "Sounds" }));
    screen.getByRole("tab", { name: "Sounds" }).focus();
    act(() => void vi.advanceTimersByTime(8000));
    expect(document.contains(sheet)).toBe(false);
  });
});

describe("master volume", () => {
  it("sets the mixer master and never writes it to storage (AC7)", () => {
    openSheet("sounds");
    const slider = screen.getByRole("slider", { name: "Master" }) as HTMLInputElement;
    expect(slider.value).toBe("0.7");
    fireEvent.change(slider, { target: { value: "0.3" } });
    expect(setMaster).toHaveBeenCalledWith(0.3);
    expect(store.get().master).toBe(0.3);
    expect(localStorage.getItem("breather.state") ?? "").not.toContain("master");
  });
});

describe("tooltip", () => {
  it("shows after 2500 ms of hover on a control (AC8)", () => {
    openSheet("sounds");
    const slider = screen.getByRole("slider", { name: "Master" });
    const tip = screen.getByText("How loud everything is.", { exact: false });
    fireEvent.pointerEnter(slider, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(2499));
    expect(tip.hidden).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(tip.hidden).toBe(false);
  });
});

describe("accessibility", () => {
  it.each<TabName>(["breath", "sounds", "session"])(
    "passes axe on the %s tab (AC9)",
    async (tab) => {
      vi.useRealTimers();
      openSheet(tab);
      const results = await axe(document.body);
      expect(results.violations).toEqual([]);
    }
  );
});
