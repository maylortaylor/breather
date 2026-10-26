import * as stylex from "@stylexjs/stylex";

// Every colour in the app lives here, as six-digit hex. src/theme.test.ts parses this file and
// asserts the contrast tables in docs/adr/0004-ui-layout-and-visual-style.md, so keep each value
// a plain "#rrggbb" string on one line.

export const colors = stylex.defineVars({
  // Grounds.
  bg: "#0b1020",
  surface: "#131a33",
  // Text. No alpha, ever: a lower alpha is a lower contrast, not a softer colour.
  text: "#e8ecf8",
  textMuted: "#c0cae6",
  tabInk: "#f3f5fc",
  // Slider thumbs and other non-text marks.
  thumb: "#f3f5fc",
  // Tab fields, deep.
  tabBreath: "#2b2f7a",
  tabSounds: "#1f5a3e",
  tabSession: "#5a2a6a",
  // Tab accents: each tab's hue lifted to mark the active tab on any tab field.
  accentBreath: "#a3abff",
  accentSounds: "#86dba9",
  accentSession: "#dba2f2",
  // LFO colours, deepened. Never shared with a tab colour.
  lfoTeal: "#2fa8a0",
  lfoViolet: "#8e6be0",
  lfoAmber: "#d9962b",
  // Aurora base hues. The dim theme halves each channel.
  auroraA: "#1c6b5a",
  auroraB: "#4a2f8f",
  auroraC: "#1f4f8f",
});

// Night setting: warm, dim text, nothing blue-tinted, aurora about 50% darker.
export const dimTheme = stylex.createTheme(colors, {
  bg: "#0c0a09",
  surface: "#15110f",
  text: "#d9c6a8",
  textMuted: "#b3a38a",
  tabInk: "#e6d5b8",
  thumb: "#e6d5b8",
  tabBreath: "#1d2052",
  tabSounds: "#153d29",
  tabSession: "#3d1c48",
  accentBreath: "#8a8cc4",
  accentSounds: "#6db58a",
  accentSession: "#b585c8",
  lfoTeal: "#238079",
  lfoViolet: "#7a5cb8",
  lfoAmber: "#a87420",
  auroraA: "#0e352d",
  auroraB: "#251848",
  auroraC: "#102848",
});
