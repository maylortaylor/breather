// The Begin gesture: creates the one audio context inside the tap, resumes it, and starts the mix.
import { createEngine, DEFAULT_LAYER, type Engine } from "./engine";
import { createMixer, type Mixer } from "./mixer";
import { createModulator, type Modulator } from "./modulation";
import { startKeepAlive, type KeepAlive } from "./keepAlive";
import { presetNameOf, setMediaMetadata } from "./mediaSession";
import type { LaunchState } from "../presets";
import { store, type AudioStatus } from "../store";

/** Seconds the restored mix takes to rise, so Begin never starts with a burst. */
export const BEGIN_FADE_SEC = 3;

export interface SessionDeps {
  createEngine: () => Engine;
  hasAudio: () => boolean;
  onStatus: (status: AudioStatus) => void;
  /** `navigator.audioSession`, when the browser has one. Missing means no feature. */
  audioSession?: { type: string } | null;
  /** Starts the silent looping <audio>. Called inside the Begin tap. */
  startKeepAlive?: () => KeepAlive;
  /** Sets the Media Session metadata to the named preset. */
  setMedia?: (presetName: string) => void;
  /** Subscribes to a user-visible preset change; returns the unsubscribe. */
  watchPreset?: (fn: (name: string) => void) => () => void;
  /** Gesture and visibility events that retry a resume. Returns the unsubscribe. */
  listen?: (onWake: () => void) => () => void;
}

export interface AudioSession {
  mixer: Mixer;
  engine: Engine;
  /** The LFO bank and per-sound rows the mixer drives; the Sounds tab reads and edits them. */
  modulator: Modulator;
  /** Resumes a suspended or interrupted context. True once it is running; false keeps the tap control. */
  resume(): Promise<boolean>;
}

const defaultDeps = (onStatus: (s: AudioStatus) => void): SessionDeps => ({
  createEngine,
  hasAudio: () => typeof AudioContext !== "undefined",
  onStatus,
  audioSession:
    typeof navigator !== "undefined" && "audioSession" in navigator
      ? (navigator as unknown as { audioSession: { type: string } }).audioSession
      : null,
  startKeepAlive: () => startKeepAlive(),
  setMedia: (name) => void setMediaMetadata(name),
  watchPreset: (fn) => {
    let last = store.get().presetId;
    return store.subscribe(() => {
      const id = store.get().presetId;
      if (id === last) return;
      last = id;
      fn(presetNameOf(id));
    });
  },
  listen: (onWake) => {
    // Taps resume; a touch is the only gesture iOS counts after a call or Siri.
    const events = ["pointerdown", "touchend", "click"] as const;
    const onVisible = () => {
      if (document.visibilityState === "visible") onWake();
    };
    for (const e of events) document.addEventListener(e, onWake, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      for (const e of events) document.removeEventListener(e, onWake);
      document.removeEventListener("visibilitychange", onVisible);
    };
  },
});

let current: AudioSession | null = null;
let keepAlive: KeepAlive | null = null;
let teardown: Array<() => void> = [];

const idle = (state: string) => state !== "running" && state !== "closed";

/**
 * Call inside the Begin tap. Returns the session, or null when sound is not available (the
 * caller still moves on to the resting screen). A second call reuses the first session and starts the mix again.
 */
export function beginAudio(
  launch: LaunchState,
  onStatus: (status: AudioStatus) => void,
  deps: SessionDeps = defaultDeps(onStatus)
): AudioSession | null {
  if (current) {
    // Begin again after a sleep timer ended: the context lives on, so bring the sound back.
    void current.engine.ctx.resume?.();
    keepAlive?.play();
    current.engine.setMaster(launch.master);
    current.mixer.apply(launch.mix, { fadeSec: BEGIN_FADE_SEC });
    deps.onStatus("running");
    return current;
  }
  if (!deps.hasAudio()) {
    deps.onStatus("unsupported");
    return null;
  }
  try {
    // The playback type goes first: it must be set before the context makes any sound.
    if (deps.audioSession) deps.audioSession.type = "playback";
    const engine = deps.createEngine();
    // Resume inside the gesture; iOS ignores a resume that comes later. If the context is still
    // idle once the call settles (rejected, or the iOS 26 cold start), the tap control shows.
    const first = Promise.resolve(engine.ctx.resume?.()).catch(() => {});
    void first.then(() => {
      if (current && idle(engine.ctx.state)) deps.onStatus("needs-tap");
    });
    keepAlive = deps.startKeepAlive?.() ?? null;
    // suspended and WebKit's interrupted both mean "tap to resume"; a closed context stays as is.
    engine.ctx.onstatechange = () => {
      const state = engine.ctx.state;
      if (state === "running") deps.onStatus("running");
      else if (idle(state)) deps.onStatus("needs-tap");
    };
    const resume = async (): Promise<boolean> => {
      if (!idle(engine.ctx.state)) return engine.ctx.state === "running";
      try {
        await engine.ctx.resume();
      } catch {
        // A rejected resume keeps the tap control; nothing is shown or logged.
        return false;
      }
      const ok = engine.ctx.state === "running";
      if (ok) deps.onStatus("running");
      return ok;
    };
    const modulator = createModulator(() => DEFAULT_LAYER);
    modulator.setEngine(engine);
    const mixer = createMixer(engine, modulator);
    engine.setMaster(launch.master);
    mixer.apply(launch.mix, { fadeSec: BEGIN_FADE_SEC });
    current = { mixer, engine, modulator, resume };
    const name = presetNameOf(launch.presetId);
    deps.setMedia?.(name);
    teardown = [];
    const unwatch = deps.watchPreset?.((n) => deps.setMedia?.(n));
    if (unwatch) teardown.push(unwatch);
    const unlisten = deps.listen?.(() => {
      if (idle(engine.ctx.state)) void resume();
    });
    if (unlisten) teardown.push(unlisten);
    deps.onStatus("running");
    return current;
  } catch {
    deps.onStatus("unsupported");
    return null;
  }
}

/** Resumes the sound from the "Tap to resume" control. False when there is no session or it stays paused. */
export function resumeAudio(): Promise<boolean> {
  return current ? current.resume() : Promise.resolve(false);
}

/** The running session, or null before Begin or when sound is unavailable. */
export function getSession(): AudioSession | null {
  return current;
}

/** Test hook: forget the session. */
export function resetSession(): void {
  for (const f of teardown) f();
  teardown = [];
  keepAlive?.stop();
  keepAlive = null;
  current = null;
}
