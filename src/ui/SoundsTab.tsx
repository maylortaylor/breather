import * as stylex from "@stylexjs/stylex";
import { DEFAULT_LAYER } from "../audio/engine";
import { createModulator, type Modulator } from "../audio/modulation";
import { getSession } from "../audio/session";
import type { LoopId, Mix } from "../presets";
import { store, useStore } from "../store";
import { colors } from "../theme.stylex";
import { LfoPanel } from "./LfoPanel";
import { RowVolume, Slider } from "./Slider";
import { chipGroups, playingIds, setLfo, setSound, toggleSound, volumeText } from "./soundsLogic";
import { Tip } from "./Tip";

/** Seconds a tap on a chip or a button takes to land. Slider drags glide a touch shorter. */
const ADD_FADE_SEC = 1.5;
const EDIT_FADE_SEC = 0.1;

const LFO_COLORS = [colors.lfoTeal, colors.lfoViolet, colors.lfoAmber];
const GROUPS = chipGroups();
const LABELS = new Map(GROUPS.flatMap((g) => g.chips.map((c) => [c.id, c.label] as const)));

const styles = stylex.create({
  tab: { display: "flex", flexDirection: "column", gap: 16 },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    margin: 0,
    padding: 0,
    borderWidth: 0,
  },
  legend: { padding: 0, marginBottom: 8, fontSize: 14, color: colors.tabInk, fontWeight: 700 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingInline: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.accentSounds,
    backgroundColor: "transparent",
    color: colors.tabInk,
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  chipOn: { backgroundColor: colors.accentSounds, color: colors.bg, fontWeight: 700 },
  rows: { display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0 },
  row: {
    listStyle: "none",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px 12px",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  name: { flexBasis: "100%", fontSize: 15, color: colors.text },
});

// With no audio session (sound unavailable) the rows still work against a standalone modulator.
let standalone: Modulator | null = null;
function modulatorFor(mix: Mix): Modulator {
  const live = getSession()?.modulator;
  if (live) return live;
  standalone ??= createModulator(() => DEFAULT_LAYER);
  for (const id of playingIds(mix)) standalone.setRow(id, { ...mix.sounds[id]! });
  return standalone;
}

/** One change path: the store holds the mix, the mixer makes the running audio match it. */
function commit(mix: Mix, fadeSec: number) {
  store.set({ mix });
  getSession()?.mixer.apply(mix, { fadeSec });
}

/** The Sounds tab: master volume, a chip for each loop, and a row for each sound that is playing. */
export function SoundsTab() {
  const master = useStore((s) => s.master);
  const mix = useStore((s) => s.mix);
  const presetId = useStore((s) => s.presetId);
  const modulator = modulatorFor(mix);

  const changeMaster = (value: number) => {
    // Master is session-only: it lives in the store and the engine, never in storage.
    store.set({ master: value });
    getSession()?.mixer.setMaster(value);
  };

  const tap = (id: LoopId) => commit(toggleSound(store.get().mix, id), ADD_FADE_SEC);

  // RowVolume has already written the row to the modulator; copy it into the mix.
  const rowChanged = (id: LoopId) => {
    const row = modulator.rowOf(id);
    commit(setSound(store.get().mix, id, row), EDIT_FADE_SEC);
  };

  const lfoChanged = (index: 0 | 1 | 2, patch: Parameters<typeof setLfo>[2]) => {
    const next = setLfo(store.get().mix, index, patch);
    // The mixer pushes periods and shapes to the running bank; a standalone modulator is set here.
    const lfo = next.lfos[index];
    modulator.setPeriod(index, lfo.period);
    modulator.setShape(index, lfo.shape);
    commit(next, EDIT_FADE_SEC);
  };

  const rows = playingIds(mix);
  return (
    <div {...stylex.props(styles.tab)}>
      <Slider
        label="Master"
        value={master}
        onChange={changeMaster}
        valueText={volumeText(master)}
        tip="How loud everything is. It resets to a gentle default each time you open the app."
      />
      {GROUPS.map(({ group, chips }) => (
        <fieldset key={group} {...stylex.props(styles.group)}>
          <legend {...stylex.props(styles.legend)}>{group}</legend>
          <div {...stylex.props(styles.chips)}>
            {chips.map(({ id, label }) => {
              const on = mix.sounds[id] !== undefined;
              return (
                <Tip key={id} text={on ? `Tap to fade out ${label}.` : `Tap to add ${label}.`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    {...stylex.props(styles.chip, on && styles.chipOn)}
                    onClick={() => tap(id)}
                  >
                    {label}
                  </button>
                </Tip>
              );
            })}
          </div>
        </fieldset>
      ))}
      {rows.length > 0 && (
        <ul aria-label="Playing sounds" {...stylex.props(styles.rows)}>
          {rows.map((id) => (
            <li key={`${id}:${presetId}`} {...stylex.props(styles.row)}>
              <span {...stylex.props(styles.name)}>{LABELS.get(id)}</span>
              <RowVolume
                id={id}
                name={LABELS.get(id) ?? id}
                withLfo
                modulator={modulator}
                lfoColors={LFO_COLORS}
                digitInk={colors.text}
                onVolume={() => {}}
                onChange={() => rowChanged(id)}
              />
            </li>
          ))}
        </ul>
      )}
      <LfoPanel modulator={modulator} lfos={mix.lfos} onChange={lfoChanged} />
    </div>
  );
}
