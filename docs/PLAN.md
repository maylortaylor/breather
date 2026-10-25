# Calm Soundscape + 4-7-8 Breather — Build Plan

Canonical copy. Exported from the Claude Doc on 2026-10-25; edit here, not there.

Oct 25, 2026 · @Maylor Taylor

## Overview

A small, installable static web app for winding down: layered synthesized sound, an optional soft metronome, a guided 4-7-8 breath, and a slow aurora background that breathes with you. Every sound is generated live with the Web Audio API, so the first version ships with no audio files.

**Purpose:** help the user meditate, remind them of the 4-7-8 technique, and wash the noise out of the day.

**Design principles**

- Calm over clever: few controls, slow motion, soft contrast.
- No audio files in v1. Samples are a per-sound fallback only after the user has listened and approved.
- Everything is optional: music, effects, metronome and breathing text can each be turned fully off.
- Works offline and installs like an app (PWA).

## Decisions

Locked decisions are from the user. Assumed defaults are the planner's recommendation and are still open; the implementing agent should build with them and make them easy to change.

| Topic | Decision | Status |
| --- | --- | --- |
| Breathing timing | 4-7-8 counted in beats by default, with a seconds toggle | Locked |
| Tempo control | Slow-to-fast slider, no BPM numbers, detent at center = 60 BPM | Locked |
| Slow-end cycle length | About 28 seconds per full cycle feels right | Locked |
| Metronome volume | Single slider with detents (see Controls) | Locked |
| Sound source | Oscillators and generated noise only; samples only after user review | Locked |
| Sleep timer | 30 / 60 / 90 minutes, long fade-out | Locked |
| Presets | Built-in plus user-saved | Locked |
| Haptics, PWA, dim mode | In v1 | Locked |
| Background | Aurora borealis first | Locked |
| Session length / cycle count | Out of v1 | Locked |
| Hosting | Standalone repo on GitHub Pages, linked from roboBOREALIS.com | Assumed |
| Half/double buttons | Dropped; the tempo slider covers speed | Assumed |
| iPhone lock-screen playback | Nice-to-have; test on a real device after the core works | Assumed |

## Architecture

A static single-page app with no backend. Suggested stack: Vite, React and TypeScript (plain JS is acceptable if the agent prefers a tiny bundle).

- **Hosting:** its own GitHub repo deployed to GitHub Pages, linked from roboBOREALIS.com.
- **State:** one store holding mixer levels, tempo, metronome level, sound choice, dim mode and presets, persisted to localStorage.
- **PWA:** web manifest plus a service worker that precaches the app shell so it works offline.
- **Audio:** one shared `AudioContext`, created on the first tap of a "Begin" button because browsers block autoplay.

Audio graph:

```text
music pads ---> music gain ----+
noise (white/pink/brown) -> gain each ---+
ocean / bubbles / whales -> gain each ---+--> master gain --> limiter (compressor) --> output
metronome voices --------> metronome gain +
reverb send (convolver, generated impulse) shared by pads and whales
```

The sleep timer ramps the master gain to zero, so every layer, including the metronome, fades together.

## Sound design

All sounds are synthesized. Each layer has its own volume slider (0 = silent) feeding the master. Starting points below are suggestions to tune by ear.

| Sound | Synthesis approach |
| --- | --- |
| White noise | Looping buffer of random samples, 10+ seconds long to avoid audible seams |
| Pink noise | Same, filtered with a standard pinking filter (Paul Kellet or similar) |
| Brown noise | Integrated white noise with leak, normalized |
| Ocean waves | Pink or brown noise through a lowpass whose cutoff and gain follow a slow LFO (roughly 8 to 14 seconds per swell), plus a faint highpassed hiss on the crest |
| Underwater bubbles | Randomly timed short sine blips with a quick upward pitch glide and fast decay, through a lowpass and light reverb |
| Whale calls | Sine and triangle oscillators with slow pitch glides and vibrato, through a bandpass and a long reverb, triggered at random long intervals |
| Music pads | 3 to 5 detuned oscillators per chord tone, slow attack and release, chord changes every 20 to 40 seconds, lowpass and convolver reverb |

**Music presets:** Dreamy (wide, airy, major 7th and 9th voicings), Tonal (simple, stable open fifths and suspended chords), Deep (low drones with sparse high shimmer).

**Review workflow:** build a Listening Lab page first, one play button and one volume slider per sound, so the user can judge each before the main UI exists. If a sound fails the user's ear (whales are the likeliest), propose a small CC0 sample for that sound only.

## Controls

### Tempo slider

- Labeled Slow to Fast, with no BPM numbers shown.
- A visible detent at the exact center that snaps there; center = 60 BPM, the resting point.
- Internal range is 40 to 80 BPM. Map each half of the slider separately (left half 40 to 60, right half 60 to 80) so the center stays at exactly 60.
- Show a small live hint of the current phase length, for example "Inhale about 4s".
- Tempo drives both the metronome and the breathing phases (beats mode). A cycle is 19 beats, so the slowest setting (40 BPM) gives about 28 seconds, which the user confirmed feels right; 60 BPM gives 19 seconds; the fastest (80 BPM) gives about 14 seconds.

### Metronome slider

One slider controls both whether the metronome sounds and how loud it is.

| Position | Behavior |
| --- | --- |
| Far left | Off completely |
| Detent 1 | Sound only on phase changes (inhale, hold, exhale, then back to inhale) |
| Detent 2 | Adds the other beats at a very low volume |
| Past detent 2 | Smoothly raises the volume of all beats |

