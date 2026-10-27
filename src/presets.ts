// Pure preset logic: the Mix schema, built-ins, parsing of anything read from storage, and the
// user-preset rules. No DOM, no storage, no clock; ids are injected.
import { clampPeriod, type LfoShape } from "./audio/lfo";

export const LOOP_IDS = [
  "white",
  "pink",
  "brown",
  "ocean",
  "bubbles",
  "whale-b",
  "pad-dreamy",
  "pad-tonal",
  "pad-deep",
] as const;
export type LoopId = (typeof LOOP_IDS)[number];

export const METRONOME_IDS = [
  "metro-soft-tick-700-hz",
  "metro-soft-tick-350-hz",
  "metro-wood-block",
  "metro-heartbeat-thump",
] as const;
export type VoiceId = (typeof METRONOME_IDS)[number];

export const PHASE_SOUND_IDS = ["tones", "bowl", "chime"] as const;
export type PhaseSoundId = (typeof PHASE_SOUND_IDS)[number];

export type SoundSetting = { lfo: 0 | 1 | 2 | 3; min: number; max: number }; // level is max at lfo 0
export type LfoSetting = { period: number; shape: LfoShape };
export type Mix = {
  sounds: Partial<Record<LoopId, SoundSetting>>;
  lfos: [LfoSetting, LfoSetting, LfoSetting];
  tempo: number; // slider 0..1, 0.5 is 60 BPM
  metronome: { level: number; voice: VoiceId; phaseSound: PhaseSoundId };
};
export type Preset = {
  id: string;
  name: string;
  builtIn: boolean;
  mix: Mix;
  dim: boolean;
};

/** What `breather.state` holds, minus the version. Master volume and the timer never persist. */
export type SavedMix = {
  mix: Mix;
  dim: boolean;
  secondsMode: boolean;
  presetId: string | null;
  welcomeSeen: boolean;
};

export const VERSION = 1;
export const MAX_USER_PRESETS = 10;
export const MAX_NAME_LENGTH = 24;
export const DEFAULT_MASTER = 0.7;

const DEFAULT_VOICE: VoiceId = "metro-heartbeat-thump";
const DEFAULT_PHASE_SOUND: PhaseSoundId = "tones";
/** Metronome detent 1: beats sound on phase changes only (spec, ticket 21). */
const PHASE_ONLY = 0.2;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

// The Lab's default LFOs: 20 s sine, 45 s sine, 90 s smooth-random.
const lfos = (): Mix["lfos"] => [
  { period: 20, shape: "sine" },
  { period: 45, shape: "sine" },
  { period: 90, shape: "smooth-random" },
];
const steady = (level: number): SoundSetting => ({ lfo: 0, min: level, max: level });

// Ticket 06 table. Levels are slider positions, to be tuned by ear after the build.
const SLEEP: Preset = {
  id: "sleep",
  name: "Sleep",
  builtIn: true,
  dim: true,
  mix: {
    sounds: {
      brown: steady(0.6),
      ocean: { lfo: 3, min: 0.2, max: 0.6 },
      bubbles: steady(0.3),
      "whale-b": steady(0.1),
    },
    lfos: lfos(),
    tempo: 0, // slow end, about 28 s a cycle
    metronome: {
      level: PHASE_ONLY,
      voice: DEFAULT_VOICE,
      phaseSound: DEFAULT_PHASE_SOUND,
    },
  },
};

export const BUILT_INS: readonly Preset[] = deepFreeze([
  SLEEP,
  {
    id: "focus",
    name: "Focus",
    builtIn: true,
    dim: false,
    mix: {
      sounds: { pink: steady(0.5), "pad-tonal": steady(0.2) },
      lfos: lfos(),
      tempo: 0.5,
      metronome: {
        level: 0,
        voice: "metro-soft-tick-700-hz",
        phaseSound: DEFAULT_PHASE_SOUND,
      },
    },
  },
  {
    id: "reset",
    name: "Reset",
    builtIn: true,
    dim: false,
    mix: {
      sounds: { ocean: { lfo: 1, min: 0.3, max: 0.6 }, "pad-dreamy": steady(0.4) },
      lfos: lfos(),
      tempo: 0.5,
      metronome: {
        level: PHASE_ONLY,
        voice: DEFAULT_VOICE,
        phaseSound: DEFAULT_PHASE_SOUND,
      },
    },
  },
] satisfies Preset[]);

export const DEFAULT_MIX: Mix = SLEEP.mix;

const cloneMix = (mix: Mix): Mix => JSON.parse(JSON.stringify(mix)) as Mix;

// ---- Parsing: takes unknown, never throws, clamps, drops what it does not know ----

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}

const bool = (v: unknown): boolean => v === true;

function parseSound(raw: unknown): SoundSetting | null {
  if (!isRecord(raw)) return null;
  const lfo = raw.lfo === 1 || raw.lfo === 2 || raw.lfo === 3 ? raw.lfo : 0;
  const max = num(raw.max, 0, 1, 0);
  const min = Math.min(max, num(raw.min, 0, 1, max));
  return { lfo, min, max };
}

function parseLfo(raw: unknown, fallback: LfoSetting): LfoSetting {
  if (!isRecord(raw)) return { ...fallback };
  const shape = raw.shape === "sine" || raw.shape === "smooth-random" ? raw.shape : "sine";
  const period =
    typeof raw.period === "number" ? clampPeriod(raw.period) : clampPeriod(fallback.period);
  return { period, shape };
}

