Type: build
Status: open
Blocked by: 22
Model: sonnet

# Add seconds mode and the haptic pulse on phase changes

Let the breath run a fixed 4, 7, 8 seconds, and buzz gently on each phase change where the device allows it.

## Context
- Ticket 06 Seconds mode: ticks once a second, tempo slider disabled with a tooltip saying why. CONTEXT.md "Seconds mode".
- Spec "Interfaces": `beatSeconds(v, secondsMode)` returns 1 in seconds mode. Seconds mode persists in `breather.state`, not in presets.
- PLAN v1 features, Haptics; `docs/research/ios-audio.md` section 5: no vibration on iOS, feature-detect and skip.
- Spec "Errors and fallbacks" item 6.

## Acceptance criteria
1. A seconds-mode switch in the Breath tab makes inhale, hold and exhale last 4, 7 and 8 seconds whatever the tempo slider says.
2. In seconds mode the metronome ticks once a second, following the same detent levels.
3. The tempo slider is disabled in seconds mode, and its tooltip says it is off because seconds mode is on.
4. Turning seconds mode off returns to the slider's tempo without a jump in the current phase.
5. Seconds mode persists across a reload.
6. On a phase-start beat, `navigator.vibrate` is called once with a short pulse, timed to the beat; a test with a stub shows one call per phase change.
7. With `vibrate` absent, nothing throws and nothing is shown, shown by a test.
8. While paused, no vibration fires.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: on an Android phone if one is handy, the pulse is soft and lands on phase changes; otherwise note it as untested on the ticket.
