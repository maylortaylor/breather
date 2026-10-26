Type: build
Status: open
Blocked by: 17, 20
Model: sonnet

# Build the Sounds tab chip palette with volume and LFO rows

Let the listener add and remove sounds from colour chips, each playing sound getting one row with its volume slider and LFO buttons.

## Context
- ADR-0004 Sounds tab; ticket 05 Controls. Only playing sounds have rows.
- Ticket 12 Answer: tapping a colour button (1 teal, 2 violet, 3 amber) turns the slider into a min/max range with the live level filled in that colour; tapping again turns it off. No depth control.
- Spec "State and preset schema": `Mix.sounds`; spec question 2: one music pad at a time.
- One file, `src/ui/SoundsTab.tsx`, using `Slider.tsx` and the `Mixer` from ticket 17.

## Acceptance criteria
1. Chips show the 10 loops grouped Noise, Nature, Music; a playing chip looks clearly on.
2. Tapping an off chip adds a row and fades the sound in over 1.5 s; tapping it again removes the row and fades it out.
3. Picking a second pad replaces the first, with a fade, and only one Music chip is ever on.
4. Each row has one volume slider and the 3 LFO colour buttons; picking one turns the slider into a range filled in that LFO's colour, moving with the live level.
5. Dragging the min handle to 0 under an LFO reaches true silence at the bottom of the swing.
6. Every change updates `mix` in the store and persists; a reload then Begin restores the same rows.
7. Nothing in this tab can raise master volume beyond `MASTER_CAP`.
8. A Sounds tab smoke test with two rows passes `vitest-axe`, and each LFO button has an accessible name with its number and colour.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: build a mix of brown noise, ocean on LFO 3 and a pad; it sounds the same as the approved Lab version.
