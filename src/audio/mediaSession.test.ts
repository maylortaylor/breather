import { describe, expect, it } from "vitest";
import { presetNameOf, setMediaMetadata } from "./mediaSession";

describe("setMediaMetadata", () => {
  it("sets the title Breather and the preset name as artist", () => {
    const ms = { metadata: null as unknown };
    const ok = setMediaMetadata("Focus", { mediaSession: ms, makeMetadata: (i) => ({ ...i }) });
    expect(ok).toBe(true);
    expect(ms.metadata).toEqual({ title: "Breather", artist: "Focus" });
  });

  it("does nothing where Media Session is missing or throws", () => {
    expect(setMediaMetadata("Focus", { mediaSession: null, makeMetadata: () => 1 })).toBe(false);
    const ms = { metadata: null as unknown };
    const boom = () => {
      throw new Error("no MediaMetadata");
    };
    expect(setMediaMetadata("Focus", { mediaSession: ms, makeMetadata: boom })).toBe(false);
  });
});

describe("presetNameOf", () => {
  it("names a built-in preset and falls back to Custom", () => {
    expect(presetNameOf("focus")).toBe("Focus");
    expect(presetNameOf("nope")).toBe("Custom");
    expect(presetNameOf(null)).toBe("Custom");
  });
});
