import * as stylex from "@stylexjs/stylex";
import { CATALOG, ONE_SHOT_LAYER, trimOf } from "../audio/catalog";
import type { Engine } from "../audio/engine";
import { getSession } from "../audio/session";
import { D1, D2 } from "../breath/tempo";
import type { Mix, VoiceId } from "../presets";
import { store, useStore } from "../store";
import { colors } from "../theme.stylex";
import {
  inhaleHint,
  longestOf,
  METRONOME_TEXTS,
  TEMPO_TEXTS,
  metronomeText,
  releaseTempo,
  settleMetronome,
  stepMetronome,
  stepTempo,
  tempoText,
  VOICES,
} from "./breathLogic";
import { Slider, type Detent } from "./Slider";
import { Tip } from "./Tip";

const PREVIEW_LAYER = "metro-preview";
// Matches the phase-tone gain at the lower metronome detents, so a preview is easy to hear.
const PREVIEW_GAIN = 0.6;

/** Plays one beat of a voice on its own layer, so the running beats keep their own levels. */
export function previewVoice(engine: Engine, voice: VoiceId): void {
  const entry = CATALOG.find((e) => e.id === voice);
  if (!entry || !("once" in entry)) return;
  engine.setLayer(PREVIEW_LAYER, ONE_SHOT_LAYER);
  engine.setTrim(PREVIEW_LAYER, trimOf(voice) * PREVIEW_GAIN);
  entry.once(engine, engine.ctx.currentTime + 0.02, PREVIEW_LAYER);
}

const TEMPO_DETENT: Detent = {
  marks: [{ at: 0.5 }],
  release: releaseTempo,
  step: stepTempo,
};

const METRONOME_DETENT: Detent = {
  // Ticks only: the live value above the track says where the slider is.
  marks: [{ at: 0 }, { at: D1 }, { at: D2 }],
  live: settleMetronome,
  step: stepMetronome,
};

// Every change goes through the store, so the running guide and beats pick it up live.
const setTempo = (tempo: number) => store.set((s) => ({ mix: { ...s.mix, tempo } }));
const setLevel = (level: number) =>
  store.set((s) => ({ mix: { ...s.mix, metronome: { ...s.mix.metronome, level } } }));
const setSecondsMode = (secondsMode: boolean) => store.set({ secondsMode });
const setVoice = (voice: Mix["metronome"]["voice"]) => {
  store.set((s) => ({ mix: { ...s.mix, metronome: { ...s.mix.metronome, voice } } }));
  const engine = getSession()?.engine;
  if (engine) previewVoice(engine, voice);
};

const styles = stylex.create({
  tab: { display: "flex", flexDirection: "column", gap: 16, color: colors.tabInk },
  hint: { margin: 0, fontSize: 15, color: colors.textMuted },
  voices: { margin: 0, padding: 0, borderWidth: 0, minWidth: 0 },
  legend: { padding: 0, marginBottom: 8, fontSize: 16 },
  list: { display: "flex", flexWrap: "wrap", gap: 8 },
  voice: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingInline: 14,
    boxSizing: "border-box",
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "transparent",
    backgroundColor: colors.surface,
    fontSize: 15,
    cursor: "pointer",
  },
  voiceOn: { borderColor: colors.accentBreath },
  radio: { margin: 0, accentColor: colors.thumb },
  switchRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    fontSize: 16,
    cursor: "pointer",
  },
  switch: { width: 20, height: 20, margin: 0, accentColor: colors.thumb },
});

/** The Breath tab: tempo, metronome level and the beat voice. */
export function BreathTab() {
  const tempo = useStore((s) => s.mix.tempo);
  const level = useStore((s) => s.mix.metronome.level);
  const voice = useStore((s) => s.mix.metronome.voice);
  const secondsMode = useStore((s) => s.secondsMode);
  return (
    <div {...stylex.props(styles.tab)}>
      <Slider
        label="Tempo"
        value={tempo}
        onChange={setTempo}
        detent={TEMPO_DETENT}
        ends={["Slow", "Fast"]}
        valueText={tempoText(tempo)}
        valueChars={longestOf(TEMPO_TEXTS)}
        disabled={secondsMode}
        tip={
          secondsMode
            ? "The tempo is off because seconds mode is on."
            : "How fast the breath cycle runs. The mark in the middle is the resting pace."
        }
      />
      <Tip text="Breathe a steady 4, 7 and 8 seconds, and tick once a second, whatever the tempo.">
        <label {...stylex.props(styles.switchRow)}>
          <input
            type="checkbox"
            role="switch"
            checked={secondsMode}
            {...stylex.props(styles.switch)}
            onChange={(ev) => setSecondsMode(ev.target.checked)}
          />
          Seconds mode
        </label>
      </Tip>
      <p {...stylex.props(styles.hint)}>{inhaleHint(tempo, secondsMode)}</p>
      <Slider
        label="Metronome"
        value={level}
        onChange={setLevel}
        detent={METRONOME_DETENT}
        ends={["Off", "Louder"]}
        valueText={metronomeText(level)}
        valueChars={longestOf(METRONOME_TEXTS)}
        tip="Off, then a tone on each phase change, then every beat very quietly, then louder."
      />
      <Tip text="The sound of each beat. Tap one to hear it." grow="fill">
        <fieldset {...stylex.props(styles.voices)}>
          <legend {...stylex.props(styles.legend)}>Beat sound</legend>
          <div {...stylex.props(styles.list)}>
            {VOICES.map((v) => (
              <label key={v.id} {...stylex.props(styles.voice, v.id === voice && styles.voiceOn)}>
                <input
                  type="radio"
                  name="beat-sound"
                  value={v.id}
                  checked={v.id === voice}
                  {...stylex.props(styles.radio)}
                  onChange={() => setVoice(v.id)}
                />
                {v.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Tip>
    </div>
  );
}
