import { bubblesSound, whaleSound } from "./creatures";
import type { Engine, Sound } from "./engine";
import { METRONOME_VOICES, PHASE_TONES, TEST_TONE, type OneShot } from "./metronome";
import { noiseSound, oceanSound } from "./noise";
import { padSound } from "./pads";

/** One-shots need to read over a playing loop, so they start much louder than loops. */
export const ONE_SHOT_LAYER = 0.8;

/**
 * Level match, multiplied into the layer gain. At the default slider and master, every loop
 * measures about -30 dBFS RMS at the output and every one-shot peaks about -14 dBFS.
 * Measured in Chrome with an analyser on the output.
 */
export const TRIMS: Record<string, number> = {
  white: 18.6,
  pink: 19.3,
  brown: 18.6,
  ocean: 33.1,
  // Sparse, so its mean sits about 30 dB under each blip. Capped by peak (about -14 dBFS), not
  // by the -30 dBFS mean target, which would clip.
  bubbles: 45,
  "whale-a": 8,
  "whale-b": 6.5,
  "whale-c": 20,
  "pad-dreamy": 2.27,
  "pad-tonal": 1.6,
  "pad-deep": 1.47,
  "metro-soft-tick": 0.57,
  "metro-wood-block": 0.55,
  "metro-bell": 0.54,
  "metro-heartbeat-thump": 0.64,
  "phase-inhale-rising-": 0.69,
  "phase-hold-steady-": 0.7,
  "phase-exhale-falling-": 0.69,
};
export const trimOf = (id: string): number => TRIMS[id] ?? 1;

export type Entry =
  | { id: string; label: string; group: string; loop: (engine: Engine) => Sound }
  | { id: string; label: string; group: string; once: OneShot };

const loops: [string, string, string, (e: Engine, id: string) => Sound][] = [
  ["white", "White noise", "Noise", (e, id) => noiseSound(e, "white", id)],
  ["pink", "Pink noise", "Noise", (e, id) => noiseSound(e, "pink", id)],
  ["brown", "Brown noise", "Noise", (e, id) => noiseSound(e, "brown", id)],
  ["ocean", "Ocean waves", "Nature", (e, id) => oceanSound(e, id)],
  ["bubbles", "Underwater bubbles", "Nature", (e, id) => bubblesSound(e, id)],
  ["whale-a", "Whale A: humpback song", "Nature", (e, id) => whaleSound(e, "A", id)],
  ["whale-b", "Whale B: blue moan", "Nature", (e, id) => whaleSound(e, "B", id)],
  ["whale-c", "Whale C: distant call", "Nature", (e, id) => whaleSound(e, "C", id)],
  ["pad-dreamy", "Pad: Dreamy", "Music", (e, id) => padSound(e, "dreamy", id)],
  ["pad-tonal", "Pad: Tonal", "Music", (e, id) => padSound(e, "tonal", id)],
  ["pad-deep", "Pad: Deep", "Music", (e, id) => padSound(e, "deep", id)],
];

const slug = (s: string) => s.replace(/[^a-z]+/g, "-");

export const CATALOG: Entry[] = [
  ...loops.map(([id, label, group, make]): Entry => ({
    id,
    label,
    group,
    loop: (engine) => make(engine, id),
  })),
  ...Object.entries(METRONOME_VOICES).map(([name, once]): Entry => ({
    id: `metro-${slug(name)}`,
    label: name,
    group: "Metronome voices",
    once,
  })),
  ...Object.entries(PHASE_TONES).map(([name, once]): Entry => ({
    id: `phase-${slug(name)}`,
    label: name,
    group: "Phase tones",
    once,
  })),
  { id: "test-tone", label: "Test tone (quiet)", group: "Engine", once: TEST_TONE },
];
