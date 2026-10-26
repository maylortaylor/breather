Type: research
Status: resolved
Blocked by: none

# What can breather promise about audio on iPhone?

Establish how the silent switch, lock-screen playback and Media Session behave for Web Audio in Safari, and decide what v1 promises.

## Context
- The silent switch can mute Web Audio, and audio may stop when the screen locks (`docs/PLAN.md` Risks).
- The planned mitigation is a silent looping `<audio>` element plus Media Session metadata.
- Lock-screen playback is nice-to-have, not a v1 blocker.

## How to resolve
Type `/research`. Produces a findings file on a `research/ios-audio` branch, ending with a one-paragraph v1 promise.

## Answer
Findings are in [docs/research/ios-audio.md](../../../docs/research/ios-audio.md), researched 2026-10-26. The v1 promise on iPhone:
- **Promised:** sound plays with the ringer switch on silent (`navigator.audioSession.type = "playback"` plus a silent looping `<audio>` fallback). The sleep timer fades on the audio clock, not a JS timer. One tap resumes sound after a call, Siri or an app switch.
- **Not promised:** playback with the screen locked for a full 30 to 90 minute session, lock-screen controls, a running metronome while backgrounded, vibration, or presets surviving 7 idle days outside the installed app.
- **Best effort:** Media Session metadata where it helps, plus a note at the timer to keep the screen on.
- **Unverified:** the ringer-switch claim rests on a WebKit engineer's comment relayed by a blog. A 90 minute locked run and installed-app storage exemption are untested. The test plan in the findings file lists the exact steps to run on a real iPhone.
