Type: build
Status: resolved
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

## Comments

### Device test for Matt (docs/research/ios-audio.md section 7)

Run each in a Safari tab, then installed. Note the iOS version and the result. Not run by the builder: no iPhone was available.

iOS version: ______

| # | Step | Pass if | Safari tab | Installed |
|---|------|---------|------------|-----------|
| 1 | Silent switch: ringer on silent, tap Begin | Noise plays. Remove the `audioSession` line once to confirm it was the fix | | |
| 2 | Lock: play 2 minutes, press the side button | Sound continues 5 minutes; state reads running on unlock | | |
| 3 | 90 minute run: set the timer to 90, lock, leave | Audio fades near the end and is not silent early. Log any early stop | | |
| 4 | Interruption: play, call the phone (or ask Siri), hang up | One tap resumes; "Sound paused. Tap to resume." showed | | |
| 5 | App switch: play, open another app for 30 seconds, return | Resumes without a reload | | |
| 6 | Metronome: play 10 minutes in foreground, lock 2 minutes, unlock | The beat does not burst through a backlog | | |
| 7 | Lock-screen controls: pause from the lock screen, wait 60 seconds, press play | Record the response | | |
| 8 | Cold start (the iOS 26 bug): force-quit the installed app, relaunch, tap Begin, three times | Sound starts each time | | |
| 9 | Vibration: show `"vibrate" in navigator` in a debug line | Expect false | | |
| 10 | Install: Add to Home Screen from `/breather/`, launch in airplane mode | Standalone and offline | | |

### Build notes

- The tap control reads "Sound paused. Tap to resume." (`src/ui/Resume.tsx`), mounted in `Screens` in `src/App.tsx`.
- Lock-screen play and pause have no handlers on purpose, so they cannot fight the sleep timer.
- Step 9 needs a debug line the app does not have; check it from Safari's web inspector on a Mac.

## Answer
Resolved 2026-10-26. All 7 criteria pass against stubs and fake contexts (525 tests). Matt approved merging the code. NOT verified on a real iPhone: silent-switch behaviour, screen lock and the 90-minute run, the interrupted state and one-tap resume, the iOS 26 cold start, and lock-screen controls. The 10-step device checklist stays in the Comments above with an empty result column. It must run after the first HTTPS deploy, because an installed app and a service worker need a secure origin; carried to ticket 32 and ticket 11.
