// The Begin gesture: creates the one audio context inside the tap, resumes it, and starts the mix.
import { createEngine, DEFAULT_LAYER, type Engine } from "./engine";
import { createMixer, type Mixer } from "./mixer";
import { createModulator, type Modulator } from "./modulation";
import type { LaunchState } from "../presets";
import type { AudioStatus } from "../store";

/** Seconds the restored mix takes to rise, so Begin never starts with a burst. */
export const BEGIN_FADE_SEC = 3;

export interface SessionDeps {
  createEngine: () => Engine;
  hasAudio: () => boolean;
  onStatus: (status: AudioStatus) => void;
}

export interface AudioSession {
  mixer: Mixer;
  engine: Engine;
  /** The LFO bank and per-sound rows the mixer drives; the Sounds tab reads and edits them. */
  modulator: Modulator;
}

const defaultDeps = (onStatus: (s: AudioStatus) => void): SessionDeps => ({
  createEngine,
  hasAudio: () => typeof AudioContext !== "undefined",
  onStatus,
});

let current: AudioSession | null = null;

/**
 * Call inside the Begin tap. Returns the session, or null when sound is not available (the
 * caller still moves on to the resting screen). A second call reuses the first session.
 */
export function beginAudio(
  launch: LaunchState,
  onStatus: (status: AudioStatus) => void,
  deps: SessionDeps = defaultDeps(onStatus)
): AudioSession | null {
  if (current) return current;
  if (!deps.hasAudio()) {
    deps.onStatus("unsupported");
    return null;
  }
  try {
    const engine = deps.createEngine();
    // Resume inside the gesture; iOS ignores a resume that comes later.
    void engine.ctx.resume?.();
    engine.ctx.onstatechange = () =>
      deps.onStatus(engine.ctx.state === "running" ? "running" : "needs-tap");
    const modulator = createModulator(() => DEFAULT_LAYER);
    modulator.setEngine(engine);
    const mixer = createMixer(engine, modulator);
    engine.setMaster(launch.master);
    mixer.apply(launch.mix, { fadeSec: BEGIN_FADE_SEC });
    current = { mixer, engine, modulator };
    deps.onStatus("running");
    return current;
  } catch {
    deps.onStatus("unsupported");
    return null;
  }
}

/** The running session, or null before Begin or when sound is unavailable. */
export function getSession(): AudioSession | null {
  return current;
}

/** Test hook: forget the session. */
export function resetSession(): void {
  current = null;
}
