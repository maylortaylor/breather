// WCAG contrast maths and the checks behind src/theme.test.ts. Pure, so the test can break a
// palette on purpose and watch the audit fail.

export type Palette = Record<string, string>;

export const TEXT_TOKENS = ["text", "textMuted", "tabInk"] as const;
export const TAB_FIELDS = ["tabBreath", "tabSounds", "tabSession"] as const;
export const TAB_ACCENTS = ["accentBreath", "accentSounds", "accentSession"] as const;
export const LFO_COLORS = ["lfoTeal", "lfoViolet", "lfoAmber"] as const;

const BODY = 4.5;
const LARGE = 3;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Reads the `defineVars` and `createTheme` object literals out of theme.stylex.ts. StyleX does not
// run under Vitest, so the test parses the text instead of importing the module.
export function parseThemeSource(source: string): { night: Palette; dim: Palette } {
  const block = (marker: string): Palette => {
    const start = source.indexOf(marker);
    if (start === -1) throw new Error(`theme.stylex.ts: ${marker} not found`);
    const open = source.indexOf("{", start);
    const close = source.indexOf("});", open);
    const palette: Palette = {};
    for (const m of source.slice(open, close).matchAll(/^\s*(\w+):\s*"([^"]+)",?\s*$/gm)) {
      palette[m[1]!] = m[2]!;
    }
    if (Object.keys(palette).length === 0) throw new Error(`theme.stylex.ts: ${marker} is empty`);
    return palette;
  };
  return { night: block("defineVars("), dim: block("createTheme(") };
}

// The three tables from docs/DESIGN-ETHOS.md in roboborealis-platform, plus the LFO rule.
export function auditPalette(p: Palette): string[] {
  const failures: string[] = [];
  const get = (name: string): string => {
    const v = p[name];
    if (v === undefined || !/^#[0-9a-f]{6}$/i.test(v)) {
      failures.push(`${name} is missing or not a six-digit hex colour`);
      return "#000000";
    }
    return v;
  };
  const need = (fg: string, bg: string, min: number, table: string) => {
    const ratio = contrastRatio(get(fg), get(bg));
    if (ratio < min) {
      failures.push(`${table}: ${fg} on ${bg} is ${ratio.toFixed(2)}, needs ${min}`);
    }
  };

  // Table 1: text on the grounds.
  for (const t of ["text", "textMuted"]) {
    for (const g of ["bg", "surface"]) need(t, g, BODY, "text on ground");
  }
  // Table 2: text on each tab field.
  for (const t of ["tabInk", "textMuted"]) {
    for (const f of TAB_FIELDS) need(t, f, BODY, "text on tab");
  }
  // Table 3: tab colour on tab colour. Each accent marks its tab over every tab field.
  for (const a of TAB_ACCENTS) {
    for (const f of TAB_FIELDS) need(a, f, LARGE, "tab on tab");
    need(a, "bg", LARGE, "tab on tab");
  }
  // Non-text marks: slider thumbs and LFO buttons.
  for (const g of ["surface", ...TAB_FIELDS]) need("thumb", g, LARGE, "thumb");
  for (const c of LFO_COLORS) need(c, "surface", LARGE, "lfo on surface");

  const tabValues = new Set([...TAB_FIELDS, ...TAB_ACCENTS].map((k) => get(k).toLowerCase()));
  for (const c of LFO_COLORS) {
    if (tabValues.has(get(c).toLowerCase())) failures.push(`${c} shares a value with a tab colour`);
  }
  return failures;
}

// Alpha on text is a lower contrast, not a softer colour. A style block that sets `color` may not
// use an alpha colour or `opacity`. Works on innermost `{ ... }` groups, so it covers StyleX
// objects, inline style objects and plain CSS rules.
export function findTextAlpha(source: string): string[] {
  const hits: string[] = [];
  const alphaColor =
    /(?:^|[\s{,;])color\s*:\s*["']?(?:rgba?\(|hsla?\(|color-mix\(|#[0-9a-f]{4}\b|#[0-9a-f]{8}\b)/i;
  const textColor = /(?:^|[\s{,;])color\s*:/i;
  const opacity = /(?:^|[\s{,;])opacity\s*:/i;
  for (const m of source.matchAll(/\{([^{}]*)\}/g)) {
    const body = m[1]!;
    if (!textColor.test(body)) continue;
    if (alphaColor.test(body)) hits.push(`alpha text colour in ${body.trim().slice(0, 60)}`);
    else if (opacity.test(body))
      hits.push(`opacity beside text colour in ${body.trim().slice(0, 60)}`);
  }
  return hits;
}
