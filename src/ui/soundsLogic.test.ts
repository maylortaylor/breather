import { describe, expect, it } from "vitest";
import { DEFAULT_LAYER } from "../audio/engine";
import { BUILT_INS, type Mix } from "../presets";
import {
  CLIP_SAFE_RMS_DB,
  chipGroups,
  mixRmsDb,
  persistableMix,
  playingIds,
  setSound,
  toggleSound,
} from "./soundsLogic";

const base: Mix = { ...BUILT_INS[0]!.mix, sounds: {} };

describe("chipGroups", () => {
  it("lists the 9 loops as Noise, Nature, Music in catalog order", () => {
    const groups = chipGroups().map((g) => [g.group, g.chips.map((c) => c.id)]);
    expect(groups).toEqual([
      ["Noise", ["white", "pink", "brown"]],
      ["Nature", ["ocean", "bubbles", "whale-b"]],
      ["Music", ["pad-dreamy", "pad-tonal", "pad-deep"]],
    ]);
  });

  it("gives every chip a readable label", () => {
    const labels = chipGroups().flatMap((g) => g.chips.map((c) => c.label));
    expect(labels).toHaveLength(9);
    expect(labels).toContain("Brown noise");
    expect(labels).toContain("Ocean waves");
  });
});

describe("toggleSound", () => {
  it("adds a steady sound at the default level", () => {
    const next = toggleSound(base, "brown");
    expect(next.sounds.brown).toEqual({ lfo: 0, min: DEFAULT_LAYER, max: DEFAULT_LAYER });
  });

  it("removes a sound that is already on, and leaves the others alone", () => {
    const two = toggleSound(toggleSound(base, "brown"), "pad-deep");
    const next = toggleSound(two, "brown");
    expect(Object.keys(next.sounds)).toEqual(["pad-deep"]);
  });

  it("never mutates the mix it was given", () => {
    const frozen = Object.freeze({ ...base, sounds: Object.freeze({}) }) as Mix;
    expect(() => toggleSound(frozen, "pink")).not.toThrow();
    expect(frozen.sounds).toEqual({});
  });

  it("lets any combination of the 3 pads play together", () => {
    let mix = base;
    for (const id of ["pad-dreamy", "pad-tonal", "pad-deep"] as const) mix = toggleSound(mix, id);
    expect(playingIds(mix)).toEqual(["pad-dreamy", "pad-tonal", "pad-deep"]);
    mix = toggleSound(mix, "pad-tonal");
    expect(playingIds(mix)).toEqual(["pad-dreamy", "pad-deep"]);
  });
});

describe("playingIds", () => {
  it("follows catalog order whatever order sounds were added in", () => {
    let mix = base;
    for (const id of ["pad-deep", "white", "ocean"] as const) mix = toggleSound(mix, id);
    expect(playingIds(mix)).toEqual(["white", "ocean", "pad-deep"]);
  });
});

describe("setSound", () => {
  it("replaces a playing sound's setting", () => {
    const mix = toggleSound(base, "ocean");
    const next = setSound(mix, "ocean", { lfo: 3, min: 0.1, max: 0.6 });
    expect(next.sounds.ocean).toEqual({ lfo: 3, min: 0.1, max: 0.6 });
  });

  it("keeps min at or under max and inside 0..1", () => {
    const mix = toggleSound(base, "ocean");
    expect(setSound(mix, "ocean", { lfo: 1, min: 0.9, max: 0.4 }).sounds.ocean).toEqual({
      lfo: 1,
      min: 0.4,
      max: 0.4,
    });
    expect(setSound(mix, "ocean", { lfo: 1, min: -1, max: 2 }).sounds.ocean).toEqual({
      lfo: 1,
      min: 0,
      max: 1,
    });
  });

  it("allows min 0 so an LFO reaches true silence", () => {
    const mix = toggleSound(base, "ocean");
    expect(setSound(mix, "ocean", { lfo: 2, min: 0, max: 0.5 }).sounds.ocean?.min).toBe(0);
  });

  it("ignores a sound that is not playing", () => {
    expect(setSound(base, "ocean", { lfo: 1, min: 0, max: 0.5 })).toBe(base);
  });
});

describe("mixRmsDb", () => {
  it("is silent for an empty mix", () => {
    expect(mixRmsDb({})).toBe(-Infinity);
  });

  it("reads -30 dBFS for one loop at the default level", () => {
    expect(mixRmsDb({ pink: { lfo: 0, min: 0.3, max: 0.3 } })).toBeCloseTo(-30, 5);
  });

  it("stays well clear of clipping with all 3 pads and 3 loops at default levels", () => {
    let mix = base;
    for (const id of [
      "pad-dreamy",
      "pad-tonal",
      "pad-deep",
      "brown",
      "ocean",
      "bubbles",
    ] as const) {
      mix = toggleSound(mix, id);
    }
    const db = mixRmsDb(mix.sounds);
    expect(db).toBeCloseTo(-30 + 10 * Math.log10(6), 5);
    expect(db).toBeLessThan(CLIP_SAFE_RMS_DB);
  });

  it("counts the loudest point of an LFO row", () => {
    const loud = mixRmsDb({ ocean: { lfo: 1, min: 0, max: 0.6 } });
    const steady = mixRmsDb({ ocean: { lfo: 0, min: 0.6, max: 0.6 } });
    expect(loud).toBeCloseTo(steady, 5);
  });
});

describe("persistableMix", () => {
  it("is undefined for the default mix, so a first launch keeps the Sleep defaults", () => {
    expect(persistableMix(structuredClone(BUILT_INS[0]!.mix))).toBeUndefined();
  });

  it("returns an edited mix", () => {
    const edited = toggleSound(structuredClone(BUILT_INS[0]!.mix), "white");
    expect(persistableMix(edited)).toBe(edited);
  });
});
