import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { minutesLeft, timerOptions } from "../audio/sleep";
import { useStore } from "../store";
import { colors } from "../theme.stylex";
import { canSleep, cancelTimer, checkTimer, clockNow, startTimer } from "./sleepControl";
import { Tip } from "./Tip";

const styles = stylex.create({
  section: { display: "flex", flexDirection: "column", gap: 12 },
  heading: { margin: 0, fontSize: 14, fontWeight: 700 },
  row: { display: "flex", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    paddingInline: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.accentSession,
    backgroundColor: "transparent",
    color: colors.tabInk,
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  on: { backgroundColor: colors.accentSession, color: colors.bg, fontWeight: 700 },
  note: { margin: 0, fontSize: 15, color: colors.textMuted },
  moon: {
    position: "fixed",
    zIndex: 12,
    insetInlineStart: "max(16px, env(safe-area-inset-left))",
    bottom: "max(16px, env(safe-area-inset-bottom))",
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    boxSizing: "border-box",
    paddingInline: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    pointerEvents: "none",
  },
  // Phones: the bottom sheet takes 60% of the height, so sit above it while it is open.
  moonAboveSheet: {
    bottom: {
      default: "max(16px, env(safe-area-inset-bottom))",
      "@media (max-width: 899px)": "calc(60dvh + 12px)",
    },
  },
  glyph: { width: 18, height: 18, flexShrink: 0, fill: colors.text },
});

/** The Session tab's timer block: 30, 60 and 90 minutes, Cancel, and the keep-awake note. */
export function SleepSection() {
  const sleep = useStore((s) => s.sleep);
  const audio = canSleep();
  return (
    <div {...stylex.props(styles.section)}>
      <h2 {...stylex.props(styles.heading)}>Sleep timer</h2>
      <Tip text="Sound fades to silence over the last 5 minutes, then the app returns to Begin.">
        <div role="group" aria-label="Sleep timer length" {...stylex.props(styles.row)}>
          {timerOptions(import.meta.env.DEV).map((m) => (
            <button
              key={m}
              type="button"
              disabled={!audio}
              aria-pressed={sleep?.minutes === m}
              data-dev-timer={import.meta.env.DEV && m === 2 ? "breather-dev-timer" : undefined}
              {...stylex.props(styles.button, sleep?.minutes === m && styles.on)}
              onClick={() => startTimer(m)}
            >
              {m} min
            </button>
          ))}
          {sleep && (
            <button type="button" {...stylex.props(styles.button)} onClick={cancelTimer}>
              Cancel timer
            </button>
          )}
        </div>
      </Tip>
      <p {...stylex.props(styles.note)}>
        {audio
          ? "Keep the screen on so the timer can finish."
          : "Press Begin to start sound before setting a timer."}
      </p>
    </div>
  );
}

const readMinutes = (endsAt: number | undefined) =>
  endsAt === undefined ? 0 : minutesLeft(endsAt, clockNow());

/** The corner moon: shows minutes left, only while a timer runs. Also ends the timer when due. */
export function Moon() {
  const endsAt = useStore((s) => s.sleep?.endsAt);
  const open = useStore((s) => s.sheet.open);
  const [minutes, setMinutes] = useState(() => readMinutes(endsAt));

  useEffect(() => {
    if (endsAt === undefined) return;
    // The label comes from the audio clock; this timer only repaints it and checks for the end.
    const tick = () => {
      if (!checkTimer()) setMinutes(readMinutes(endsAt));
    };
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endsAt]);

  if (endsAt === undefined) return null;
  return (
    <div
      role="group"
      aria-label="Sleep timer"
      {...stylex.props(styles.moon, open && styles.moonAboveSheet)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stylex.props(styles.glyph)}>
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
      </svg>
      <span>{minutes} min</span>
    </div>
  );
}
