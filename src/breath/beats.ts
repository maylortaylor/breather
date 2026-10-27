// Runs the lookahead scheduler against the stored tempo and metronome, and sounds each beat.
// A phase-change beat plays its phase tone alone; every other beat plays the metronome voice.
import { CATALOG, ONE_SHOT_LAYER, trimOf } from "../audio/catalog";
import type { Engine } from "../audio/engine";
import type { Phase, PhaseMachine } from "./phases";
import { createHaptics, vibrateFromNavigator, type Vibrate } from "./haptics";
import { createBeatScheduler } from "./scheduler";
import { beatSeconds, metronomeGains } from "./tempo";
import type { PhaseSoundId } from "../presets";
import type { AppState, Store } from "../store";

export const TICK_MS = 25;
/** Seconds of beats handed out ahead while the page is hidden. */
export const HIDDEN_LOOKAHEAD_SEC = 2;
/** Seconds the ringing phase tones take to fade when the guide pauses. */
export const PAUSE_FADE_SEC = 0.3;
/** Seconds the phase tones take to come back on resume. */
const RESUME_GLIDE_SEC = 0.05;

export const PHASE_TONE_IDS: Record<PhaseSoundId, Record<Phase, string>> = {
  tones: {
    inhale: "phase-inhale-rising",
    hold: "phase-hold-steady",
    exhale: "phase-exhale-falling",
  },
  bowl: {
    inhale: "phase-bowl-inhale",
    hold: "phase-bowl-hold",
    exhale: "phase-bowl-exhale",
  },
  chime: {
    inhale: "phase-chime-inhale",
    hold: "phase-chime-hold",
    exhale: "phase-chime-exhale",
  },
};
const PHASE_LAYERS = Object.values(PHASE_TONE_IDS).flatMap((set) => Object.values(set));
const VOICE_LAYERS = CATALOG.filter((e) => e.group === "Metronome voices").map((e) => e.id);

const oneShot = (id: string) => {
  const entry = CATALOG.find((e) => e.id === id);
  return entry && "once" in entry ? entry.once : null;
};

export interface BeatsDeps {
  machine: PhaseMachine;
  /** Seconds on the audio clock, the clock the machine runs on. */
  clock: () => number;
  engine: Engine;
  store: Pick<Store<AppState>, "get" | "subscribe">;
  every?: (fn: () => void, ms: number) => () => void;
  /** The phase-change pulse. Defaults to `navigator.vibrate`; null when the device has none. */
  vibrate?: Vibrate | null;
  /** True while the page is hidden or the screen is locked. Defaults to `document.hidden`. */
  hidden?: () => boolean;
  /** Runs a function after a delay; returns a canceller. Defaults to `setTimeout`. */
  later?: (fn: () => void, ms: number) => () => void;
}

const defaultEvery = (fn: () => void, ms: number) => {
  const handle = setInterval(fn, ms);
  return () => clearInterval(handle);
};

/** Starts the 25 ms timer. Returns a function that stops it and drops the store subscription. */
const defaultLater = (fn: () => void, ms: number) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};

export function startBeats({
  machine,
  clock,
  engine,
  store,
  every = defaultEvery,
  vibrate = vibrateFromNavigator(),
  later = defaultLater,
  hidden = () => typeof document !== "undefined" && document.hidden,
}: BeatsDeps): () => void {
  for (const id of [...PHASE_LAYERS, ...VOICE_LAYERS]) engine.setLayer(id, ONE_SHOT_LAYER);

  const applyGains = (glideSec?: number) => {
    const { level, voice } = store.get().mix.metronome;
    const g = metronomeGains(level);
    for (const id of PHASE_LAYERS) engine.setTrim(id, trimOf(id) * g.phase);
    for (const id of VOICE_LAYERS) engine.setTrim(id, trimOf(id) * (id === voice ? g.beat : 0));
    // A fade-out leaves a ramp on the layer; a glide clears it so the tones return.
    if (glideSec !== undefined) {
      for (const id of PHASE_LAYERS) engine.setLayer(id, ONE_SHOT_LAYER, glideSec);
    }
  };

  const haptics = createHaptics({
    vibrate,
    now: clock,
    later,
    // Metronome off means no phase cues at all: no tone and no pulse.
    isPaused: () => store.get().paused || store.get().mix.metronome.level <= 0,
  });

  const scheduler = createBeatScheduler({
    now: clock,
    machine,
    // A hidden page ticks about once a second; hand out beats far enough ahead to cover that.
    lookahead: () => (hidden() ? HIDDEN_LOOKAHEAD_SEC : 0.1),
    onBeat(beat) {
      const { level, voice, phaseSound } = store.get().mix.metronome;
      const g = metronomeGains(level);
      if (level > 0) haptics.onBeat(beat);
      if (beat.phaseStart) {
        const id = PHASE_TONE_IDS[phaseSound][beat.phase];
        if (g.phase > 0) oneShot(id)?.(engine, beat.at, id);
      } else if (g.beat > 0) {
        oneShot(voice)?.(engine, beat.at, voice);
      }
    },
  });

  applyGains();
  const read = (s: AppState) => ({
    seconds: beatSeconds(s.mix.tempo, s.secondsMode),
    paused: s.paused,
    metronome: s.mix.metronome,
  });
  let last = read(store.get());
  machine.setBeatSeconds(last.seconds, clock());
  scheduler.reset();

  const unsubscribe = store.subscribe(() => {
    const next = read(store.get());
    const t = clock();
    if (next.seconds !== last.seconds) {
      // The machine folds the elapsed beats in first, so the ring and the beat never jump.
      machine.setBeatSeconds(next.seconds, t);
      scheduler.reset();
    }
    if (next.paused !== last.paused) {
      // The ring's tap moves the machine; the scheduler only needs to forget its horizon.
      scheduler.reset();
      if (next.paused) haptics.cancel();
      if (next.paused) for (const id of PHASE_LAYERS) engine.silenceLayer(id, PAUSE_FADE_SEC);
      else applyGains(RESUME_GLIDE_SEC);
    }
    if (next.metronome !== last.metronome) {
      applyGains();
      if (next.metronome.level <= 0) haptics.cancel();
    }
    last = next;
  });
  const stopTimer = every(() => scheduler.tick(), TICK_MS);

  return () => {
    stopTimer();
    unsubscribe();
    haptics.cancel();
  };
}
