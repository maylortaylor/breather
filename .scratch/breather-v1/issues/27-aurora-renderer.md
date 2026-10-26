Type: build
Status: claimed
Blocked by: 19
Model: sonnet

# Render the aurora with three.js, a canvas fallback and the breath uniform

Replace the placeholder gradient with a slow aurora that brightens on inhale and dims on exhale.

## Context
- ADR-0003 Background: three.js plus a canvas 2D fallback behind `BackgroundRenderer` (`start`, `setBreath`, `setDim`, `resize`, `stop`). Spec "Interfaces" and `breathLevel`.
- PLAN Aurora background: green, teal, violet curtains, faint stars, 30 fps cap, pause when hidden, reduced resolution on weak devices, slow under reduced motion.
- `AGENTS.md` third-party rule 1 and `docs/research/license-provenance.md` section 1: write the shader from scratch, never port Shadertoy code.
- ADR-0004 Dim mode: the aurora about 50% darker. Ticket 13 (sound-reactive) stays out.

## Acceptance criteria
1. `three` is an exact-pinned dependency, MIT, logged in `THIRD_PARTY.md`.
2. `breathLevel` tests: 0 at inhale start, 1 at inhale end and through hold, back to 0 at exhale end, never outside 0..1.
3. The shader carries one comment saying it is written from scratch with no third-party code.
4. The aurora brightens and swells upward on inhale, holds, and dims and drifts down on exhale, following the phase machine.
5. Frames are capped at 30 fps; a hidden tab renders no frames, and the loop resumes on return.
6. With WebGL disabled, the canvas fallback runs; if that fails, the CSS gradient shows. No error reaches the screen.
7. A lost WebGL context switches to the canvas fallback without a reload.
8. Dim mode darkens the aurora by about half; reduced motion slows it and lowers the amplitude.
9. `breathLevel` is in `coverage.include` and the 75% gate passes.

## Verify
```sh
npm test
npm run check
npm run build
npm run check:build
npm run dev
```
- Matt checks: watch three cycles on a desktop and a phone; it is calm, the breath sync reads, and the phone stays cool.
