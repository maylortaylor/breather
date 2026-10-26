Type: build
Status: resolved
Blocked by: 16
Model: sonnet

# Promote the Lab audio into an app mixer and stop the reverb send leak

Drive the approved engine from a `Mix`, with fades, and release every node a stopped sound or finished one-shot leaves behind.

## Context
- Spec "What exists already" and "Module map": `src/audio/mixer.ts` with `diffMix` (pure) and the `Mixer` interface.
- Ticket 12 Comments and Answer: each Play of a reverb sound leaves a send gain node registered. Phase tones with reverb do the same on every phase change.
- Keep `MASTER_CAP` 0.15, `TRIMS` and every sound unchanged; they are approved by ear (ticket 08).
- Ticket 06 Switching: levels glide over 3 s, new sounds fade in over 1.5 s, removed sounds fade out.

## Acceptance criteria
1. `connectOut` returns a disposer, and stopping a loop or ending a one-shot (`onended`) disconnects its send and wet nodes and removes them from the engine's wet list.
2. A test with a fake engine plays and stops a reverb loop 100 times and fires 100 phase tones, and the wet list for each layer ends empty.
3. `diffMix(prev, next)` returns which sounds start, stop and change level or LFO; tests cover add, remove, level change, LFO change and no change.
4. `createMixer(engine, modulator)` implements `apply(mix, { fadeSec })`, `setMaster`, `stopAll(fadeSec)` and `playing()`, and applying the same mix twice starts nothing new.
5. A removed sound fades to silence before its sources stop; it never cuts off.
6. The Lab still runs through the same engine, and every Lab row still plays and stops.
7. `diffMix` is in `coverage.include` and the 75% gate passes.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: in the Lab, play ocean and whale B for a minute each, stop them, and confirm no click on stop and no change in loudness from before.

## Comments
- `createMixer` is not wired into the app yet; the Lab still drives sounds directly, through the same engine. Wiring is for the ticket that builds the Sounds tab and session.
- `Engine` gained `removeWetMod`, `silenceLayer` and an optional `glideSec` on `setLayer` (linear ramp, lands exactly on target). Sound synthesis, `TRIMS` and `MASTER_CAP` are untouched.
- Beyond the wet list, stopped pad voices and shimmer notes, bubble blips and whale call chains now disconnect when they end. Whale calls were never in the wet list.
- `Mixer.stopAll(fadeSec)` and removed sounds ramp the layer to silence, then call `Sound.stop()` 50 ms after the ramp. That `stop()` keeps its own short fade.

## Answer
Resolved 2026-10-26. Criteria 1 to 5 and 7 pass (148 tests, mixer 88% coverage, wet lists empty after 100 bubbles, 100 pads and 300 phase tones). Matt checked criterion 6 by ear in the Lab: ocean and whale B play and stop with no click and no loudness change, the 3 pads blend together, and quick start and stop leaves nothing stuck. The mixer is not wired into the app yet; ticket 18 onward uses it.
