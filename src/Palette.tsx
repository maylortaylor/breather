import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { colors, dimTheme } from "./theme.stylex";

// Temporary colour preview so the palette and dim theme can be judged by eye. The controls sheet
// (ticket 20) and the Begin screen (ticket 18) replace it.
const styles = stylex.create({
  page: {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: 24,
    backgroundColor: colors.bg,
    color: colors.text,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  toggle: {
    alignSelf: "flex-start",
    padding: "10px 18px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.thumb,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 16,
  },
  tabs: { display: "flex", flexWrap: "wrap", gap: 12 },
  tab: {
    flex: "1 1 160px",
    padding: 16,
    borderRadius: 16,
    color: colors.tabInk,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  breath: { backgroundColor: colors.tabBreath },
  sounds: { backgroundColor: colors.tabSounds },
  session: { backgroundColor: colors.tabSession },
  muted: { color: colors.textMuted },
  mark: { height: 6, borderRadius: 3 },
  accentBreath: { backgroundColor: colors.accentBreath },
  accentSounds: { backgroundColor: colors.accentSounds },
  accentSession: { backgroundColor: colors.accentSession },
  sheet: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  dot: { width: 28, height: 28, borderRadius: "50%" },
  teal: { backgroundColor: colors.lfoTeal },
  violet: { backgroundColor: colors.lfoViolet },
  amber: { backgroundColor: colors.lfoAmber },
  thumb: { width: 22, height: 22, borderRadius: "50%", backgroundColor: colors.thumb },
  aurora: { display: "flex", height: 48, borderRadius: 16, overflow: "hidden" },
  a: { flex: 1, backgroundColor: colors.auroraA },
  b: { flex: 1, backgroundColor: colors.auroraB },
  c: { flex: 1, backgroundColor: colors.auroraC },
});

const TABS = [
  ["Breath", styles.breath, styles.accentBreath],
  ["Sounds", styles.sounds, styles.accentSounds],
  ["Session", styles.session, styles.accentSession],
] as const;

export function Palette() {
  const [dim, setDim] = useState(false);
  return (
    <div {...stylex.props(styles.page, dim && dimTheme)}>
      <h1>Breather palette</h1>
      <button type="button" {...stylex.props(styles.toggle)} onClick={() => setDim(!dim)}>
        {dim ? "Dim theme on" : "Dim theme off"}
      </button>
      <div {...stylex.props(styles.tabs)}>
        {TABS.map(([name, field, accent]) => (
          <div key={name} {...stylex.props(styles.tab, field)}>
            <strong>{name}</strong>
            <span {...stylex.props(styles.muted)}>Calm, deep and readable</span>
            <div {...stylex.props(styles.mark, accent)} />
          </div>
        ))}
      </div>
      <div {...stylex.props(styles.sheet)}>
        <span {...stylex.props(styles.muted)}>LFO</span>
        <div {...stylex.props(styles.dot, styles.teal)} />
        <div {...stylex.props(styles.dot, styles.violet)} />
        <div {...stylex.props(styles.dot, styles.amber)} />
        <span {...stylex.props(styles.muted)}>Thumb</span>
        <div {...stylex.props(styles.thumb)} />
      </div>
      <div {...stylex.props(styles.aurora)}>
        <div {...stylex.props(styles.a)} />
        <div {...stylex.props(styles.b)} />
        <div {...stylex.props(styles.c)} />
      </div>
    </div>
  );
}
