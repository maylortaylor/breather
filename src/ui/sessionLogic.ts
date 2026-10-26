// Pure rules behind the Session tab: which presets exist, what a switch changes, and the
// rename, delete and update rules. No DOM, no storage, no audio.
import {
  BUILT_INS,
  isModified,
  MAX_NAME_LENGTH,
  MAX_USER_PRESETS,
  type Mix,
  type Preset,
  type SaveResult,
} from "../presets";

/** Seconds a preset switch takes: levels glide, removed sounds fade out. New sounds fade in over
 * the engine's own 1.5 s start fade. */
export const SWITCH_FADE_SEC = 3;

export const allPresets = (user: readonly Preset[]): Preset[] => [...BUILT_INS, ...user];

export function findPreset(user: readonly Preset[], id: string | null): Preset | null {
  return id === null ? null : (allPresets(user).find((p) => p.id === id) ?? null);
}

export interface SwitchPlan {
  presetId: string;
  mix: Mix;
  dim: boolean;
  fadeSec: number;
}

/** What choosing a preset applies. Master volume is not here, so a switch cannot change it. */
export function planSwitch(preset: Preset): SwitchPlan {
  return {
    presetId: preset.id,
    mix: JSON.parse(JSON.stringify(preset.mix)) as Mix,
    dim: preset.dim,
    fadeSec: SWITCH_FADE_SEC,
  };
}

/** Which save buttons to show. A built-in never updates; a user preset can. */
export function offerSave(
  active: Preset | null,
  mix: Mix,
  dim: boolean
): "save-as-new" | "update-or-save" | null {
  if (!active) return "save-as-new";
  if (!isModified(active, mix, dim)) return null;
  return active.builtIn ? "save-as-new" : "update-or-save";
}

export type NameFailure = Extract<SaveResult, { ok: false }>["reason"];
export type RenameResult =
  | { ok: true; presets: Preset[] }
  | { ok: false; reason: NameFailure | "missing" };

export function renamePreset(list: readonly Preset[], id: string, name: string): RenameResult {
  const trimmed = name.trim();
  if (trimmed === "") return { ok: false, reason: "name-empty" };
  if (trimmed.length > MAX_NAME_LENGTH) return { ok: false, reason: "name-too-long" };
  if (!list.some((p) => p.id === id)) return { ok: false, reason: "missing" };
  return { ok: true, presets: list.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) };
}

export const removePreset = (list: readonly Preset[], id: string): Preset[] =>
  list.filter((p) => p.id !== id);

export function updatePreset(
  list: readonly Preset[],
  id: string,
  mix: Mix,
  dim: boolean
): Preset[] {
  const copy = JSON.parse(JSON.stringify(mix)) as Mix;
  return list.map((p) => (p.id === id ? { ...p, mix: copy, dim } : p));
}

export function messageFor(reason: NameFailure | "missing"): string {
  switch (reason) {
    case "name-empty":
      return "Give it a name first.";
    case "name-too-long":
      return `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`;
    case "limit":
      return `You have ${MAX_USER_PRESETS} saved presets. Delete one to save another.`;
    case "missing":
      return "That preset is gone.";
  }
}
