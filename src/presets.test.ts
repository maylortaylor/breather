import { describe, expect, it } from "vitest";
import { CATALOG } from "./audio/catalog";
import {
  BUILT_INS,
  DEFAULT_MASTER,
  DEFAULT_MIX,
  LOOP_IDS,
  MAX_NAME_LENGTH,
  MAX_USER_PRESETS,
  METRONOME_IDS,
  applyEdit,
  isModified,
  parsePreset,
  parsePresetList,
  parseState,
  restoreLaunch,
  saveUserPreset,
  serializePreset,
  type Mix,
  type Preset,
} from "./presets";

const sleep = BUILT_INS.find((p) => p.id === "sleep")!;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const ids = (() => {
  let n = 0;
  return () => `u${++n}`;
})();

describe("ids match the audio catalog", () => {
  it("lists exactly the loop and metronome ids that exist", () => {
    const loops = CATALOG.filter((e) => "loop" in e).map((e) => e.id);
    const metros = CATALOG.filter((e) => e.id.startsWith("metro-")).map((e) => e.id);
    expect([...LOOP_IDS].sort()).toEqual(loops.sort());
    expect([...METRONOME_IDS].sort()).toEqual(metros.sort());
  });
});

describe("built-ins", () => {
  it("are Sleep, Focus and Reset, all read-only", () => {
    expect(BUILT_INS.map((p) => p.name)).toEqual(["Sleep", "Focus", "Reset"]);
    expect(BUILT_INS.every((p) => p.builtIn)).toBe(true);
  });

  it("match the ticket 06 table", () => {
    const [s, f, r] = BUILT_INS as [Preset, Preset, Preset];
    expect(Object.keys(s.mix.sounds).sort()).toEqual(["brown", "bubbles", "ocean", "whale-b"]);
    expect(s.mix.sounds.ocean?.lfo).toBe(3);
    expect(s.mix.sounds["whale-b"]!.max).toBeLessThan(s.mix.sounds.bubbles!.max);
    expect(s.mix.tempo).toBe(0);
    expect(s.mix.metronome.voice).toBe("metro-heartbeat-thump");
    expect(s.mix.metronome.level).toBeGreaterThan(0);
    expect(s.dim).toBe(true);

    expect(Object.keys(f.mix.sounds).sort()).toEqual(["pad-tonal", "pink"]);
    expect(f.mix.sounds.pink?.lfo).toBe(0);
    expect(f.mix.sounds["pad-tonal"]!.max).toBeLessThan(f.mix.sounds.pink!.max);
    expect(f.mix.tempo).toBe(0.5);
    expect(f.mix.metronome.level).toBe(0);
    expect(f.dim).toBe(false);

    expect(Object.keys(r.mix.sounds).sort()).toEqual(["ocean", "pad-dreamy"]);
    expect(r.mix.sounds.ocean?.lfo).toBe(1);
    expect(r.mix.tempo).toBe(0.5);
    expect(r.mix.metronome.voice).toBe("metro-heartbeat-thump");
    expect(r.mix.metronome.level).toBeGreaterThan(0);
    expect(r.dim).toBe(false);
  });

  it("use only known sounds and in-range numbers", () => {
    for (const p of BUILT_INS) {
      for (const [id, s] of Object.entries(p.mix.sounds)) {
        expect(LOOP_IDS).toContain(id);
        expect(s.min).toBeGreaterThanOrEqual(0);
        expect(s.min).toBeLessThanOrEqual(s.max);
        expect(s.max).toBeLessThanOrEqual(1);
      }
      for (const l of p.mix.lfos) {
        expect(l.period).toBeGreaterThanOrEqual(8);
        expect(l.period).toBeLessThanOrEqual(120);
      }
    }
  });

  it("round-trip through JSON and parsePreset to an equal object", () => {
    for (const p of BUILT_INS) {
      const back = parsePreset(JSON.parse(JSON.stringify(serializePreset(p))));
      expect(back).toEqual(p);
    }
  });

  it("DEFAULT_MIX equals Sleep's mix", () => {
    expect(DEFAULT_MIX).toEqual(sleep.mix);
  });

  it("cannot be mutated", () => {
    expect(() => {
      (BUILT_INS as Preset[]).push(clone(sleep));
    }).toThrow();
    expect(() => {
      sleep.mix.tempo = 1;
    }).toThrow();
  });
});

