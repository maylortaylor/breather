// How the breath ring tells the background where the breath is, without either importing the
// other. The ring publishes its state each frame; the background reads the level it implies.
import type { BreathState } from "../breath/phases";

type Listener = (state: BreathState | null) => void;

const listeners = new Set<Listener>();

/** Publish the current breath, or null when no guide is running (the Begin screen). */
export function publishBreath(state: BreathState | null): void {
  for (const l of listeners) l(state);
}

export function subscribeBreath(fn: Listener): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
