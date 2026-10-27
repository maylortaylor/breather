import * as stylex from "@stylexjs/stylex";
import { resumeAudio } from "../audio/session";
import { useStore } from "../store";
import { colors } from "../theme.stylex";

export const RESUME_LABEL = "Sound paused. Tap to resume.";

const styles = stylex.create({
  button: {
    position: "fixed",
    insetInline: 0,
    marginInline: "auto",
    top: 24,
    width: "fit-content",
    padding: "12px 28px",
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.thumb,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 18,
    cursor: "pointer",
  },
});

/** Shown when the context is suspended or interrupted; a tap resumes the sound. */
export function Resume() {
  const needsTap = useStore((s) => s.audio === "needs-tap");
  if (!needsTap) return null;
  return (
    <button type="button" {...stylex.props(styles.button)} onClick={() => void resumeAudio()}>
      {RESUME_LABEL}
    </button>
  );
}