- Each breathing phase has its own tone so the user can hear where they are in the breath.
- Swappable beat sounds: soft tick, wood block, bell, heartbeat thump. All synthesized.
- Use a lookahead scheduler (a short JS timer that schedules notes on the audio clock a fraction of a second ahead) for steady timing.

### Other controls

- Master volume, plus a separate volume for music and for each effect.
- Sleep timer (30 / 60 / 90 minutes), presets menu, dim mode toggle, and a seconds-mode toggle for breathing.

## Breathing guide

A three-phase loop driven by the same clock as the metronome: Inhale for 4 beats, Hold for 7 beats, Exhale for 8 beats, then repeat. Beats mode is the default; a toggle switches to fixed seconds (4 / 7 / 8) independent of the tempo slider.

| Phase | Beats | On-screen text | Visual cue |
| --- | --- | --- | --- |
| Inhale | 4 | "Breathe in through your nose" plus a countdown | Circle expands, aurora brightens and swells |
| Hold | 7 | "Hold" plus a countdown | Circle stays still, aurora steady |
| Exhale | 8 | "Breathe out slowly through your mouth" plus a countdown | Circle contracts, aurora dims and drifts |

- Text and visuals only in v1. Voice cues are a future audio layer.
- Phase changes trigger the metronome phase tones (if enabled) and a haptic pulse.
- A short tips panel can show technique reminders, such as resting the tongue behind the upper front teeth.
- Phase state lives in one small state machine that the UI, aurora shader, haptics and metronome all subscribe to.

## Aurora background

The first theme is an aurora borealis: soft vertical curtains of green, teal and violet over a dark night sky with faint stars.

- **Rendering:** a full-screen WebGL fragment shader using layered noise for slow, rippling curtains. Fall back to a canvas gradient animation if WebGL is unavailable.
- **Breath sync:** a single `breath` uniform from 0 to 1 follows the phase state machine. It rises during inhale (brighter, curtains swell upward), holds during hold, and falls during exhale (dimmer, curtains drift down).
- **Performance:** cap the frame rate (30 fps is plenty), pause when the tab is hidden, and render at reduced resolution on weak devices.
- **Accessibility:** honor `prefers-reduced-motion` with a much slower, lower-amplitude animation.
- **Dim mode:** lower brightness and contrast of both background and UI text for night use. Persist the choice.
- **Theming:** structure the shader so more themes can be added later (for example deep ocean or bioluminescence).

## v1 features

- **Sleep timer:** 30, 60 or 90 minutes. Ends with a long, gentle fade of the master gain, then stops audio and the animation loop. Show the remaining time subtly and allow cancel.
- **Presets:** a few built-ins (Sleep, Focus, Reset) plus user-saved mixes. A preset stores all slider levels, tempo, metronome level and sound, music mood, and dim mode.
- **Haptics:** a soft vibration pulse on each phase change using the Vibration API. This works on Android only; Safari on iPhone does not support it, so feature-detect and fail silently.
- **PWA:** web manifest, icons, and a service worker that precaches the app shell so it works offline and can be installed.
- **Dim mode:** see Aurora background.
- **Start gate:** a "Begin" button creates and resumes the audio context, since browsers require a user gesture.

## Risks and flags

| Risk | Mitigation |
| --- | --- |
| iOS audio: the silent switch can mute Web Audio, and audio may stop when the screen locks | Play a silent looping `<audio>` element alongside the context and set Media Session metadata; test on a real iPhone. Lock-screen playback is nice-to-have, not a v1 blocker |
| Haptics unavailable on iPhone | Android only; feature-detect and skip silently |
| Synthesized whales and waves may sound fake | Review in the Listening Lab first; swap in small CC0 samples per sound only if the user asks |
| Many layers can clip | Per-layer gain, a master gain cap, and a compressor used as a limiter |
| Noise loops can click or seam | Use long buffers and fade the loop point |
| Battery and CPU from the shader and audio | Frame cap, pause when hidden, reduced-resolution fallback, reduced-motion support |
| Constant ticking over a 19-beat cycle can feel busy | Default the metronome slider to the phase-change detent; each phase has its own tone |

## Build phases

Build in this order. Stop after phase 2 for the user to listen and give feedback before continuing.

1. **Audio engine:** shared context, Begin gate, per-layer gains, master gain, limiter. *Done when* a test tone plays and master volume works.
2. **Listening Lab:** a plain page with a play button and slider for each noise and nature sound. *Done when* the user can audition every sound and approve or reject it.
3. **Metronome:** lookahead scheduler, tempo slider with center detent, metronome detent slider, swappable sounds. *Done when* timing stays steady for 10 minutes and the detents behave as specified.
4. **Breathing guide:** phase state machine in beats mode, seconds toggle, text and countdown UI. *Done when* the 4-7-8 phases track the tempo slider correctly.
5. **Aurora shader:** WebGL background with breath sync, dim mode, reduced-motion and hidden-tab handling.
6. **Music pads:** generative pads and mood presets.
7. **Polish:** presets, sleep timer, haptics, PWA, offline test, and iPhone testing.

## Out of scope and later ideas

- Session length or cycle count (explicitly out of v1).
- Recorded or synthesized voice cues for the breathing phases.
- Additional background themes: deep ocean caustics, nebula, bioluminescence.
- Extra effects such as rain and wind.
- Native iPhone wrapper for haptics and reliable lock-screen audio.
- Sample-based replacements for any synthesized sound the user rejects.
