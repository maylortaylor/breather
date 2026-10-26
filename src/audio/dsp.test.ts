import { describe, expect, it } from "vite-plus/test";
import {
  bubbleParams,
  chordHz,
  createRng,
  createTriggerScheduler,
  makeImpulse,
  makeNoise,
  makeStereoNoise,
  TARGET_RMS,
  midiToHz,
  MOODS,
  nextChordIndex,
  whaleParams,
} from "./dsp";

const SR = 8000;

function peak(a: Float32Array): number {
  return a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
}
function rmsOf(a: Float32Array): number {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
}
/** Mean sample-to-sample change relative to RMS: a cheap measure of high-frequency content. */
function hfRatio(a: Float32Array): number {
  let sum = 0;
  for (let i = 1; i < a.length; i++) sum += Math.abs((a[i] ?? 0) - (a[i - 1] ?? 0));
  return sum / (a.length - 1) / rmsOf(a);
}
function maxStep(a: Float32Array): number {
  let m = 0;
  for (let i = 1; i < a.length; i++) m = Math.max(m, Math.abs((a[i] ?? 0) - (a[i - 1] ?? 0)));
  return m;
}

describe("createRng", () => {
  it("is deterministic per seed and stays in [0, 1)", () => {
    const a = createRng(7);
    const b = createRng(7);
    const seq = Array.from({ length: 50 }, () => a());
    expect(seq).toEqual(Array.from({ length: 50 }, () => b()));
    expect(Math.min(...seq)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seq)).toBeLessThan(1);
  });
});

describe("makeNoise", () => {
  for (const kind of ["white", "pink", "brown"] as const) {
    it(`${kind}: at least 10 s, RMS near -24 dBFS, peak at most 0.9`, () => {
      const buf = makeNoise(kind, SR, 10, createRng(1));
      expect(buf.length).toBe(SR * 10);
      expect(TARGET_RMS).toBeCloseTo(0.063, 3);
      expect(Math.abs(rmsOf(buf) - TARGET_RMS)).toBeLessThan(0.002);
      expect(peak(buf)).toBeLessThanOrEqual(0.9);
      expect(buf.every((v) => Number.isFinite(v) && v >= -1 && v <= 1)).toBe(true);
    });
  }

  it("rejects a loop shorter than 10 s", () => {
    expect(() => makeNoise("white", SR, 9, createRng(1))).toThrow(/10/);
  });

  it("brown is smoother than pink, and pink smoother than white", () => {
    const hf = (k: "white" | "pink" | "brown") => hfRatio(makeNoise(k, 48000, 10, createRng(3)));
    expect(hf("brown")).toBeLessThan(hf("pink"));
    expect(hf("pink")).toBeLessThan(hf("white"));
  });

  it("white is lowpassed: less high-frequency energy than raw white samples", () => {
    const rng = createRng(3);
    const raw = Float32Array.from({ length: 48000 * 10 }, () => rng() * 2 - 1);
    const filtered = makeNoise("white", 48000, 10, createRng(3));
    expect(hfRatio(filtered)).toBeLessThan(hfRatio(raw) * 0.8);
  });

  it("brown has no DC drift (mean close to zero)", () => {
    const buf = makeNoise("brown", SR, 10, createRng(5));
    const mean = buf.reduce((s, v) => s + v, 0) / buf.length;
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });

  it("joins the loop point as smoothly as the interior of the buffer", () => {
    for (const kind of ["pink", "brown"] as const) {
      const buf = makeNoise(kind, SR, 10, createRng(11));
      const join = Math.abs((buf[0] ?? 0) - (buf[buf.length - 1] ?? 0));
      expect(join).toBeLessThanOrEqual(maxStep(buf));
    }
  });
});

describe("makeStereoNoise", () => {
  it("returns two decorrelated channels of equal length", () => {
    const [l, r] = makeStereoNoise("pink", SR, 10, createRng(1), createRng(2));
    expect(l.length).toBe(SR * 10);
    expect(r.length).toBe(l.length);
    let dot = 0;
    for (let i = 0; i < l.length; i++) dot += (l[i] ?? 0) * (r[i] ?? 0);
    const corr = dot / l.length / (rmsOf(l) * rmsOf(r));
    expect(Math.abs(corr)).toBeLessThan(0.05);
  });
});

