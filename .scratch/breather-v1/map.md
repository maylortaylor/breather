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
- Sound set: all synthesized, no samples; approved list in [08](issues/08-listening-lab.md).
- Volume LFOs: 3 colour-coded slow waves, min/max range slider, see [12](issues/12-volume-lfos.md).
- Sleep timer 30 / 60 / 90 min with a long fade-out. Presets: Sleep, Focus, Reset plus 10 user ones, see [06](issues/06-presets-and-controls.md).
- Commit identity: GitHub noreply email, see [03](issues/03-commit-identity.md).
- Hosting: `roboborealis.com/breather/`, Caddy proxy to GitHub Pages, see [01](issues/01-hosting-and-owner.md).
- Stack: Vite+, React 19, three.js, StyleX, hand-rolled store, Vitest, see [02](issues/02-stack-and-tests.md).
- UI: resting screen is aurora plus breath ring, controls in a dissolving sheet with 3 tabs, see [05](issues/05-ui-layout.md).
- Haptics, PWA and dim mode are in v1. iPhone promise: [07](issues/07-ios-audio.md). Licence rules: [09](issues/09-license-provenance.md).
- Privacy: no analytics, no cookies, CSP enforced, see [04](issues/04-analytics.md).
- Background: aurora borealis first.
- Session length and cycle count: out of v1.

## Not yet specified
- Safety note: [10](issues/10-safety-note.md)
- Definition of v1 and first push: [11](issues/11-v1-gate.md)

## Out of scope
- Session length or cycle count.
- Voice cues for the breathing phases.
- More background themes (deep ocean, nebula, bioluminescence) and more breath visuals.
- Extra effects such as rain and wind.
- Native iPhone wrapper.
- Sound-reactive aurora, unless [13](issues/13-sound-reactive-aurora.md) pulls it in.
