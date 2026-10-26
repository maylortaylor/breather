import { getSession } from "../audio/session";
import { store, useStore } from "../store";
import { Slider } from "./Slider";

/** The Sounds tab. Master volume for now; the sound chips and rows land with ticket 24. */
export function SoundsTab() {
  const master = useStore((s) => s.master);
  const change = (value: number) => {
    // Master is session-only: it lives in the store and the engine, never in storage.
    store.set({ master: value });
    getSession()?.mixer.setMaster(value);
  };
  return (
    <Slider
      label="Master"
      value={master}
      onChange={change}
      tip="How loud everything is. It resets to a gentle default each time you open the app."
    />
  );
}
