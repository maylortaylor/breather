import * as stylex from "@stylexjs/stylex";
import { beginAudio } from "../audio/session";
import { restoreLaunch, type LaunchState } from "../presets";
import { loadState, store, useStore, type AudioStatus } from "../store";
import { colors } from "../theme.stylex";

export const SAFETY_LINE =
  "Stop if you feel lightheaded. Not for use while driving or in water. Not medical advice.";
export const STORAGE_LINE = "Your mix stays on this device. No cookies, no tracking.";

const styles = stylex.create({
  screen: {
    minHeight: "100vh",
    boxSizing: "border-box",
    // Cancels the shell padding so the screen fills the window.
    margin: -24,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    textAlign: "center",
    color: colors.text,
  },
  card: {
    maxWidth: 440,
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.surface,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    textAlign: "start",
  },
  line: { margin: 0 },
  title: { margin: 0, fontSize: 32 },
  steps: { margin: 0, paddingInlineStart: 22, display: "flex", flexDirection: "column", gap: 8 },
  muted: { margin: 0, color: colors.textMuted, fontSize: 15, lineHeight: 1.5 },
  button: {
    padding: "14px 40px",
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.thumb,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 20,
    cursor: "pointer",
  },
  // The safety line comes first in the DOM so a screen reader meets it before the button; this
  // puts it beneath the button on screen.
  below: { order: 2, maxWidth: 360 },
  beginGroup: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  note: { margin: 0, color: colors.textMuted },
});

/** What Begin starts: the stored mix, or Sleep on first launch. */
function launchState(): LaunchState {
  const saved = loadState();
  // "Got it" saves welcomeSeen alone; only a saved preset id means a mix was chosen before.
  return restoreLaunch(saved.presetId === undefined ? null : { version: 1, ...saved });
}

export type BeginFn = (launch: LaunchState, onStatus: (s: AudioStatus) => void) => unknown;

function Welcome() {
  const gotIt = () => store.set({ welcomeSeen: true, screen: "begin" });
  return (
    <div {...stylex.props(styles.screen)}>
      <section aria-labelledby="welcome-title" {...stylex.props(styles.card)}>
        <h1 id="welcome-title" {...stylex.props(styles.title)}>
          Breather
        </h1>
        <p {...stylex.props(styles.line)}>Slow sound and a guided 4-7-8 breath to wind down.</p>
        <ol {...stylex.props(styles.steps)}>
          <li>Tap Begin to start the sound.</li>
          <li>Follow the ring: breathe in for 4, hold for 7, out for 8.</li>
          <li>Tap the Settings button for sounds, tempo and presets.</li>
        </ol>
        <p {...stylex.props(styles.muted)}>{SAFETY_LINE}</p>
        <p {...stylex.props(styles.muted)}>{STORAGE_LINE}</p>
        <button type="button" {...stylex.props(styles.button)} onClick={gotIt}>
          Got it
        </button>
      </section>
    </div>
  );
}

function BeginScreen({ begin }: { begin: BeginFn }) {
  const onBegin = () => {
    // The audio context must be made and resumed inside this tap.
    const launch = launchState();
    begin(launch, (audio) => store.set({ audio }));
    store.set({ screen: "resting", mix: launch.mix });
  };
  return (
    <div {...stylex.props(styles.screen)}>
      <div {...stylex.props(styles.beginGroup)}>
        <p {...stylex.props(styles.muted, styles.below)}>{SAFETY_LINE}</p>
        <button type="button" {...stylex.props(styles.button)} onClick={onBegin}>
          Begin
        </button>
      </div>
    </div>
  );
}

/** First launch: the welcome card. Every launch after: Begin. Gone once the app is resting. */
export function Gate({ begin = beginAudio }: { begin?: BeginFn }) {
  const screen = useStore((s) => s.screen);
  const seen = useStore((s) => s.welcomeSeen);
  if (screen === "resting") return null;
  return seen ? <BeginScreen begin={begin} /> : <Welcome />;
}

export function SoundNote() {
  const audio = useStore((s) => s.audio);
  if (audio !== "unsupported") return null;
  return (
    <p role="status" {...stylex.props(styles.note)}>
      Sound is not available on this device.
    </p>
  );
}
