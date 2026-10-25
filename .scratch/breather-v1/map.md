# Map: breather v1

## Destination
v1 of the app described in [`docs/PLAN.md`](../../docs/PLAN.md), runnable locally and ready to push.

## Notes
- Local tracker: tickets are files in `issues/`, per `docs/agents/issue-tracker.md`.
- One ticket per session. Claim before working, resolve with an `## Answer`.
- No remote, no push. Maps plan; they do not execute. No personal or client info in tickets.

## Decisions so far
- Breathing timing: 4-7-8 in beats by default, with a seconds toggle.
- Tempo: slow-to-fast slider, no BPM numbers, detent at center = 60 BPM, range 40 to 80, about 28 s per cycle at the slow end.
- Metronome: one slider with detents for off, phase-change only, all beats quiet, louder.
- Sound source: oscillators and generated noise only. Samples only after user review.
- Sleep timer 30 / 60 / 90 min with a long fade-out. Presets built-in plus user-saved.
- Commit identity: GitHub noreply email, see [03](issues/03-commit-identity.md).
- Haptics, PWA and dim mode are in v1.
- Background: aurora borealis first.
- Session length and cycle count: out of v1.

## Not yet specified
- Hosting and repo owner: [01](issues/01-hosting-and-owner.md)
- Stack, tests, Node pin: [02](issues/02-stack-and-tests.md)
- Analytics: [04](issues/04-analytics.md)
- UI layout: [05](issues/05-ui-layout.md)
- Preset contents, half/double buttons, seconds-mode metronome: [06](issues/06-presets-and-controls.md)
- iOS audio promise: [07](issues/07-ios-audio.md)
- Sound quality: [08](issues/08-listening-lab.md)
- Borrowed code and sample licenses: [09](issues/09-license-provenance.md)
- Safety note: [10](issues/10-safety-note.md)
- Definition of v1 and first push: [11](issues/11-v1-gate.md)

## Out of scope
- Session length or cycle count.
- Voice cues for the breathing phases.
- More background themes (deep ocean, nebula, bioluminescence).
- Extra effects such as rain and wind.
- Native iPhone wrapper.