describe("parsePreset", () => {
  const base = () => serializePreset({ ...clone(sleep), id: "mine", name: "Mine", builtIn: false });

  it("returns null for a non-object, a missing version and a higher version", () => {
    expect(parsePreset(null)).toBeNull();
    expect(parsePreset("x")).toBeNull();
    expect(parsePreset([])).toBeNull();
    const { version: _v, ...noVersion } = base();
    expect(parsePreset(noVersion)).toBeNull();
    expect(parsePreset({ ...base(), version: 2 })).toBeNull();
    expect(parsePreset({ ...base(), version: "1" })).toBeNull();
    expect(parsePreset({ ...base(), version: 1 })).not.toBeNull();
  });

  it("returns null without an id or a usable name", () => {
    expect(parsePreset({ ...base(), id: 5 })).toBeNull();
    expect(parsePreset({ ...base(), id: "" })).toBeNull();
    expect(parsePreset({ ...base(), name: "   " })).toBeNull();
    expect(parsePreset({ ...base(), name: 7 })).toBeNull();
  });

  it("drops unknown sound ids", () => {
    const raw = base() as unknown as {
      mix: { sounds: Record<string, unknown> };
    };
    raw.mix.sounds["whale-c"] = { lfo: 0, min: 0, max: 1 };
    raw.mix.sounds["__proto__x"] = { lfo: 0, min: 0, max: 1 };
    const p = parsePreset(raw)!;
    expect(Object.keys(p.mix.sounds).sort()).toEqual(["brown", "bubbles", "ocean", "whale-b"]);
  });

  it("clamps levels to 0..1 and keeps min at or under max", () => {
    const raw = base() as unknown as {
      mix: { sounds: Record<string, unknown> };
    };
    raw.mix.sounds.brown = { lfo: 0, min: -3, max: 9 };
    raw.mix.sounds.ocean = { lfo: 1, min: 0.8, max: 0.2 };
    const p = parsePreset(raw)!;
    expect(p.mix.sounds.brown).toEqual({ lfo: 0, min: 0, max: 1 });
    expect(p.mix.sounds.ocean!.min).toBeLessThanOrEqual(p.mix.sounds.ocean!.max);
    expect(p.mix.sounds.ocean!.max).toBe(0.2);
  });

  it("clamps LFO periods to 8..120", () => {
    const raw = base() as unknown as { mix: { lfos: { period: number }[] } };
    raw.mix.lfos[0]!.period = 1;
    raw.mix.lfos[1]!.period = 999;
    raw.mix.lfos[2]!.period = Number.NaN;
    const p = parsePreset(raw)!;
    expect(p.mix.lfos[0]!.period).toBe(8);
    expect(p.mix.lfos[1]!.period).toBe(120);
    expect(p.mix.lfos[2]!.period).toBe(8);
  });

  it("clamps tempo and metronome level, and replaces a bad voice, lfo slot or shape", () => {
    const raw = base() as unknown as {
      mix: {
        tempo: number;
        metronome: { level: number; voice: string };
        sounds: Record<string, { lfo: number }>;
        lfos: { shape: string }[];
      };
    };
    raw.mix.tempo = 4;
    raw.mix.metronome = { level: -1, voice: "phase-hold-steady" };
    raw.mix.sounds.brown!.lfo = 7;
    raw.mix.lfos[0]!.shape = "square";
    const p = parsePreset(raw)!;
    expect(p.mix.tempo).toBe(1);
    expect(p.mix.metronome).toEqual({
      level: 0,
      voice: "metro-heartbeat-thump",
      phaseSound: "tones",
      phaseVolume: 0.7,
    });
    expect(p.mix.sounds.brown!.lfo).toBe(0);
    expect(p.mix.lfos[0]!.shape).toBe("sine");
  });

  it("fills a missing mix with defaults and never throws on garbage", () => {
    const p = parsePreset({ version: 1, id: "x", name: "X" })!;
    expect(p.mix.sounds).toEqual({});
    expect(p.mix.lfos).toHaveLength(3);
    expect(p.builtIn).toBe(false);
    expect(p.dim).toBe(false);
    expect(() =>
      parsePreset({ version: 1, id: "x", name: "X", mix: { sounds: 5, lfos: "a" } })
    ).not.toThrow();
  });

  it("keeps builtIn only when it is exactly true", () => {
    expect(parsePreset({ ...base(), builtIn: true })!.builtIn).toBe(true);
    expect(parsePreset({ ...base(), builtIn: "yes" })!.builtIn).toBe(false);
  });

  it("truncates a stored name over the limit", () => {
    const p = parsePreset({ ...base(), name: "x".repeat(40) })!;
    expect(p.name).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe("parsePresetList", () => {
  const mk = (id: string) => ({
    ...serializePreset({ ...clone(sleep), id, name: id, builtIn: false }),
  });

  it("returns null for a missing or higher version", () => {
    expect(parsePresetList(null)).toBeNull();
    expect(parsePresetList({ presets: [] })).toBeNull();
    expect(parsePresetList({ version: 2, presets: [] })).toBeNull();
  });

  it("keeps valid presets, skips bad ones and caps at ten", () => {
    const presets = [mk("a"), { junk: true }, ...Array.from({ length: 12 }, (_, i) => mk(`p${i}`))];
    const out = parsePresetList({ version: 1, presets })!;
    expect(out).toHaveLength(MAX_USER_PRESETS);
    expect(out[0]!.id).toBe("a");
  });

  it("forces builtIn false so storage cannot forge a read-only preset", () => {
    const forged = { ...mk("f"), builtIn: true };
    expect(parsePresetList({ version: 1, presets: [forged] })![0]!.builtIn).toBe(false);
  });

  it("treats a non-array as empty", () => {
    expect(parsePresetList({ version: 1, presets: "x" })).toEqual([]);
  });
});

describe("parseState", () => {
  const good = () => ({
    version: 1,
    mix: clone(sleep.mix),
    dim: true,
    secondsMode: true,
    presetId: "sleep",
    welcomeSeen: true,
  });

  it("parses a good state", () => {
    expect(parseState(good())).toEqual({
      mix: sleep.mix,
      dim: true,
      secondsMode: true,
      presetId: "sleep",
      welcomeSeen: true,
    });
  });

  it("returns null for a non-object, missing version or higher version", () => {
    expect(parseState(undefined)).toBeNull();
    expect(parseState(3)).toBeNull();
    const { version: _v, ...rest } = good();
    expect(parseState(rest)).toBeNull();
    expect(parseState({ ...good(), version: 2 })).toBeNull();
  });

  it("drops unknown sounds, clamps numbers and defaults wrong types", () => {
    const raw = good() as unknown as Record<string, unknown> & {
      mix: { sounds: Record<string, unknown>; lfos: { period: number }[] };
    };
    raw.mix.sounds.nope = { lfo: 0, min: 0, max: 1 };
    raw.mix.sounds.pink = { lfo: 0, min: 0, max: 5 };
    raw.mix.lfos[2]!.period = 500;
    raw.dim = "yes";
    raw.presetId = 4;
    const s = parseState(raw)!;
    expect(s.mix.sounds).not.toHaveProperty("nope");
    expect(s.mix.sounds.pink!.max).toBe(1);
    expect(s.mix.lfos[2]!.period).toBe(120);
    expect(s.dim).toBe(false);
    expect(s.presetId).toBeNull();
  });

  it("uses the default mix when the stored mix is missing", () => {
    const s = parseState({ version: 1 })!;
    expect(s.mix).toEqual(DEFAULT_MIX);
    expect(s.welcomeSeen).toBe(false);
  });
});

describe("saveUserPreset", () => {
  const mix: Mix = clone(sleep.mix);

  it("trims the name and adds a non-built-in preset", () => {
    const r = saveUserPreset([], "  Night  ", mix, true, ids);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preset.name).toBe("Night");
    expect(r.preset.builtIn).toBe(false);
    expect(r.preset.dim).toBe(true);
    expect(r.presets).toEqual([r.preset]);
  });

  it("copies the mix so later edits do not leak in", () => {
    const m = clone(mix);
    const r = saveUserPreset([], "A", m, false, ids);
    m.tempo = 0.9;
    expect(r.ok && r.preset.mix.tempo).toBe(0);
  });

  it("refuses an eleventh preset", () => {
    let list: Preset[] = [];
    for (let i = 0; i < MAX_USER_PRESETS; i++) {
      const r = saveUserPreset(list, `P${i}`, mix, false, ids);
      expect(r.ok).toBe(true);
      if (r.ok) list = r.presets;
    }
    expect(list).toHaveLength(10);
    expect(saveUserPreset(list, "One more", mix, false, ids)).toEqual({
      ok: false,
      reason: "limit",
    });
  });

  it("refuses a name over 24 characters but accepts exactly 24", () => {
    expect(saveUserPreset([], "x".repeat(25), mix, false, ids)).toEqual({
      ok: false,
      reason: "name-too-long",
    });
    expect(saveUserPreset([], "x".repeat(24), mix, false, ids).ok).toBe(true);
  });

  it("measures the trimmed name, and refuses an empty one", () => {
    expect(saveUserPreset([], `  ${"x".repeat(24)}  `, mix, false, ids).ok).toBe(true);
    expect(saveUserPreset([], "   ", mix, false, ids)).toEqual({ ok: false, reason: "name-empty" });
  });
});

describe("isModified", () => {
  it("is false for the untouched mix", () => {
    expect(isModified(sleep, clone(sleep.mix), sleep.dim)).toBe(false);
  });

  it("is true after any saved field changes", () => {
    const edits: ((m: Mix) => void)[] = [
      (m) => (m.sounds.brown!.max = 0.1),
      (m) => (m.sounds.ocean!.lfo = 1),
      (m) => delete m.sounds.bubbles,
      (m) => (m.sounds.pink = { lfo: 0, min: 0.5, max: 0.5 }),
      (m) => (m.lfos[1]!.period = 30),
      (m) => (m.lfos[2]!.shape = "sine"),
      (m) => (m.tempo = 0.4),
      (m) => (m.metronome.level = 0.9),
      (m) => (m.metronome.voice = "metro-wood-block"),
    ];
    for (const edit of edits) {
      const m = clone(sleep.mix);
      edit(m);
      expect(isModified(sleep, m, sleep.dim)).toBe(true);
    }
    expect(isModified(sleep, clone(sleep.mix), !sleep.dim)).toBe(true);
  });

  it("is false after a master-volume change, which is not in the mix", () => {
    // Master lives in the store, outside Mix and Preset, so it cannot reach isModified.
    expect(Object.keys(sleep)).not.toContain("master");
    expect(Object.keys(sleep.mix)).not.toContain("master");
    const state = { mix: clone(sleep.mix), dim: sleep.dim, master: 0.7 };
    state.master = 0.2;
    expect(isModified(sleep, state.mix, state.dim)).toBe(false);
  });

  it("ignores key order", () => {
    const m = clone(sleep.mix);
    m.sounds = Object.fromEntries(Object.entries(m.sounds).reverse());
    expect(isModified(sleep, m, sleep.dim)).toBe(false);
  });
});

describe("applyEdit", () => {
  it("returns save-as-new for a built-in and leaves BUILT_INS untouched", () => {
    const before = JSON.stringify(BUILT_INS);
    const m = clone(sleep.mix);
    m.tempo = 0.9;
    const r = applyEdit(sleep, m, false);
    expect(r).toEqual({ kind: "save-as-new", mix: m, dim: false });
    expect(JSON.stringify(BUILT_INS)).toBe(before);
  });

  it("updates a user preset in place", () => {
    const user: Preset = { ...clone(sleep), id: "u", name: "U", builtIn: false };
    const m = clone(user.mix);
    m.tempo = 0.9;
    const r = applyEdit(user, m, true);
    expect(r.kind).toBe("updated");
    if (r.kind === "updated") {
      expect(r.preset.mix.tempo).toBe(0.9);
      expect(r.preset.dim).toBe(true);
      expect(r.preset.id).toBe("u");
    }
    expect(user.mix.tempo).toBe(0);
  });
});

describe("restoreLaunch", () => {
  it("returns Sleep on first launch with default master and no timer", () => {
    for (const stored of [null, undefined, "junk", { version: 9 }]) {
      const r = restoreLaunch(stored);
      expect(r.mix).toEqual(sleep.mix);
      expect(r.dim).toBe(true);
      expect(r.presetId).toBe("sleep");
      expect(r.welcomeSeen).toBe(false);
      expect(r.secondsMode).toBe(false);
      expect(r.master).toBe(DEFAULT_MASTER);
      expect(r.sleep).toBeNull();
    }
  });

  it("returns the stored mix later, with master and timer at defaults", () => {
    const mix = clone(sleep.mix);
    mix.tempo = 0.8;
    const stored = {
      version: 1,
      mix,
      dim: false,
      secondsMode: true,
      presetId: null,
      welcomeSeen: true,
      master: 0.1,
      sleep: { minutes: 5, endsAt: 99 },
    };
    const r = restoreLaunch(stored);
    expect(r.mix.tempo).toBe(0.8);
    expect(r.dim).toBe(false);
    expect(r.secondsMode).toBe(true);
    expect(r.welcomeSeen).toBe(true);
    expect(r.master).toBe(0.7);
    expect(r.sleep).toBeNull();
  });

  it("does not alias the built-in mix", () => {
    const r = restoreLaunch(null);
    expect(r.mix).not.toBe(sleep.mix);
    r.mix.tempo = 1;
    expect(sleep.mix.tempo).toBe(0);
  });
});

describe("built-in metronome levels", () => {
  it("Sleep and Reset sit exactly on the phase-changes-only detent, Focus is off", () => {
    const byId = Object.fromEntries(BUILT_INS.map((p) => [p.id, p]));
    expect(byId["sleep"]?.mix.metronome.level).toBe(0.2);
    expect(byId["reset"]?.mix.metronome.level).toBe(0.2);
    expect(byId["focus"]?.mix.metronome.level).toBe(0);
  });
});
