Type: build
Status: resolved
Blocked by: 19
Model: sonnet

# Write the tempo mapping and lookahead beat scheduler, and sound the metronome

Schedule metronome voices and phase tones on the audio clock from the phase machine, following the stored tempo and metronome level.

## Context
- Spec "Interfaces": `createBeatScheduler`, tempo functions `sliderToBpm`, `beatSeconds`, `snap`, `metronomeGains`, detents D1 0.2 and D2 0.4.
- PLAN Controls: range 40 to 80 BPM, each half mapped separately, center exactly 60. Metronome slider table.
- `docs/research/ios-audio.md` section 4: timing only from `currentTime`; on wake, skip ahead rather than replay a backlog.
- Ticket 10 Pause: phase tones fade and beats stop while paused. Spec question 1: a phase-change beat plays the phase tone alone.

## Acceptance criteria
1. `src/breath/tempo.ts` tests: slider 0 gives 40 BPM, 0.5 gives exactly 60, 1 gives 80, 0.25 gives 50 and 0.75 gives 70; a cycle is about 28.5 s at 0 and about 14.25 s at 1.
2. `snap` tests: a value within the radius of a detent returns the detent; one outside returns itself.
3. `metronomeGains` tests: 0 is silent; D1 sounds phase changes only; D2 adds other beats very quietly; above D2 both rise and never fall as the level rises.
4. `src/breath/scheduler.ts` tests with a fake clock: each beat fires once; beats fire up to `lookahead` ahead; after a 5 s gap no past beats fire and the next future beat does.
5. The app runs the scheduler on a 25 ms timer, plays the stored voice on ordinary beats and the matching phase tone on phase-start beats, at `metronomeGains` levels.
6. A tempo change from the store mid-cycle reaches the phase machine through `setBeatSeconds` without a jump.
7. Pausing stops new beats and fades any ringing phase tone; resume restarts on the next beat.
8. `tempo.ts` and `scheduler.ts` are in `coverage.include` and the 75% gate passes.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: with the metronome at D2 for 10 minutes in the foreground, the beat stays steady and phase tones land on phase changes.

## Comments

- Loudness: no sound, TRIMS or MASTER_CAP was retuned. `metronomeGains` is a multiplier on the Lab-approved layer trim (`trimOf(id) * gain`, set with `setTrim`). Detent values: phase tone 0.6 at D1 and D2, rising to 1 at level 1; other beats 0.12 at D2 (about -18 dB), rising to 1. Tune by ear.
- Spec mismatch: the spec says the store holds `mix`, but the store had no `mix` yet. This ticket adds `mix` (default `DEFAULT_MIX`) and the Begin tap copies the launch mix into it, so tempo and the metronome come from the store.
- Structure: `src/breath/beats.ts` owns the 25 ms timer and the store subscription; `Breath` starts it in one effect. The ring's tap still pauses the machine; `beats.ts` reacts to `paused` by resetting the scheduler and fading the three phase layers over 0.3 s.
- `scheduler.reset()` keeps a floor at the old horizon, so a tempo change or resume neither repeats a beat that was already handed out nor drops one.
- With the default metronome level the Sleep preset (D1) beats on phase changes only.

## Answer
Resolved 2026-10-26. All 8 criteria pass (225 tests, 97% lines). Matt listened to the phase tones on each phase change and approved. Deferred to ticket 22: the 10-minute steady-beat check with the heartbeat on every beat (criterion 5 beyond phase tones), because the metronome and tempo sliders do not exist until then. Phase-tone gain is 0.6 at detents 1 and 2, rising to 1; other-beat gain is 0.12 at detent 2, rising to 1.
