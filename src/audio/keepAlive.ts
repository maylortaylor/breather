// The iPhone keep-alive: a silent looping <audio playsinline> started inside the Begin tap. Media
// elements use the playback channel, so Web Audio follows it past the ringer switch and screen
// lock (docs/research/ios-audio.md, 1 and 2). The WAV is built in code; no audio file ships.

const SAMPLE_RATE = 8000;
const SECONDS = 1;

/** One second of 8-bit mono silence as a WAV file. */
export function silentWav(): Uint8Array {
  const samples = SAMPLE_RATE * SECONDS;
  const out = new Uint8Array(44 + samples);
  const view = new DataView(out.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true); // byte rate: 1 byte per sample
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples, true);
  out.fill(128, 44); // 8-bit PCM silence sits at the midpoint
  return out;
}

export interface KeepAliveElement {
  src: string;
  loop: boolean;
  playsInline?: boolean;
  setAttribute(name: string, value: string): void;
  play(): Promise<void> | void;
  pause(): void;
}

export interface KeepAliveDeps {
  createElement: () => KeepAliveElement;
  createUrl: (bytes: Uint8Array) => string;
  revokeUrl: (url: string) => void;
}

export interface KeepAlive {
  /** Play (again) the silent loop. Call inside a gesture. A rejected play is ignored. */
  play(): void;
  /** Pause the loop but keep the source, so `play` can start it again. */
  pause(): void;
  /** Pause and free the blob URL. */
  stop(): void;
}

export const browserKeepAliveDeps = (): KeepAliveDeps => ({
  createElement: () => new Audio(),
  createUrl: (bytes) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: "audio/wav" })),
  revokeUrl: (url) => URL.revokeObjectURL(url),
});

export function startKeepAlive(deps: KeepAliveDeps = browserKeepAliveDeps()): KeepAlive {
  const url = deps.createUrl(silentWav());
  const el = deps.createElement();
  el.src = url;
  el.loop = true;
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  const play = () => {
    try {
      // An unlocked-late or blocked play is not an error the listener should see.
      void Promise.resolve(el.play()).catch(() => {});
    } catch {
      // Same: a throwing element must not break Begin.
    }
  };
  play();
  return {
    play,
    pause: () => el.pause(),
    stop() {
      el.pause();
      deps.revokeUrl(url);
    },
  };
}
