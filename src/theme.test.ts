import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditPalette,
  contrastRatio,
  findTextAlpha,
  parseThemeSource,
  TEXT_TOKENS,
  type Palette,
} from "./contrast";

const src = join(import.meta.dirname);
const themeSource = readFileSync(join(src, "theme.stylex.ts"), "utf8");
const { night, dim } = parseThemeSource(themeSource);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });
});

describe("theme.stylex.ts", () => {
  it("defines the same tokens in both themes", () => {
    expect(Object.keys(dim).sort()).toEqual(Object.keys(night).sort());
    expect(Object.keys(night).length).toBeGreaterThan(15);
  });

  it("holds only six-digit hex, so no text colour can carry alpha", () => {
    for (const [name, value] of [...Object.entries(night), ...Object.entries(dim)]) {
      expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each([
    ["night", night],
    ["dim", dim],
  ] as const)("passes all three contrast tables in the %s theme", (_name, palette) => {
    expect(auditPalette(palette)).toEqual([]);
  });

  it("keeps LFO colours and tab colours distinct in both themes and across them", () => {
    const tabs = (p: Palette) =>
      Object.entries(p)
        .filter(([k]) => /^(tab(Breath|Sounds|Session)|accent)/.test(k))
        .map(([, v]) => v.toLowerCase());
    const lfos = (p: Palette) =>
      Object.entries(p)
        .filter(([k]) => k.startsWith("lfo"))
        .map(([, v]) => v.toLowerCase());
    const allTabs = new Set([...tabs(night), ...tabs(dim)]);
    for (const lfo of [...lfos(night), ...lfos(dim)]) expect(allTabs.has(lfo)).toBe(false);
    expect(new Set(lfos(night)).size).toBe(3);
    expect(tabs(night).length).toBe(6);
  });

  it("makes the dim theme warm and dim: no blue-tinted text, aurora about half as bright", () => {
    for (const token of TEXT_TOKENS) {
      const n = parseInt(dim[token]!.slice(1), 16);
      const [r, b] = [n >> 16, n & 255];
      expect(r, `${token} red vs blue`).toBeGreaterThan(b);
      expect(contrastRatio(dim[token]!, dim.bg!), token).toBeLessThan(
        contrastRatio(night[token]!, night.bg!)
      );
    }
    for (const token of ["auroraA", "auroraB", "auroraC"]) {
      const full = night[token]!;
      const half = dim[token]!;
      for (const shift of [16, 8, 0]) {
        const ratio =
          ((parseInt(half.slice(1), 16) >> shift) & 255) /
          ((parseInt(full.slice(1), 16) >> shift) & 255);
        expect(ratio, `${token} channel at ${shift}`).toBeGreaterThan(0.4);
        expect(ratio, `${token} channel at ${shift}`).toBeLessThan(0.6);
      }
    }
  });

  it("fails when one text colour drops below AA", () => {
    const weak = { ...night, textMuted: "#4a5578" };
    const failures = auditPalette(weak);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((f) => f.includes("textMuted"))).toBe(true);
  });

  it("fails when the slider thumb drops below 3:1", () => {
    const failures = auditPalette({ ...night, thumb: "#1a2547" });
    expect(failures.some((f) => f.includes("thumb"))).toBe(true);
  });

  it("fails when a tab accent sinks into another tab field", () => {
    const failures = auditPalette({ ...night, accentSounds: "#2a6a4a" });
    expect(failures.some((f) => f.includes("accentSounds"))).toBe(true);
  });

  it("fails when an LFO colour matches a tab colour", () => {
    const failures = auditPalette({ ...night, lfoTeal: night.tabSounds! });
    expect(failures.some((f) => f.includes("lfoTeal"))).toBe(true);
  });
});

describe("findTextAlpha", () => {
  it("flags alpha colours and opacity beside a text colour", () => {
    expect(findTextAlpha(`const s = { label: { color: "rgba(255,255,255,0.8)" } };`)).toHaveLength(
      1
    );
    expect(findTextAlpha(`const s = { label: { color: "#ffffff80" } };`)).toHaveLength(1);
    expect(findTextAlpha(`const s = { label: { color: "hsl(0 0% 100% / 50%)" } };`)).toHaveLength(
      1
    );
    expect(findTextAlpha(`const s = { label: { color: white, opacity: 0.7 } };`)).toHaveLength(1);
    expect(findTextAlpha(`.a { color: #fff; opacity: .5; }`)).toHaveLength(1);
  });

  it("allows opacity and alpha that do not touch text", () => {
    expect(
      findTextAlpha(`const s = { band: { opacity: 0.28, backgroundColor: "#fff" } };`)
    ).toEqual([]);
    expect(findTextAlpha(`const s = { a: { color: "#e8ecf8", fontSize: 14 } };`)).toEqual([]);
    expect(findTextAlpha(`const s = { a: { boxShadow: "0 0 0 2px rgba(0,0,0,0.4)" } };`)).toEqual(
      []
    );
  });
});

describe("source tree", () => {
  const files = walk(src).filter((f) => /\.(tsx|css)$/.test(f) && !f.endsWith(".test.tsx"));

  it("finds the files it is meant to scan", () => {
    expect(files.some((f) => f.endsWith("App.tsx"))).toBe(true);
    expect(files.some((f) => f.endsWith("index.css"))).toBe(true);
  });

  it("has no alpha or opacity on text in any .tsx or .css file", () => {
    const hits = files.flatMap((f) =>
      findTextAlpha(readFileSync(f, "utf8")).map((h) => `${f.slice(src.length + 1)}: ${h}`)
    );
    expect(hits).toEqual([]);
  });
});
