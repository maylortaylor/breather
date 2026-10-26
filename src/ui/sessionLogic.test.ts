import { describe, expect, it } from "vitest";
import { BUILT_INS, MAX_USER_PRESETS, type Preset } from "../presets";
import {
  allPresets,
  findPreset,
  messageFor,
  offerSave,
  planSwitch,
  removePreset,
  renamePreset,
  SWITCH_FADE_SEC,
  updatePreset,
} from "./sessionLogic";

const sleep = BUILT_INS[0]!;
const mk = (id: string, name = id): Preset => ({ ...sleep, id, name, builtIn: false });

describe("allPresets and findPreset", () => {
  it("lists Sleep, Focus and Reset, then user presets", () => {
    const list = allPresets([mk("a", "Mine")]);
    expect(list.map((p) => p.name)).toEqual(["Sleep", "Focus", "Reset", "Mine"]);
  });

  it("finds by id and returns null for an unknown or missing id", () => {
    expect(findPreset([mk("a")], "focus")?.name).toBe("Focus");
    expect(findPreset([mk("a")], "a")?.id).toBe("a");
    expect(findPreset([], "gone")).toBeNull();
    expect(findPreset([], null)).toBeNull();
  });
});

describe("planSwitch", () => {
  const focus = BUILT_INS[1]!;

  it("crossfades over 3 s and carries the mix, dim and the preset id", () => {
    const plan = planSwitch(focus);
    expect(SWITCH_FADE_SEC).toBe(3);
    expect(plan.fadeSec).toBe(3);
    expect(plan.presetId).toBe("focus");
    expect(plan.dim).toBe(false);
    expect(plan.mix).toEqual(focus.mix);
  });

  it("carries tempo, metronome and dim from the preset", () => {
    const plan = planSwitch(sleep);
    expect(plan.dim).toBe(true);
    expect(plan.mix.tempo).toBe(0);
    expect(plan.mix.metronome).toEqual(sleep.mix.metronome);
  });

  it("never carries a master volume", () => {
    expect(Object.keys(planSwitch(focus)).sort()).toEqual(["dim", "fadeSec", "mix", "presetId"]);
    expect(JSON.stringify(planSwitch(focus))).not.toMatch(/master/i);
  });

  it("hands out a copy, so editing the live mix cannot change the preset", () => {
    const plan = planSwitch(focus);
    expect(plan.mix).not.toBe(focus.mix);
    plan.mix.tempo = 0.9;
    expect(focus.mix.tempo).toBe(0.5);
  });
});

describe("offerSave", () => {
  it("offers nothing while the mix equals its preset", () => {
    expect(offerSave(sleep, sleep.mix, sleep.dim)).toBeNull();
  });

  it("offers Save as new alone for a modified built-in", () => {
    expect(offerSave(sleep, { ...sleep.mix, tempo: 0.3 }, sleep.dim)).toBe("save-as-new");
    expect(offerSave(sleep, sleep.mix, !sleep.dim)).toBe("save-as-new");
  });

  it("offers Update beside Save as new for a modified user preset", () => {
    const p = mk("a");
    expect(offerSave(p, { ...p.mix, tempo: 0.3 }, p.dim)).toBe("update-or-save");
  });

  it("offers Save as new when no preset is active", () => {
    expect(offerSave(null, sleep.mix, true)).toBe("save-as-new");
  });
});

describe("renamePreset", () => {
  const list = [mk("a", "One"), mk("b", "Two")];

  it("renames one preset and trims the name", () => {
    const r = renamePreset(list, "b", "  Evening  ");
    expect(r.ok && r.presets.map((p) => p.name)).toEqual(["One", "Evening"]);
  });

  it("refuses an empty name and one over 24 characters", () => {
    expect(renamePreset(list, "a", "   ")).toEqual({ ok: false, reason: "name-empty" });
    expect(renamePreset(list, "a", "x".repeat(25))).toEqual({
      ok: false,
      reason: "name-too-long",
    });
    expect(renamePreset(list, "a", "x".repeat(24)).ok).toBe(true);
  });

  it("leaves the list alone for an unknown id", () => {
    expect(renamePreset(list, "zzz", "Name")).toEqual({ ok: false, reason: "missing" });
  });
});

describe("removePreset and updatePreset", () => {
  it("removes by id", () => {
    expect(removePreset([mk("a"), mk("b")], "a").map((p) => p.id)).toEqual(["b"]);
  });

  it("replaces a preset's mix and dim in place, keeping order and name", () => {
    const list = [mk("a", "One"), mk("b", "Two")];
    const out = updatePreset(list, "b", { ...sleep.mix, tempo: 0.8 }, false);
    expect(out.map((p) => p.name)).toEqual(["One", "Two"]);
    expect(out[1]!.mix.tempo).toBe(0.8);
    expect(out[1]!.dim).toBe(false);
    expect(list[1]!.mix.tempo).toBe(0);
  });
});

describe("messageFor", () => {
  it("gives a calm line for every refusal", () => {
    expect(messageFor("name-empty")).toBe("Give it a name first.");
    expect(messageFor("name-too-long")).toBe("Keep the name to 24 characters or fewer.");
    expect(messageFor("limit")).toBe(
      `You have ${MAX_USER_PRESETS} saved presets. Delete one to save another.`
    );
    expect(messageFor("missing")).toBe("That preset is gone.");
  });
});
