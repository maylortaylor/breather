Type: build
Status: resolved
Blocked by: 15, 17
Model: sonnet

# Build the Begin screen, the first-run welcome card and the safety line

Give the app its first real screens: a welcome card on first launch, then Begin, which starts the restored mix.

## Context
- ADR-0004 Screens. Ticket 10 Answer: exact copy for the safety line, the welcome card title, line and three steps, and "Got it".
- Ticket 04 Storage notice: the storage line sits on the welcome card; ticket 10 merges it so first run is one screen.
- Spec "Interfaces" `AudioSession.begin()` and "Errors and fallbacks" item 2. One component file, `src/ui/Gate.tsx`.
- A CSS gradient stands in for the aurora until ticket 27.

## Acceptance criteria
1. First launch shows the welcome card with the ticket 10 copy word for word, the storage line and one "Got it" button.
2. "Got it" sets `welcomeSeen`, persists it, and shows the Begin screen; a reload then shows Begin directly.
3. The Begin screen shows one "Begin" button with the safety line beneath it; a screen reader reaches the safety line before the button.
4. Begin creates and resumes the audio context inside the tap and starts the mix from `restoreLaunch`: Sleep on first launch.
5. With `AudioContext` removed in a test, Begin shows one calm "sound is not available" line and the app still moves to the resting screen.
6. The safety line has no "don't show again" control, and it appears on every launch, shown by a test.
7. Smoke tests for the welcome card and the Begin screen pass `vitest-axe`.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Clear site data, load `/breather/`, follow the card, tap Begin.
- Matt checks: the Sleep mix starts softly, with no burst, and the copy reads right.

## Comments
- Added `src/audio/session.ts` (in the spec module map) for the Begin gesture: it makes and resumes the context inside the tap, builds the modulator and mixer, and applies the restored mix over a 3 s fade. Statuses go to `store.audio`.
- Added `src/test-setup.ts`: tests skip the StyleX plugin, so the setup file stubs `@stylexjs/stylex` under jsdom.
- `breather.state` does not store a mix yet, so Begin starts Sleep until a preset id is saved; then it passes the saved state to `restoreLaunch`.
- `src/Palette.tsx` is reachable only in dev at `/breather/#palette`.
- The resting screen is a placeholder ("Breathe.") until tickets 19 and 20.

## Answer
Resolved 2026-10-26. All 7 criteria pass (161 tests, 97% statements). Matt checked it in the browser: the welcome card, "Got it", reload straight to Begin, and the copy all look good. The resting screen is a placeholder until tickets 19 and 20.
