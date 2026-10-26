import { describe, expect, it } from "vitest";
import { BUILT_INS, MAX_USER_PRESETS, VERSION, type Preset } from "./presets";
import { makeId, PRESETS_KEY, readPresets, writePresets, type KeyValue } from "./presetStore";

const fakeStorage = (initial?: string): KeyValue & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PRESETS_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};
const user = (id: string, name: string): Preset => ({
  ...BUILT_INS[0]!,
  id,
  name,
  builtIn: false,
});

describe("presets storage", () => {
  it("uses the breather. prefix", () => {
    expect(PRESETS_KEY).toBe("breather.presets");
  });

  it("round-trips user presets as { version, presets }", () => {
    const s = fakeStorage();
    writePresets([user("a", "One"), user("b", "Two")], s);
    expect(JSON.parse(s.data.get(PRESETS_KEY)!).version).toBe(VERSION);
    expect(readPresets(s).map((p) => [p.id, p.name, p.builtIn])).toEqual([
      ["a", "One", false],
      ["b", "Two", false],
    ]);
  });

  it("reads nothing from missing, garbled or newer-version storage", () => {
    expect(readPresets(fakeStorage())).toEqual([]);
    expect(readPresets(fakeStorage("{not json"))).toEqual([]);
    expect(
      readPresets(fakeStorage(JSON.stringify({ version: 2, presets: [user("a", "x")] })))
    ).toEqual([]);
  });

  it("cannot forge a read-only preset and keeps at most ten", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      ...user(`p${i}`, `P${i}`),
      builtIn: true,
    }));
    const out = readPresets(fakeStorage(JSON.stringify({ version: VERSION, presets: many })));
    expect(out).toHaveLength(MAX_USER_PRESETS);
    expect(out.every((p) => !p.builtIn)).toBe(true);
  });

  it("survives storage that throws", () => {
    const bad: KeyValue = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readPresets(bad)).toEqual([]);
    expect(() => writePresets([user("a", "One")], bad)).not.toThrow();
  });

  it("makes distinct ids", () => {
    expect(new Set(Array.from({ length: 50 }, makeId)).size).toBe(50);
  });
});
