Type: build
Status: open
Blocked by: 21, 26, 28
Model: sonnet

# Keep sound playing on iPhone and resume cleanly after interruptions

Deliver the ticket 07 promise: sound with the ringer on silent, an audio-clock sleep fade, and one tap to resume.

## Context
- Ticket 07 Answer and `docs/research/ios-audio.md` sections 1 to 4 and the v1 promise.
- Spec "Interfaces" `AudioSession` and "Errors and fallbacks" item 3. Module `src/audio/session.ts`.
- `audioSession.type = "playback"`, feature-detected, plus a silent looping `<audio playsinline>` started in the Begin tap (spec question 3 picks its source).
- WebKit's `interrupted` state: resume whenever the state is neither `running` nor `closed`.

## Acceptance criteria
1. On Begin, `navigator.audioSession.type` is set to "playback" when present; a test with a stub shows it set before the context resumes.
2. A silent looping `<audio playsinline>` starts in the same tap, and its source passes the CSP from ticket 28.
3. A `statechange` to `suspended` or `interrupted` sets `audio: "needs-tap"` and shows a "Tap to resume" control.
4. Any tap, and a return to the visible tab, calls `resume()`; a rejected resume keeps the control shown and logs nothing to the screen.
5. After the page wakes, the scheduler skips missed beats; a test with a 30 s clock jump fires no backlog.
6. Media Session metadata is set to "Breather" with the current preset name where supported.
7. Each case is a unit test with a fake context; none needs a device.

## Verify
```sh
npm test
npm run check
npm run build
npm run preview
```
- Matt checks: run the 10 steps in `docs/research/ios-audio.md` section 7 on a real iPhone, in Safari and installed, and record iOS version and each result as a comment on this ticket.
