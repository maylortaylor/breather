import { chordHz, MOODS, nextChordIndex, type MoodName } from "./dsp";
import { connectOut, fadeIn, type Engine, type Sound } from "./engine";

const FADE_SEC = 6;
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

interface Voice {
  gain: GainNode;
  oscs: OscillatorNode[];
}

/**
 * Detuned oscillators per chord tone, slow attack and release, a chord change every 20 to 40 s,
 * lowpass and the shared reverb. Deep adds a sparse high shimmer.
 */
export function padSound(engine: Engine, moodName: MoodName, layer: string): Sound {
  const mood = MOODS[moodName];
  const { ctx } = engine;
  let bus: GainNode | null = null;
  let voices: Voice[] = [];
  let chordIndex = 0;
  let changeTimer: ReturnType<typeof setTimeout> | null = null;
  let shimmerTimer: ReturnType<typeof setTimeout> | null = null;

  function playChord(index: number): void {
    if (!bus) return;
    const now = ctx.currentTime;
    for (const old of voices) {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + FADE_SEC);
      for (const o of old.oscs) o.stop(now + FADE_SEC + 0.1);
    }
    const chord = chordHz(mood.chords[index] ?? []);
    voices = chord.map((hz) => {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5 / chord.length, now + FADE_SEC);
      gain.connect(bus as GainNode);
      const oscs = [-mood.detuneCents, 0, mood.detuneCents].map((cents, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 1 ? "sine" : "triangle";
        osc.frequency.value = hz;
        osc.detune.value = cents;
        osc.connect(gain);
        osc.start(now);
        return osc;
      });
      return { gain, oscs };
    });
  }

  function scheduleChange(): void {
    changeTimer = setTimeout(
      () => {
        chordIndex = nextChordIndex(chordIndex, mood.chords.length, Math.random);
        playChord(chordIndex);
        scheduleChange();
      },
      rand(mood.minChangeSec, mood.maxChangeSec) * 1000
    );
  }

  function scheduleShimmer(): void {
    shimmerTimer = setTimeout(
      () => {
        if (!bus) return;
        const root = mood.chords[chordIndex]?.[0] ?? 40;
        const [hz] = chordHz([root + 48 + [0, 7, 12][Math.floor(Math.random() * 3)]!]);
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.frequency.value = hz ?? 880;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.05, t + 2.5);
        env.gain.linearRampToValueAtTime(0, t + 6);
        osc.connect(env).connect(bus);
        osc.start(t);
        osc.stop(t + 6.1);
        scheduleShimmer();
      },
      rand(5, 14) * 1000
    );
  }

  return {
    start() {
      if (bus) return;
      bus = ctx.createGain();
      fadeIn(ctx, bus);
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = mood.cutoffHz;
      bus.connect(lowpass);
      connectOut(engine, lowpass, layer, 0.6);
      chordIndex = Math.floor(Math.random() * mood.chords.length);
      playChord(chordIndex);
      scheduleChange();
      if (mood.shimmer) scheduleShimmer();
    },
    stop() {
      if (!bus) return;
      if (changeTimer) clearTimeout(changeTimer);
      if (shimmerTimer) clearTimeout(shimmerTimer);
      const now = ctx.currentTime;
      const closing = bus;
      closing.gain.setTargetAtTime(0, now, 0.4);
      for (const v of voices) for (const o of v.oscs) o.stop(now + 2.5);
      setTimeout(() => closing.disconnect(), 2600);
      voices = [];
      bus = null;
    },
  };
}
