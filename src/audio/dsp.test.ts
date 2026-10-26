import { describe, expect, it } from "vite-plus/test";
import {
  bubbleCluster,
  bubbleGap,
  bubbleParams,
  createBubbleScheduler,
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
  sliderToGain,
  whalePlan,
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

describe("bubbles", () => {
  it("each bubble glides upward, is short, varies in size and pans slightly", () => {
    const rng = createRng(9);
    const starts = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const b = bubbleParams(rng);
      starts.add(Math.round(b.startHz));
      expect(b.endHz).toBeGreaterThan(b.startHz);
      expect(b.startHz).toBeGreaterThanOrEqual(300);
      expect(b.endHz).toBeLessThanOrEqual(2400);
      expect(b.decay).toBeGreaterThan(0.03);
      expect(b.decay).toBeLessThan(0.3);
      expect(b.gain).toBeGreaterThan(0);
      expect(b.gain).toBeLessThanOrEqual(1);
      expect(Math.abs(b.pan)).toBeLessThanOrEqual(0.6);
    }
    expect(starts.size).toBeGreaterThan(150);
  });

  it("gaps stay in 3 to 14 s and skew toward the short end", () => {
    const rng = createRng(12);
    const gaps = Array.from({ length: 2000 }, () => bubbleGap(rng));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(14);
    const mean = gaps.reduce((a, g) => a + g, 0) / gaps.length;
    expect(mean).toBeGreaterThan(5);
    expect(mean).toBeLessThan(8.5);
    expect(new Set(gaps.map((g) => Math.round(g * 10))).size).toBeGreaterThan(60);
  });

  it("a cluster is one bubble, or 2 to 4 within a second", () => {
    expect(bubbleCluster(() => 0.9)).toEqual([0]);
    const forced = bubbleCluster(() => 0.1);
    expect(forced.length).toBeGreaterThanOrEqual(2);
    expect(forced[0]).toBe(0);
    const rng = createRng(2);
    const sizes = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const c = bubbleCluster(rng);
      sizes.add(c.length);
      expect(c.length).toBeGreaterThanOrEqual(1);
      expect(c.length).toBeLessThanOrEqual(4);
      expect(c[c.length - 1] ?? 0).toBeLessThan(1);
      expect([...c].sort((x, y) => x - y)).toEqual(c);
    }
    expect([...sizes].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it("scheduler keeps events 3 s or more apart, mixes singles and clusters, never double-fires", () => {
    let t = 0;
    const fired: number[] = [];
    const s = createBubbleScheduler({
      rng: createRng(21),
      now: () => t,
      lookahead: 0.5,
      firstDelay: 0.3,
      fire: (at) => fired.push(at),
    });
    for (t = 0; t < 3000; t += 0.1) s.tick();
    expect(fired[0]).toBeCloseTo(0.3, 6);
    expect([...fired].sort((a, b) => a - b)).toEqual(fired);
    // Group bubbles within 1.5 s into events.
    const events: number[][] = [];
    for (const f of fired) {
      const last = events[events.length - 1];
      if (last && f - (last[last.length - 1] ?? 0) < 1.5) last.push(f);
      else events.push([f]);
    }
    for (let i = 1; i < events.length; i++) {
      expect((events[i]?.[0] ?? 0) - (events[i - 1]?.[0] ?? 0)).toBeGreaterThanOrEqual(3);
    }
    expect(events.filter((e) => e.length === 1).length).toBeGreaterThan(20);
    expect(events.filter((e) => e.length >= 2).length).toBeGreaterThan(5);
    expect(events.length).toBeLessThan(3000 / 3);
  });

  it("scheduler reset restarts from now", () => {
    let t = 0;
    const fired: number[] = [];
    const s = createBubbleScheduler({
      rng: createRng(4),
      now: () => t,
      lookahead: 0.2,
      firstDelay: 0.3,
      fire: (at) => fired.push(at),
    });
    t = 100;
    s.reset();
    fired.length = 0;
    s.tick();
    expect(fired).toEqual([]);
    t = 100.2;
    s.tick();
    expect(fired[0]).toBeCloseTo(100.3, 6);
  });
});

describe("whalePlan", () => {
  const rng = createRng(31);

  it("A: humpback song of 3 to 6 contiguous 2 to 6 s glides between 150 and 900 Hz", () => {
    for (let i = 0; i < 100; i++) {
      const p = whalePlan("A", rng);
      expect(p.segments.length).toBeGreaterThanOrEqual(3);
      expect(p.segments.length).toBeLessThanOrEqual(6);
      p.segments.forEach((seg, j) => {
        expect(seg.duration).toBeGreaterThanOrEqual(2);
        expect(seg.duration).toBeLessThanOrEqual(6);
        for (const hz of [seg.startHz, seg.endHz]) {
          expect(hz).toBeGreaterThanOrEqual(150);
          expect(hz).toBeLessThanOrEqual(900);
        }
        if (j > 0) expect(seg.startHz).toBe(p.segments[j - 1]?.endHz);
      });
      expect(p.duration).toBeCloseTo(
        p.segments.reduce((a, g) => a + g.duration, 0),
        9
      );
      expect(p.partials.length).toBeGreaterThanOrEqual(3);
      expect(p.partials[0]).toEqual({ ratio: 1, amp: 1 });
      expect(p.formant).not.toBeNull();
      expect(p.lowpassHz).toBeNull();
    }
  });

  it("B: blue moan has a 20 to 80 Hz fundamental doubled an octave up, and is very slow", () => {
    for (let i = 0; i < 100; i++) {
      const p = whalePlan("B", rng);
      expect(p.duration).toBeGreaterThanOrEqual(8);
      for (const seg of p.segments) {
        expect(seg.startHz).toBeGreaterThanOrEqual(20);
        expect(seg.startHz).toBeLessThanOrEqual(80);
        expect(seg.endHz).toBeGreaterThanOrEqual(20);
        expect(seg.endHz).toBeLessThanOrEqual(80);
      }
      const octave = p.partials.find((q) => q.ratio === 2);
      expect(octave?.amp).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("C: distant call is a quieter, darker, wetter A", () => {
    const a = whalePlan("A", createRng(5));
    const c = whalePlan("C", createRng(5));
    expect(c.segments).toEqual(a.segments);
    expect(c.lowpassHz).toBe(1200);
    expect(c.level).toBeLessThan(a.level);
    expect(c.reverb).toBeGreaterThan(a.reverb);
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

describe("sliderToGain", () => {
  it("squares the slider so the quiet end has fine control", () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(0.5)).toBe(0.25);
    expect(sliderToGain(1)).toBe(1);
  });
});
