Type: build
Status: open
Blocked by: 25
Model: sonnet

# Add the sleep timer with an audio-clock fade and the corner moon

Fade every layer to silence at the end of 30, 60 or 90 minutes, scheduled on the audio clock so a frozen page still fades.

## Context
- PLAN v1 features, Sleep timer. ADR-0004 Sleep timer: moon icon and "42 min" low in a corner, visible while the sheet is dissolved, only while a timer runs.
- `docs/research/ios-audio.md` section 4: never `setTimeout` for the fade; ramp the master gain on `currentTime`, store the end as a clock value.
- Ticket 07: a note at the timer to keep the screen on. Spec question 4: the fade covers the last 5 minutes.
- Module `src/audio/sleep.ts`; controls in `SessionTab.tsx`. The timer is never persisted (ticket 06).

## Acceptance criteria
1. The Session tab offers 30, 60 and 90 minutes and a Cancel; starting one schedules the master ramp on the audio clock at once.
2. A test with a fake `AudioParam` shows the ramp scheduled from end minus 5 minutes to end, and Cancel restores the master level.
3. The corner moon shows minutes left, updates each minute, stays visible while the sheet is dissolved, and is gone with no timer.
4. At the end, audio stops, the animation loop stops, and the app returns to the Begin screen.
5. The timer section shows a short note to keep the screen on for the timer to finish.
6. A reload clears any timer, and master volume returns to its default.
7. Dev builds only offer a 2-minute timer for testing; `check-build.mjs` fails if it appears in `dist/`.
8. The moon and timer controls pass AA and `vitest-axe`.

## Verify
```sh
npm test
npm run check
npm run build
npm run check:build
npm run dev
```
- Matt checks: run the 2-minute dev timer; the fade is gentle and the ending is calm.
