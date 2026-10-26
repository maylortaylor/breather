Type: build
Status: resolved
Blocked by: 18
Model: sonnet

# Add the 4-7-8 phase machine and the glowing breath ring, with tap to pause

Run the breath on the audio clock and draw it as a ring with the countdown inside and the phase word below.

## Context
- Spec "Interfaces": `PhaseMachine`, `BreathState`, `Beat`, `BreathVisual`. ADR-0003 Tests: the phase machine is test-first with injected time.
- ADR-0004 Breath visual: behind a small interface; v1 ships the ring only. Resting screen is aurora, ring, phase word, nothing else.
- Ticket 10 Pause: tapping the ring freezes the countdown, background sounds keep playing, a second tap resumes.
- Tempo stays fixed at 60 BPM until ticket 21; the clock is `ctx.currentTime`, or `performance.now()` with no audio.

## Acceptance criteria
1. `src/breath/phases.ts` passes tests for: phase and countdown at chosen times; a 19-beat cycle; `setBeatSeconds` mid-phase keeps the current position (no jump); pause and resume freeze and continue the position.
2. `beatsBetween(t0, t1)` returns every beat in the window once, with `phaseStart` true on beats 0, 4 and 11 of each cycle.
3. `src/breath/Ring.tsx` implements `BreathVisual`: the ring grows over inhale, holds, and shrinks over exhale, with the countdown inside and the phase word below.
4. Phase words read "Breathe in through your nose", "Hold" and "Breathe out slowly through your mouth".
5. Tapping the ring pauses the countdown and the ring; tapping again resumes from the same beat. Background sounds play throughout.
6. A tap outside the ring does not pause.
7. Under `prefers-reduced-motion`, the ring changes size without easing flourishes or glow pulses.
8. `phases.ts` is in `coverage.include` and the 75% gate passes; a ring smoke test passes `vitest-axe`.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: breathe along for three cycles; the ring and countdown feel even, and pause and resume land on the same beat.

## Comments
- Built on build/19-phase-machine-and-ring (3 commits). Ring is a React component plus a `createRing()` BreathVisual; the machine lives in `Breath` until ticket 21 shares it with the scheduler.
- Added `getSession()` to `src/audio/session.ts` so the ring reads `ctx.currentTime`.
- Not checked in a real browser from this session (no browser extension); the CSS custom properties are confirmed in the built CSS.

## Answer
Resolved 2026-10-26. All 8 criteria pass (193 tests, 97% statements). Matt checked it in the browser: the ring, countdown, pause and resume, and the phase words all look good. Carry forward: ticket 21 must share the phase machine with the beat scheduler (the `Breath` component holds it today), and `beatsBetween` is only valid for windows after the last start, resume or tempo change.
