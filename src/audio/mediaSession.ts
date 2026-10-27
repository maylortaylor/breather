// Media Session metadata: the lock screen and control centre read "Breather" and the preset name.
// No action handlers: play and pause there would fight the sleep timer (docs/research/ios-audio.md, 2).
import { BUILT_INS } from "../presets";
import { presetStore } from "../presetStore";

export const MEDIA_TITLE = "Breather";

export interface MediaSessionLike {
  metadata: unknown;
}

export interface MediaDeps {
  mediaSession: MediaSessionLike | null;
  makeMetadata: (init: { title: string; artist: string }) => unknown;
}

export const browserMediaDeps = (): MediaDeps => ({
  mediaSession:
    typeof navigator !== "undefined" && "mediaSession" in navigator
      ? (navigator.mediaSession as MediaSessionLike)
      : null,
  makeMetadata: (init) => new MediaMetadata(init),
});

/** The display name of a preset id, or "Custom" for an edited or unknown mix. */
export function presetNameOf(id: string | null): string {
  if (id === null) return "Custom";
  const found = [...BUILT_INS, ...presetStore.get().presets].find((p) => p.id === id);
  return found ? found.name : "Custom";
}

/** Sets the metadata where Media Session exists; returns true when it did. */
export function setMediaMetadata(
  presetName: string,
  deps: MediaDeps = browserMediaDeps()
): boolean {
  if (!deps.mediaSession) return false;
  try {
    deps.mediaSession.metadata = deps.makeMetadata({ title: MEDIA_TITLE, artist: presetName });
    return true;
  } catch {
    return false;
  }
}
