import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MIX } from "./presets";
import { createStore, loadState, persist, saveState } from "./store";

afterEach(() => vi.unstubAllGlobals());

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const setKeys: string[] = [];
  return {
    setKeys,
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      setKeys.push(k);
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("createStore", () => {
  it("fires a subscriber once per set and not after unsubscribe", () => {
    const store = createStore({ n: 0 });
    const seen: number[] = [];
    const off = store.subscribe(() => seen.push(store.get().n));
    store.set({ n: 1 });
    store.set({ n: 2 });
    expect(seen).toEqual([1, 2]);
    off();
    store.set({ n: 3 });
    expect(seen).toEqual([1, 2]);
    expect(store.get().n).toBe(3);
  });

  it("merges a partial patch and accepts an updater", () => {
    const store = createStore({ a: 1, b: 2 });
    store.set({ b: 5 });
    store.set((s) => ({ a: s.a + 10 }));
    expect(store.get()).toEqual({ a: 11, b: 5 });
  });

  it("skips subscribers when nothing changes", () => {
    const store = createStore({ a: 1 });
    const fn = vi.fn();
    store.subscribe(fn);
    store.set({ a: 1 });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("persist", () => {
  it("round-trips a value under the breather. prefix with version 1", () => {
    const ls = memoryStorage();
    vi.stubGlobal("localStorage", ls);
    const p = persist<{ x: number }>("state");
    p.write({ x: 4 });
    expect(JSON.parse(ls.data.get("breather.state") ?? "")).toEqual({
      version: 1,
      value: { x: 4 },
    });
    expect(p.read()).toEqual({ x: 4 });
  });

  it("returns null for a higher version, a missing version or invalid JSON", () => {
    const ls = memoryStorage({
      "breather.high": JSON.stringify({ version: 2, value: { x: 1 } }),
      "breather.none": JSON.stringify({ value: { x: 1 } }),
      "breather.junk": "{not json",
    });
    vi.stubGlobal("localStorage", ls);
    expect(persist("high").read()).toBeNull();
    expect(persist("none").read()).toBeNull();
    expect(persist("junk").read()).toBeNull();
    expect(persist("absent").read()).toBeNull();
  });
});

describe("storage failures", () => {
  it("still reads and writes in memory when localStorage throws on every call", () => {
    const boom = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom });
    const store = createStore({ dim: false });
    expect(() => store.set({ dim: true })).not.toThrow();
    expect(store.get().dim).toBe(true);
    expect(() => persist("state").write({ a: 1 })).not.toThrow();
    expect(persist("state").read()).toBeNull();
    expect(loadState()).toEqual({});
    expect(() =>
      saveState({ welcomeSeen: false, dim: true, secondsMode: false, presetId: null })
    ).not.toThrow();
  });

  it("copes when localStorage itself is missing", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(persist("state").read()).toBeNull();
    expect(() => persist("state").write(1)).not.toThrow();
  });
});

describe("saved state", () => {
  it("writes only keys that start with breather.", () => {
    const ls = memoryStorage();
    vi.stubGlobal("localStorage", ls);
    saveState({ welcomeSeen: true, dim: true, secondsMode: false, presetId: "calm" });
    persist("presets").write([]);
    expect(ls.setKeys.length).toBeGreaterThan(0);
    for (const k of ls.setKeys) expect(k.startsWith("breather.")).toBe(true);
  });

  it("loads valid fields and drops fields of the wrong type", () => {
    vi.stubGlobal(
      "localStorage",
      memoryStorage({
        "breather.state": JSON.stringify({
          version: 1,
          value: { welcomeSeen: true, dim: "yes", master: 0.4, presetId: 7, extra: 1 },
        }),
      })
    );
    expect(loadState()).toEqual({ welcomeSeen: true });
  });
});

describe("master volume", () => {
  it("is never written to storage and an old stored value is ignored", () => {
    const ls = memoryStorage({
      "breather.state": JSON.stringify({ version: 1, value: { master: 0.2, dim: true } }),
    });
    vi.stubGlobal("localStorage", ls);
    expect(loadState()).toEqual({ dim: true });
    saveState({ welcomeSeen: true, dim: true, secondsMode: false, presetId: "calm" });
    expect(ls.getItem("breather.state")).not.toContain("master");
  });
});

describe("saved mix", () => {
  it("is left out while it equals the default, so first launch keeps Sleep", () => {
    const ls = memoryStorage();
    vi.stubGlobal("localStorage", ls);
    saveState({
      welcomeSeen: true,
      dim: false,
      secondsMode: false,
      presetId: null,
      mix: DEFAULT_MIX,
    });
    expect(ls.getItem("breather.state")).not.toContain('"mix"');
  });

  it("round-trips an edited mix and clamps what it reads back", () => {
    const ls = memoryStorage();
    vi.stubGlobal("localStorage", ls);
    const mix = { ...DEFAULT_MIX, sounds: { white: { lfo: 2 as const, min: 0, max: 0.5 } } };
    saveState({ welcomeSeen: true, dim: false, secondsMode: false, presetId: null, mix });
    expect(loadState().mix?.sounds).toEqual({ white: { lfo: 2, min: 0, max: 0.5 } });
    ls.setItem(
      "breather.state",
      JSON.stringify({
        version: 1,
        value: { mix: { sounds: { white: { lfo: 9, min: 5, max: 2 }, nope: {} } } },
      })
    );
    expect(loadState().mix?.sounds).toEqual({ white: { lfo: 0, min: 1, max: 1 } });
  });
});
