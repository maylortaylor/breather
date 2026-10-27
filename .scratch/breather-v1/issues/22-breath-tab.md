Type: build
Status: resolved
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

## Comments
- Built in four commits. `src/ui/BreathTab.tsx` (new), `src/ui/breathLogic.ts` (pure, 100% lines), and small additive edits to `Slider.tsx` (optional `detent`, `ends`, `valueText` props; the Master slider renders as before), `Sheet.tsx` (one import, one line) and `Gate.tsx`.
- Gap closed outside the ticket: the store never saved `mix`, so AC6 could not pass. `store.ts` now writes `mix` to `breather.state` once it differs from the default, and reads it back through `parseState`. Gate restores a saved mix even when no preset id is stored.
- The tempo snap runs on pointer release only. Arrow keys step by 0.025 and stop on 0.5 first, so a key never sticks inside the snap radius. The metronome snaps live below detent 2; its arrow keys jump stop to stop.
- The voice preview plays on its own `metro-preview` layer, so the running beats keep their trims.
- Seconds mode: the hint reads "Inhale about 4s". Disabling the tempo slider there is ticket 23.
- Deferred check from ticket 21 (10-minute steady heartbeat above detent 2) is Matt's, in the foreground.

## Answer
Resolved 2026-10-26. All 8 criteria pass. Matt checked the Breath tab in the browser and approved ("all look good"): the tempo snap, the hint matching the ring, the metronome detents and the voice picker. This also settles the 10-minute steady-beat check deferred from ticket 21. The mix persistence this ticket originally added was dropped in favour of ticket 24's identical change, so one copy of the logic saves both tabs.

### Fix after review, 2026-10-26
Matt found the metronome detent labels overlapping and the slider shifting while dragged. The labels under the interior marks were removed. The current setting is now live text on the label row in a fixed-width box ("Off", "Phase changes", "All beats, quiet", "All beats, louder"), and only "Off" and "Louder" sit under the ends (Tempo: "Slow" and "Fast"). Matt confirmed it looks much better.
