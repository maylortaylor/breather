# Spec: breather v1

## Goal
Ship v1 of `docs/PLAN.md` as a static, offline PWA at `/breather/`: synthesized sound layers with slow LFOs, a soft metronome, a guided 4-7-8 breath with a glowing ring, and an aurora that breathes with it. Every decision below is settled in ADR-0002 to 0004 and decision tickets 01 to 12. Ticket 13 (sound-reactive aurora) stays out unless its grill pulls it in.

## What exists already (promote, do not rebuild)
- `src/audio/`: `engine.ts` (graph, `MASTER_CAP` 0.15 approved by ear), `catalog.ts` (the approved sound set and `TRIMS`), `dsp.ts` (Voss-McCartney pink noise, impulse, trigger scheduler, chords), `lfo.ts` and `modulation.ts` (3-LFO bank), `metronome.ts` (4 voices, 3 phase tones), `noise.ts`, `pads.ts`, `creatures.ts`. Sounds, trims and levels are approved: do not retune them.
- `src/lab/`: the Listening Lab, kept as a dev-only audition page. `Lfo.tsx` holds the approved range slider (`RowVolume`), colour buttons and `Tip`; `tooltipTimer.ts` holds the 2500 ms and 600 ms timings.
- Tooling: Vite+ 1.4.0, StyleX, vite-plugin-pwa, `scripts/check-build.mjs` (stylex #1918 and precache guard), gitleaks pre-commit, `vp check` and tests pre-push, `scan.yml`.
- Known debt: every Play of a sound with reverb, and every phase tone, pushes a wet gain node into `addWetMod` and never removes it.

## Module map and public interfaces
Few files. A new file earns its place (ADR-0003). Pure modules are marked (pure) and sit under the coverage gate.

| Path | Holds |
|---|---|
| `src/store.ts` | Generic store, persistence, `useStore` |
| `src/presets.ts` (pure) | Schema, built-ins, parse, user-preset edits |
| `src/theme.stylex.ts` | Palette tokens, dim theme |
| `src/audio/mixer.ts` | Mix to engine: start, stop, glide; `diffMix` (pure) |
| `src/audio/session.ts` | Begin gesture, iOS session, resume |
| `src/audio/sleep.ts` | Sleep timer on the audio clock |
| `src/breath/phases.ts` (pure) | Phase machine |
| `src/breath/tempo.ts` (pure) | Tempo map, detent snap, metronome gains |
| `src/breath/scheduler.ts` (pure) | Lookahead beat scheduler |
| `src/breath/Ring.tsx` | `BreathVisual`: the glowing ring |
| `src/background/` | `renderer.ts` (interface, `breathLevel` pure), `aurora.ts` (three.js), `canvas.ts` (fallback) |
| `src/App.tsx` | Screens, error boundary, wiring |
| `src/ui/` | `Gate.tsx` (welcome card and Begin), `Sheet.tsx`, `BreathTab.tsx`, `SoundsTab.tsx`, `SessionTab.tsx`, `Slider.tsx`, `Tip.tsx` |
| `lab.html`, `src/lab/` | Dev-only Lab entry; never in `dist/` |

Interfaces (TypeScript sketches; names are binding, internals are not):
- `createStore<T>(initial)`: `get()`, `set(patch | fn)`, `subscribe(fn): unsubscribe`. React reads through `useStore(selector)` on `useSyncExternalStore`. Audio, breath and renderer subscribe directly.
- `PhaseMachine` (`now` is injected, seconds): `start(t)`, `pause(t)`, `resume(t)`, `setBeatSeconds(s, t)` (accumulates beat position, so a tempo change never jumps), `stateAt(t): BreathState`, `beatsBetween(t0, t1): Beat[]`. `BreathState = { phase: "inhale" | "hold" | "exhale", progress 0..1, countdown, beat, paused }`. `Beat = { at, index, phase, phaseStart }`. Pattern 4, 7, 8; a cycle is 19 beats.
- Phase events: the scheduler's `onBeat(beat)`; `beat.phaseStart` is the phase-change event that drives phase tones and haptics. Visuals poll `stateAt(clock())` per frame, they never get events.
- `createBeatScheduler({ now, machine, lookahead = 0.1, maxCatchUp = 0.25, onBeat })`: `tick()` (call every 25 ms), `reset()`. After a gap longer than `maxCatchUp` it skips past beats rather than replaying them.
- Tempo (pure): `sliderToBpm(v)` maps 0..0.5 to 40..60 and 0.5..1 to 60..80, center exactly 60. `beatSeconds(v, secondsMode)` returns 1 in seconds mode. `snap(v, detents, radius)`. `metronomeGains(level): { phase, beat }`: below detent 2 the level snaps to 0 (off), D1 (phase changes only) or D2 (other beats very quiet); above D2 both rise smoothly. Detent values start at D1 0.2, D2 0.4, tuned by ear.
- `BreathVisual`: `mount(el)`, `draw(state: BreathState)`, `setDim(on)`, `setReducedMotion(on)`, `unmount()`. v1 ships the ring only.
- `BackgroundRenderer` (ADR-0003): `start()`, `setBreath(0..1)`, `setDim(on)`, `resize(w, h)`, `stop()`. `createAurora(canvas, opts)` returns `null` when WebGL is missing, and the host falls back to `createCanvasAurora`. `breathLevel(state)`: inhale rises 0 to 1 eased, hold stays 1, exhale falls to 0.
- `Mixer`: `apply(mix, { fadeSec })`, `setMaster(v)`, `stopAll(fadeSec)`, `playing()`. Loops fade in over 1.5 s; preset switches glide levels over 3 s.
- `AudioSession`: `begin(): Engine` (inside the Begin tap), `onState(fn)`, `resume(): Promise<boolean>`.

## State and preset schema
```ts
type SoundSetting = { lfo: 0 | 1 | 2 | 3; min: number; max: number }; // level is max when lfo is 0
type LfoSetting = { period: number; shape: "sine" | "smooth-random" }; // period 8..120 s
type Mix = {
  sounds: Partial<Record<LoopId, SoundSetting>>; // LoopId: the 9 loop ids in catalog.ts
  lfos: [LfoSetting, LfoSetting, LfoSetting];
  tempo: number; // slider 0..1, 0.5 is 60 BPM
  metronome: { level: number; voice: VoiceId }; // VoiceId: a metro-* id in catalog.ts
};
type Preset = { id: string; name: string; builtIn: boolean; mix: Mix; dim: boolean };
```
Store (in memory): `screen` (`welcome`, `begin`, `resting`), `audio` (`off`, `running`, `needs-tap`, `unsupported`), `mix`, `dim`, `secondsMode`, `master` (default 0.7), `presetId`, `paused`, `sleep` (`{ minutes, endsAt }` on the audio clock, or null), `sheet` (`{ open, tab }`), `welcomeSeen`.

Persisted keys, each JSON with `version: 1`. Every key starts with `breather.` (ticket 04):
- `breather.state`: `{ version, mix, dim, secondsMode, presetId, welcomeSeen }`. Master volume and the sleep timer are never stored.
- `breather.presets`: `{ version, presets: Preset[] }`, user presets only, at most 10, names at most 24 characters.
- `breather.lab.*` stay as the Lab's own keys.

Parsing: `parseState` and `parsePreset` take `unknown`, drop unknown sound ids, clamp numbers to range, and return null for a missing or higher `version`. A null falls back to the defaults. Built-ins (ticket 06 table) live in `presets.ts`; first launch loads Sleep. Seconds mode is a setting, not part of a preset. Music chips are independent: any combination of the 3 pads can play at once (Matt, question 2).

## Errors and fallbacks
1. Storage throws or holds garbage: run from memory with defaults, show nothing.
2. `AudioContext` missing: `audio: "unsupported"`, one calm line, breath and aurora still run on `performance.now()`.
3. Context `suspended` or `interrupted` (iOS): a "Tap to resume" control; any tap or return to the tab calls `resume()`.
4. WebGL missing or context lost: canvas aurora. Canvas fails: the CSS gradient that the Begin screen already uses.
5. Render error: an error boundary shows a calm screen with a reload button; the error goes to the console only (ticket 04).
6. No `navigator.vibrate`: skip silently.

## Testing (ADR-0003)
- Test-first with a 75% gate on pure logic: `phases`, `tempo`, `scheduler`, `presets`, `diffMix`, `breathLevel`, plus the existing `dsp`, `lfo`, `tooltipTimer`. Each ticket adds its file to `coverage.include` in `vite.config.ts`.
- Time is always injected (`now`, fake timers); no test sleeps. Tests assert values, never mere existence.
- UI: one smoke test per screen and tab with React Testing Library on jsdom, each run through `vitest-axe`.
- Drift guards: `theme.test.ts` parses the palette for AA ratios and alpha on text; a storage test asserts the `breather.` prefix; `check-build.mjs` asserts the CSP, precache, and no Lab in `dist/`.
- Gate per ticket: `npm run check`, `npm test`, `npm run build`, `npm run check:build`.

## v1 definition of done
1. A first visit shows the welcome card; "Got it" leads to Begin with the safety line; later visits show only Begin and the safety line.
2. Begin starts the Sleep mix (first launch) or the last mix, at default master volume, with no click or burst.
3. The ring follows 4-7-8 in beats; the tempo slider moves the cycle from about 28 s to about 14 s, and its center snaps to 60 BPM.
4. Tapping the ring pauses and resumes the guide; background sounds keep playing.
5. The metronome detents behave as in PLAN Controls, and timing stays steady for 10 minutes in the foreground.
6. Seconds mode runs 4, 7, 8 seconds, ticks once a second and disables the tempo slider with a tooltip.
7. The Sounds tab adds and removes any of the 9 loops, each with a volume slider and the 3 LFO colour buttons.
8. Built-in and user presets apply with a 3 s crossfade; built-ins are read-only and offer "Save as new".
9. A 30, 60 or 90 minute sleep timer fades everything on the audio clock, then stops audio and animation.
10. The aurora breathes with the phase, dims in dim mode, slows under reduced motion, and pauses in a hidden tab.
11. The sheet dissolves after 5 s idle and returns on any tap or pointer move.
12. The app installs from `/breather/` and runs offline with a CSP of `default-src 'self'`.
13. All text passes AA in both themes, enforced by a test; vitest-axe passes on every screen.
14. Matt has listened and looked on a desktop browser and an iPhone, and the iOS test plan results are recorded.

## Out of scope
Session length or cycle count, voice cues, a tips panel, analytics, preset export or import, LFO period and shape controls in the app (presets still store them), more themes or breath visuals, extra effects, a native wrapper, sound-reactive aurora (ticket 13), the first push and the platform Caddy rule (ticket 11).

## Open risks
- `vitest-axe` and jsdom under the Vite+ bundled Vitest are untried; ticket 14 proves it first.
- iOS behaviour is unverified until Matt runs the test plan in `docs/research/ios-audio.md` section 7.
- The CSP meta must not land in dev, where Vite injects inline scripts; it is added at build only.
- A three.js shader on low-end phones may miss 30 fps; the reduced-resolution path is the mitigation.
- The silent keep-alive needs a source: a generated blob URL adds `media-src blob:` to the CSP (question 3).

## Answered by Matt on 2026-10-26
1. A phase-change beat plays the phase tone alone, without the metronome voice.
2. Music pads are independent chips: any combination of the 3 can play together. This replaces the one-at-a-time default.
3. The iPhone keep-alive audio is a silent WAV generated as a blob URL. The CSP gains `media-src blob:`. No audio file is committed.
4. The sleep timer fades out over its last 5 minutes.
5. Placeholder icons ship in v1. Matt will find or make an icon pack later.
6. No Screen Wake Lock. The app only shows a note telling the listener to keep the screen on.
