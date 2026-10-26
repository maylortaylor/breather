// The user's saved presets: `breather.presets` as `{ version, presets }` (spec, "State"). Storage
// failures are silent, like the rest of the app: it keeps running from memory.
import { createStore } from "./store";
import { parsePresetList, VERSION, type Preset } from "./presets";

export const PRESETS_KEY = "breather.presets";

export type KeyValue = Pick<Storage, "getItem" | "setItem">;

export function readPresets(storage?: KeyValue): Preset[] {
  try {
    const raw = (storage ?? localStorage).getItem(PRESETS_KEY);
    return raw === null ? [] : (parsePresetList(JSON.parse(raw)) ?? []);
  } catch {
    return [];
  }
}

export function writePresets(presets: readonly Preset[], storage?: KeyValue): void {
  try {
    (storage ?? localStorage).setItem(PRESETS_KEY, JSON.stringify({ version: VERSION, presets }));
  } catch {
    // Quota, private mode or blocked storage: keep going in memory.
  }
}

let counter = 0;
export const makeId = (): string =>
  `u${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const presetStore = createStore<{ presets: Preset[] }>({ presets: readPresets() });
presetStore.subscribe(() => writePresets(presetStore.get().presets));
