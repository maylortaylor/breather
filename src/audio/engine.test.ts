import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bubblesSound, whaleSound } from "./creatures";
import { connectOut } from "./engine";
import { createFakeEngine, makeNode } from "./fakeAudio";
import { PHASE_TONES } from "./metronome";
import { noiseSound, oceanSound } from "./noise";
import { padSound } from "./pads";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("connectOut disposer", () => {
  it("disconnects the layer link, send and wet nodes and clears the wet list", () => {
    const fake = createFakeEngine();
    const node = makeNode("src");
    const dispose = connectOut(fake.engine, node as unknown as AudioNode, "pad", 0.6);
    expect(fake.wetCount()).toBe(1);
    expect(node.connections.size).toBe(2); // layer + send
    dispose();
    expect(fake.wetCount()).toBe(0);
    expect(node.connections.size).toBe(0);
  });

  it("is safe to call twice and works without a reverb share", () => {
    const fake = createFakeEngine();
    const node = makeNode("src");
    const dispose = connectOut(fake.engine, node as unknown as AudioNode, "dry");
    expect(fake.wetCount()).toBe(0);
    dispose();
    dispose();
    expect(node.connections.size).toBe(0);
  });

  it("keeps other sounds on the same layer registered", () => {
    const fake = createFakeEngine();
    const a = connectOut(fake.engine, makeNode("a") as unknown as AudioNode, "shared", 0.3);
    connectOut(fake.engine, makeNode("b") as unknown as AudioNode, "shared", 0.3);
    expect(fake.wetCount()).toBe(2);
    a();
    expect(fake.wetCount()).toBe(1);
  });
});

describe("no wet node outlives its sound", () => {
  it("bubbles: 100 plays and stops end with an empty wet list", () => {
    const fake = createFakeEngine();
    const sound = bubblesSound(fake.engine, "bubbles");
    for (let i = 0; i < 100; i++) {
      sound.start();
      expect(fake.wetCount()).toBe(1);
      sound.stop();
      vi.advanceTimersByTime(1100);
    }
    expect(fake.wetCount()).toBe(0);
  });

  it("pad: 100 plays and stops end with an empty wet list", () => {
    const fake = createFakeEngine();
    const sound = padSound(fake.engine, "dreamy", "pad-dreamy");
    for (let i = 0; i < 100; i++) {
      sound.start();
      expect(fake.wetCount()).toBe(1);
      sound.stop();
      vi.advanceTimersByTime(2700);
    }
    expect(fake.wetCount()).toBe(0);
  });

  it("phase tones: 100 firings leave nothing once their oscillators end", () => {
    const fake = createFakeEngine();
    for (const [name, tone] of Object.entries(PHASE_TONES)) {
      const first = fake.oscillators.length;
      for (let i = 0; i < 100; i++) tone(fake.engine, 0, `phase-${name}`);
      for (const osc of fake.oscillators.slice(first)) osc.onended?.();
    }
    expect(fake.wetCount()).toBe(0);
  });

  it("a phase tone holds its wet node only until it ends", () => {
    const fake = createFakeEngine();
    PHASE_TONES["hold (steady)"]!(fake.engine, 0, "phase-hold");
    expect(fake.wetCount()).toBe(1);
    for (const osc of fake.oscillators) osc.onended?.();
    expect(fake.wetCount()).toBe(0);
  });
});

describe("stopped sounds release their output", () => {
  it("noise drops its link to the layer when its source ends, not before", () => {
    const fake = createFakeEngine();
    const sound = noiseSound(fake.engine, "pink", "pink");
    sound.start();
    expect(fake.feeding("pink")).toHaveLength(1);
    sound.stop();
    expect(fake.feeding("pink")).toHaveLength(1); // still fading out
    for (const node of fake.nodes) node.onended?.();
    expect(fake.feeding("pink")).toHaveLength(0);
  });

  it("ocean and whale start and stop without throwing and clear their wet entries", () => {
    const fake = createFakeEngine();
    for (const sound of [oceanSound(fake.engine, "ocean"), whaleSound(fake.engine, "whale-b")]) {
      sound.start();
      sound.stop();
      for (const osc of fake.oscillators) osc.onended?.();
      vi.advanceTimersByTime(3000);
    }
    expect(fake.wetCount()).toBe(0);
  });
});
