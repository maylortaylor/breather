// Pure rules for the Sounds tab: chip grouping, adding and removing rows, the level estimate.
import { DEFAULT_LAYER } from "../audio/engine";
import { sliderToGain } from "../audio/dsp";
import { CATALOG } from "../audio/catalog";
import { LOOP_IDS, type LoopId, type Mix, type SoundSetting } from "../presets";

export interface Chip {
  id: LoopId;
  label: string;
}

const GROUP_ORDER = ["Noise", "Nature", "Music"] as const;

/** The 9 loops as chips, grouped Noise, Nature, Music, in catalog order. */
export function chipGroups(): { group: string; chips: Chip[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    chips: CATALOG.flatMap((e) =>
      "loop" in e && e.group === group ? [{ id: e.id as LoopId, label: e.label }] : []
    ),
  }));
}

/** Ids that have a row, in catalog order. */
export const playingIds = (mix: Pick<Mix, "sounds">): LoopId[] =>
  LOOP_IDS.filter((id) => mix.sounds[id] !== undefined);

/** Tap a chip: an off sound joins at the default level, an on sound leaves. */
export function toggleSound(mix: Mix, id: LoopId, level = DEFAULT_LAYER): Mix {
  const sounds = { ...mix.sounds };
  if (sounds[id]) delete sounds[id];
  else sounds[id] = { lfo: 0, min: level, max: level };
  return { ...mix, sounds };
}

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** Replace one playing sound's setting. Min never passes max; an unknown sound changes nothing. */
export function setSound(mix: Mix, id: LoopId, next: SoundSetting): Mix {
  if (!mix.sounds[id]) return mix;
  const max = unit(next.max);
  return {
    ...mix,
    sounds: { ...mix.sounds, [id]: { lfo: next.lfo, min: Math.min(max, unit(next.min)), max } },
  };
}

/** A 0..1 volume as a phrase for screen readers. Never the raw number. */
export function volumeText(v: number): string {
  if (v <= 0) return "Silent";
  if (v < 0.2) return "Very quiet";
  if (v < 0.4) return "Quiet";
  if (v < 0.6) return "Medium";
  if (v < 0.8) return "Loud";
  return "Very loud";
}

/** Every loop measures about -30 dBFS RMS at the output at the default level (catalog TRIMS). */
const LOOP_RMS_DB = -30;
/** The limiter sits at -3 dBFS; 18 dB of RMS headroom leaves it room for a 15 dB crest. */
export const CLIP_SAFE_RMS_DB = -18;

/**
 * Estimated output RMS in dBFS at the default master: each sound's trimmed level scaled by its
 * loudest slider position, summed as uncorrelated power. A sound under an LFO counts at its max.
 */
export function mixRmsDb(sounds: Mix["sounds"]): number {
  let power = 0;
  for (const s of Object.values(sounds)) {
    if (!s) continue;
    const ratio = sliderToGain(s.max) / sliderToGain(DEFAULT_LAYER);
    power += 10 ** (LOOP_RMS_DB / 10) * ratio * ratio;
  }
  return power === 0 ? -Infinity : 10 * Math.log10(power);
}