export function parseMix(raw: unknown): Mix {
  const src = isRecord(raw) ? raw : {};
  const sounds: Mix["sounds"] = {};
  if (isRecord(src.sounds)) {
    for (const id of LOOP_IDS) {
      if (!Object.hasOwn(src.sounds, id)) continue;
      const s = parseSound(src.sounds[id]);
      if (s) sounds[id] = s;
    }
  }
  const rawLfos = Array.isArray(src.lfos) ? (src.lfos as unknown[]) : [];
  const defaults = DEFAULT_MIX.lfos;
  const metro = isRecord(src.metronome) ? src.metronome : {};
  const voice = METRONOME_IDS.find((id) => id === metro.voice) ?? DEFAULT_VOICE;
  const phaseSound = PHASE_SOUND_IDS.find((id) => id === metro.phaseSound) ?? DEFAULT_PHASE_SOUND;
  return {
    sounds,
    lfos: [
      parseLfo(rawLfos[0], defaults[0]),
      parseLfo(rawLfos[1], defaults[1]),
      parseLfo(rawLfos[2], defaults[2]),
    ],
    tempo: num(src.tempo, 0, 1, 0.5),
    metronome: { level: num(metro.level, 0, 1, 0), voice, phaseSound },
  };
}

const cleanName = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, MAX_NAME_LENGTH).trim() : null;

/** The preset body without a version check; the caller owns the version. */
function parsePresetBody(raw: unknown, builtIn: boolean): Preset | null {
  if (!isRecord(raw)) return null;
  const name = cleanName(raw.name);
  if (typeof raw.id !== "string" || raw.id === "" || name === null) return null;
  return { id: raw.id, name, builtIn, mix: parseMix(raw.mix), dim: bool(raw.dim) };
}

const versionOk = (raw: Record<string, unknown>): boolean => raw.version === VERSION;

/** A preset as it is written to storage: the preset plus `version`. */
export function serializePreset(preset: Preset): Preset & { version: number } {
  return { version: VERSION, ...preset };
}

/** Null for a missing or higher version, or a preset with no id or name. */
export function parsePreset(raw: unknown): Preset | null {
  return isRecord(raw) && versionOk(raw) ? parsePresetBody(raw, raw.builtIn === true) : null;
}

/** `breather.presets`: `{ version, presets }`. Skips bad entries, keeps at most ten. */
export function parsePresetList(raw: unknown): Preset[] | null {
  if (!isRecord(raw) || !versionOk(raw)) return null;
  if (!Array.isArray(raw.presets)) return [];
  const out: Preset[] = [];
  for (const item of raw.presets as unknown[]) {
    // The stored list holds user presets only, so storage cannot forge a read-only one.
    const p = parsePresetBody(item, false);
    if (p) out.push(p);
    if (out.length === MAX_USER_PRESETS) break;
  }
  return out;
}

/** `breather.state`. Null falls back to the defaults. */
export function parseState(raw: unknown): SavedMix | null {
  if (!isRecord(raw) || !versionOk(raw)) return null;
  return {
    mix: raw.mix === undefined ? cloneMix(DEFAULT_MIX) : parseMix(raw.mix),
    dim: bool(raw.dim),
    secondsMode: bool(raw.secondsMode),
    presetId: typeof raw.presetId === "string" ? raw.presetId : null,
    welcomeSeen: bool(raw.welcomeSeen),
  };
}

// ---- User-preset rules ----

export type SaveResult =
  | { ok: true; preset: Preset; presets: Preset[] }
  | { ok: false; reason: "limit" | "name-empty" | "name-too-long" };

export function saveUserPreset(
  existing: readonly Preset[],
  name: string,
  mix: Mix,
  dim: boolean,
  makeId: () => string
): SaveResult {
  const trimmed = name.trim();
  if (trimmed === "") return { ok: false, reason: "name-empty" };
  if (trimmed.length > MAX_NAME_LENGTH) return { ok: false, reason: "name-too-long" };
  if (existing.length >= MAX_USER_PRESETS) return { ok: false, reason: "limit" };
  const preset: Preset = { id: makeId(), name: trimmed, builtIn: false, mix: cloneMix(mix), dim };
  return { ok: true, preset, presets: [...existing, preset] };
}

/** Sorted-key JSON, so key order never reads as an edit. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** True when any saved field differs. Master volume and the timer are not saved fields. */
export function isModified(preset: Preset, mix: Mix, dim: boolean): boolean {
  return preset.dim !== dim || canonical(preset.mix) !== canonical(mix);
}

/** The mix to store, or undefined while it still equals the default, so a first launch gets Sleep. */
export function persistableMix(mix: Mix): Mix | undefined {
  return canonical(mix) === canonical(DEFAULT_MIX) ? undefined : mix;
}

export type EditResult =
  | { kind: "save-as-new"; mix: Mix; dim: boolean }
  | { kind: "updated"; preset: Preset };

/** A built-in is read-only: an edit becomes "Save as new". A user preset updates in place. */
export function applyEdit(preset: Preset, mix: Mix, dim: boolean): EditResult {
  if (preset.builtIn) return { kind: "save-as-new", mix: cloneMix(mix), dim };
  return { kind: "updated", preset: { ...preset, mix: cloneMix(mix), dim } };
}

// ---- Launch ----

export type LaunchState = SavedMix & { master: number; sleep: null };

/** First launch (or unreadable storage) gets Sleep. Master and the sleep timer always reset. */
export function restoreLaunch(stored: unknown): LaunchState {
  const parsed = parseState(stored);
  const base: SavedMix = parsed ?? {
    mix: DEFAULT_MIX,
    dim: SLEEP.dim,
    secondsMode: false,
    presetId: SLEEP.id,
    welcomeSeen: false,
  };
  return { ...base, mix: cloneMix(base.mix), master: DEFAULT_MASTER, sleep: null };
}