describe("makeImpulse", () => {
  it("returns two finite channels that decay", () => {
    const [l, r] = makeImpulse(SR, 3, 2.5, createRng(2));
    expect(l.length).toBe(SR * 3);
    expect(r.length).toBe(SR * 3);
    const rms = (a: Float32Array, from: number, to: number) =>
      Math.sqrt(a.slice(from, to).reduce((s, v) => s + v * v, 0) / (to - from));
    for (const ch of [l, r]) {
      expect(ch.every(Number.isFinite)).toBe(true);
      expect(rms(ch, 0, SR / 2)).toBeGreaterThan(rms(ch, SR * 2, SR * 2 + SR / 2) * 5);
      expect(peak(ch)).toBeLessThanOrEqual(1);
    }
  });

  it("is darker in the tail than at the start", () => {
    const [l] = makeImpulse(48000, 3, 1, createRng(8));
    const early = l.slice(0, 14400);
    const late = l.slice(48000 * 2, 48000 * 2 + 14400);
    expect(hfRatio(late)).toBeLessThan(hfRatio(early) * 0.8);
  });

  it("makes the two channels different", () => {
    const [l, r] = makeImpulse(SR, 1, 2, createRng(2));
    expect(l).not.toEqual(r);
  });
});

describe("createTriggerScheduler", () => {
  function setup(rngValue: number) {
    let t = 0;
    const fired: number[] = [];
    const s = createTriggerScheduler({
      rng: () => rngValue,
      now: () => t,
      minGap: 2,
      maxGap: 6,
      lookahead: 1,
      fire: (at) => fired.push(at),
    });
    return {
      s,
      fired,
      advance: (to: number) => {
        t = to;
        s.tick();
      },
    };
  }

  it("fires nothing until the first gap is inside the lookahead window", () => {
    const { fired, advance } = setup(0); // gap is always minGap = 2
    advance(0.5);
    expect(fired).toEqual([]);
    advance(1.2);
    expect(fired).toEqual([2]);
  });

  it("keeps the spacing between triggers and never fires a time twice", () => {
    const { fired, advance } = setup(0);
    advance(1.5);
    advance(1.6);
    advance(10);
    expect(fired).toEqual([2, 4, 6, 8, 10]);
  });

  it("uses the top of the gap range when the rng returns near 1", () => {
    const { fired, advance } = setup(0.999999);
    advance(5.5);
    expect(fired).toHaveLength(1);
    expect(fired[0]).toBeCloseTo(6, 3);
  });

  it("reset drops the pending trigger and restarts from the current time", () => {
    const { s, fired, advance } = setup(0);
    advance(1.5);
    advance(20);
    fired.length = 0;
    s.reset();
    advance(20.5);
    expect(fired).toEqual([]);
    advance(21.5);
    expect(fired).toEqual([22]);
  });
});

describe("bubbleParams and whaleParams", () => {
  it("bubbles glide upward, are short and stay in a watery range", () => {
    const rng = createRng(9);
    for (let i = 0; i < 200; i++) {
      const b = bubbleParams(rng);
      expect(b.endHz).toBeGreaterThan(b.startHz);
      expect(b.startHz).toBeGreaterThanOrEqual(300);
      expect(b.endHz).toBeLessThanOrEqual(2400);
      expect(b.decay).toBeGreaterThan(0.03);
      expect(b.decay).toBeLessThan(0.3);
      expect(b.gain).toBeGreaterThan(0);
      expect(b.gain).toBeLessThanOrEqual(1);
    }
  });

  it("whales are low, long and slowly modulated", () => {
    const rng = createRng(4);
    for (let i = 0; i < 200; i++) {
      const w = whaleParams(rng);
      expect(w.startHz).toBeGreaterThanOrEqual(80);
      expect(w.startHz).toBeLessThanOrEqual(400);
      expect(w.endHz).toBeGreaterThanOrEqual(80);
      expect(w.endHz).toBeLessThanOrEqual(500);
      expect(w.duration).toBeGreaterThanOrEqual(3);
      expect(w.duration).toBeLessThanOrEqual(9);
      expect(w.vibratoHz).toBeLessThan(8);
      expect(w.vibratoDepthHz).toBeLessThan(w.startHz * 0.1);
    }
  });
});

describe("music helpers", () => {
  it("converts MIDI notes to Hz", () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBeCloseTo(220, 6);
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);
  });

  it("defines three moods with 3 to 5 voices per chord and chord changes of 20 to 40 s", () => {
    expect(Object.keys(MOODS).sort()).toEqual(["deep", "dreamy", "tonal"]);
    for (const mood of Object.values(MOODS)) {
      expect(mood.chords.length).toBeGreaterThanOrEqual(2);
      for (const chord of mood.chords) {
        expect(chord.length).toBeGreaterThanOrEqual(3);
        expect(chord.length).toBeLessThanOrEqual(6);
      }
      expect(mood.minChangeSec).toBeGreaterThanOrEqual(20);
      expect(mood.maxChangeSec).toBeLessThanOrEqual(40);
    }
  });

  it("maps a chord to Hz", () => {
    expect(chordHz([69, 81])).toEqual([440, 880]);
  });

  it("never repeats the same chord twice in a row", () => {
    const rng = createRng(6);
    let cur = 0;
    for (let i = 0; i < 200; i++) {
      const next = nextChordIndex(cur, 4, rng);
      expect(next).not.toBe(cur);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(4);
      cur = next;
    }
  });
});
