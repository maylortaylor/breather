import { useSyncExternalStore } from "react";

export type Store<T> = {
  get: () => T;
  set: (patch: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      const changed = (Object.keys(next) as (keyof T)[]).some((k) => !Object.is(state[k], next[k]));
      if (!changed) return;
      state = { ...state, ...next };
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

// Every key the app writes starts with this: roboborealis.com/breather/ shares an origin with the
// main site.
const PREFIX = "breather.";
const VERSION = 1;

// Storage failures are silent: the app runs from memory (spec "Errors and fallbacks" item 1).
export function persist<V>(name: string) {
  const key = `${PREFIX}${name}`;
  return {
    read(): V | null {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;
        const { version, value } = parsed as { version?: unknown; value?: unknown };
        return version === VERSION && value !== undefined ? (value as V) : null;
      } catch {
        return null;
      }
    },
    write(value: V): void {
      try {
        localStorage.setItem(key, JSON.stringify({ version: VERSION, value }));
      } catch {
        // Quota, private mode or blocked storage: keep going in memory.
      }
    },
  };
}

export type ScreenName = "welcome" | "begin" | "resting";
export type AudioStatus = "off" | "running" | "needs-tap" | "unsupported";
export type TabName = "breath" | "sounds" | "session";

export type AppState = {
  screen: ScreenName;
  audio: AudioStatus;
  dim: boolean;
  secondsMode: boolean;
  master: number;
  presetId: string | null;
  paused: boolean;
  sleep: { minutes: number; endsAt: number } | null;
  sheet: { open: boolean; tab: TabName };
  welcomeSeen: boolean;
};

// The subset that survives a reload, under `breather.state`.
export type SavedState = Pick<
  AppState,
  "welcomeSeen" | "dim" | "secondsMode" | "master" | "presetId"
>;

const SAVED_TYPES: { [K in keyof SavedState]: (v: unknown) => boolean } = {
  welcomeSeen: (v) => typeof v === "boolean",
  dim: (v) => typeof v === "boolean",
  secondsMode: (v) => typeof v === "boolean",
  master: (v) => typeof v === "number" && v >= 0 && v <= 1,
  presetId: (v) => typeof v === "string",
};

const savedState = persist<Partial<SavedState>>("state");

export function loadState(): Partial<SavedState> {
  const raw = savedState.read();
  const out: Record<string, unknown> = {};
  if (typeof raw === "object" && raw !== null) {
    for (const [k, ok] of Object.entries(SAVED_TYPES)) {
      const v = (raw as Record<string, unknown>)[k];
      if (ok(v)) out[k] = v;
    }
  }
  return out as Partial<SavedState>;
}

export function saveState(s: SavedState): void {
  savedState.write({
    welcomeSeen: s.welcomeSeen,
    dim: s.dim,
    secondsMode: s.secondsMode,
    master: s.master,
    presetId: s.presetId,
  });
}

export const DEFAULT_STATE: AppState = {
  screen: "welcome",
  audio: "off",
  dim: false,
  secondsMode: false,
  master: 0.7,
  presetId: null,
  paused: false,
  sleep: null,
  sheet: { open: false, tab: "breath" },
  welcomeSeen: false,
};

export const store = createStore<AppState>({ ...DEFAULT_STATE, ...loadState() });
store.subscribe(() => saveState(store.get()));

export function useStore<S>(selector: (state: AppState) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
