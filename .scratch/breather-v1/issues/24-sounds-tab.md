Type: build
Status: resolved
Blocked by: 17, 20
Model: sonnet

# Build the Sounds tab chip palette with volume and LFO rows

Let the listener add and remove sounds from colour chips, each playing sound getting one row with its volume slider and LFO buttons.

## Context
- ADR-0004 Sounds tab; ticket 05 Controls. Only playing sounds have rows.
- Ticket 12 Answer: tapping a colour button (1 teal, 2 violet, 3 amber) turns the slider into a min/max range with the live level filled in that colour; tapping again turns it off. No depth control.
- Spec "State and preset schema": `Mix.sounds`; Matt answered spec question 2: music pads are independent and can play together.
- One file, `src/ui/SoundsTab.tsx`, using `Slider.tsx` and the `Mixer` from ticket 17.

## Acceptance criteria
1. Chips show the 9 loops grouped Noise, Nature, Music; a playing chip looks clearly on.
2. Tapping an off chip adds a row and fades the sound in over 1.5 s; tapping it again removes the row and fades it out.
3. Any combination of the 3 Music chips can be on at once, each with its own row; turning one off never stops another.
4. Each row has one volume slider and the 3 LFO colour buttons; picking one turns the slider into a range filled in that LFO's colour, moving with the live level.
5. Dragging the min handle to 0 under an LFO reaches true silence at the bottom of the swing.
6. Every change updates `mix` in the store and persists; a reload then Begin restores the same rows.
7. Nothing in this tab can raise master volume beyond `MASTER_CAP`. With all 3 pads and 3 other loops on at default levels the output never clips.
8. A Sounds tab smoke test with two rows passes `vitest-axe`, and each LFO button has an accessible name with its number and colour.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: build a mix of brown noise, ocean on LFO 3 and a pad; it sounds the same as the approved Lab version.

## Comments
- Mix persistence was missing: `breather.state` held no `mix`. `saveState` now stores the mix once it differs from the default, and `loadState` parses it with `parseMix`. Begin (`Gate.tsx`) restores a saved mix even with no preset id. The default mix is not stored, so first launch still starts Sleep.
- `AudioSession` now exposes `modulator`, so the rows read and edit the same LFO state the mixer drives. With no session the tab uses a standalone modulator and still saves the mix.
- `RowVolume` gained two optional props, `lfoColors` and `digitInk`. The tab passes the deepened theme LFO colours and the normal text colour for the button numbers (violet on the surface card is 4.36:1, under AA for text).
- AC7 headroom is an estimate: `mixRmsDb` sums each loop's -30 dBFS trimmed level as uncorrelated power. Three pads plus three loops at default come to about -22 dBFS RMS, 4 dB inside the 18 dB line. It is not a measurement of real output.

## Answer
Resolved 2026-10-26. All 8 criteria pass. Matt checked it in the browser and approved ("all look good"): chips, rows, LFO colour buttons, and the 3 pads together. The headroom check is an estimate (about -22 dBFS RMS with 3 pads and 3 loops at default), confirmed fine by ear. The store now saves an edited mix under `breather.state`.
