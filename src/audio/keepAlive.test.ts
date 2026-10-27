import { describe, expect, it, vi } from "vitest";
import { silentWav, startKeepAlive, type KeepAliveElement } from "./keepAlive";

function fakeEl() {
  const attrs: Record<string, string> = {};
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  const el: KeepAliveElement = {
    src: "",
    loop: false,
    playsInline: false,
    setAttribute: (n, v) => void (attrs[n] = v),
    play,
    pause,
  };
  return { el, attrs, play, pause };
}

describe("silentWav", () => {
  it("is a valid mono 8-bit PCM WAV of pure silence", () => {
    const b = silentWav();
    const v = new DataView(b.buffer);
    const tag = (at: number) => String.fromCharCode(...b.slice(at, at + 4));
    expect([tag(0), tag(8), tag(36)]).toEqual(["RIFF", "WAVE", "data"]);
    expect(v.getUint32(4, true)).toBe(b.length - 8);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(34, true)).toBe(8);
    expect(v.getUint32(40, true)).toBe(b.length - 44);
    expect(b.slice(44).every((s) => s === 128)).toBe(true);
  });
});

describe("startKeepAlive", () => {
  it("loops the blob URL inline and plays at once", () => {
    const { el, attrs, play } = fakeEl();
    startKeepAlive({
      createElement: () => el,
      createUrl: () => "blob:silent",
      revokeUrl: () => {},
    });
    expect(el.src).toBe("blob:silent");
    expect(el.loop).toBe(true);
    expect(el.playsInline).toBe(true);
    expect(attrs.playsinline).toBe("");
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejected play and a throwing play", async () => {
    const { el } = fakeEl();
    el.play = vi.fn(() => Promise.reject(new Error("blocked")));
    const ka = startKeepAlive({
      createElement: () => el,
      createUrl: () => "blob:x",
      revokeUrl: () => {},
    });
    el.play = () => {
      throw new Error("boom");
    };
    expect(() => ka.play()).not.toThrow();
    await Promise.resolve();
  });

  it("pauses without revoking the URL, so a later play still has a source", () => {
    const { el, pause, play } = fakeEl();
    const revoke = vi.fn();
    const ka = startKeepAlive({
      createElement: () => el,
      createUrl: () => "blob:kept",
      revokeUrl: revoke,
    });
    ka.pause();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    ka.play();
    expect(play).toHaveBeenCalledTimes(2);
    expect(el.src).toBe("blob:kept");
  });

  it("pauses and revokes the URL on stop", () => {
    const { el, pause } = fakeEl();
    const revoke = vi.fn();
    const ka = startKeepAlive({
      createElement: () => el,
      createUrl: () => "blob:gone",
      revokeUrl: revoke,
    });
    ka.stop();
    expect(pause).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:gone");
  });
});

describe("startKeepAlive with a stream", () => {
  it("plays the mix stream instead of the silent loop, so a locked screen keeps the sound", () => {
    const { el, play } = fakeEl();
    const stream = {} as MediaStream;
    startKeepAlive(
      { createElement: () => el, createUrl: () => "blob:silent", revokeUrl: () => {} },
      stream
    );
    expect(el.srcObject).toBe(stream);
    expect(el.src).toBe("");
    expect(play).toHaveBeenCalledTimes(1);
  });
});
