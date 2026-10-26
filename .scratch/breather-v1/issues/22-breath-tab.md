Type: build
Status: claimed
Blocked by: 20, 21
Model: sonnet

# Fill the Breath tab with the tempo slider, metronome slider and voice picker

Give the listener control of speed, metronome level and beat sound, all in the indigo Breath tab.

## Context
- PLAN Controls, Tempo slider and Metronome slider. Ticket 06: heartbeat thump is the default voice.
- Ticket 08 Answer: four voices, heartbeat thump, wood block, soft tick 700 Hz, soft tick 350 Hz.
- Spec "Interfaces": `snap` and detents from ticket 21; `Slider.tsx` from ticket 20 gains a detent option.
- One file, `src/ui/BreathTab.tsx`. No BPM numbers anywhere (PLAN Tempo slider).

## Acceptance criteria
1. The tempo slider is labelled Slow and Fast, shows a visible center mark, and snaps to exactly 0.5 when released near it.
2. Below the tempo slider a live hint reads "Inhale about Ns", rounded to the nearest second, and changes as the slider moves.
3. No BPM number appears in the UI or in any accessible name; `aria-valuetext` reads a phrase such as "Slow" or "Resting pace".
4. The metronome slider shows marks for off, phase changes and all beats, and snaps to them below detent 2; above it, it moves freely.
5. The voice picker offers the four voices by name; picking one plays it once as a preview and stores it.
6. Every change persists to `breather.state` and survives a reload.
7. Arrow keys move both sliders and respect the detents.
8. A Breath tab smoke test passes `vitest-axe`.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: drag tempo to each end and back to center; the snap is felt, the hint matches the ring, and the metronome detents sound as the PLAN table says.
