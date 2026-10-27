import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeEngine } from "./fakeAudio";
import { createEngine } from "./engine";

describe("createEngine", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks for a playback latency hint, so a throttled locked phone does not underrun", () => {
    const seen: unknown[] = [];
    const base = createFakeEngine().engine.ctx;
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor(opts?: unknown) {
          seen.push(opts);
          return base as unknown as object;
        }
      }
    );
    try {
      createEngine();
    } catch {
      // The fake context is not a full graph; only the constructor argument matters here.
    }
    expect(seen).toEqual([{ latencyHint: "playback" }]);
  });
});
