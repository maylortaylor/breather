import { bubblesSound, whaleSound } from "./creatures";
import type { Engine, Sound } from "./engine";
import { METRONOME_VOICES, PHASE_TONES, TEST_TONE, type OneShot } from "./metronome";
import { noiseSound, oceanSound } from "./noise";
import { padSound } from "./pads";

/** One-shots need to read over a playing loop, so they start much louder than loops. */
export const ONE_SHOT_LAYER = 0.9;

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
