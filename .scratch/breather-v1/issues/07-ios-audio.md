Type: research
Status: open
Blocked by: none

# What can breather promise about audio on iPhone?

Establish how the silent switch, lock-screen playback and Media Session behave for Web Audio in Safari, and decide what v1 promises.

## Context
- The silent switch can mute Web Audio, and audio may stop when the screen locks (`docs/PLAN.md` Risks).
- The planned mitigation is a silent looping `<audio>` element plus Media Session metadata.
- Lock-screen playback is nice-to-have, not a v1 blocker.

## How to resolve
Type `/research`. Produces a findings file on a `research/ios-audio` branch, ending with a one-paragraph v1 promise.
