# 0004. UI layout and visual style

## Context

Breather has about 15 controls over a moving aurora. Matt wants it simple and colourful, with few controls,
no explanatory chrome and colour that shows state. The resting screen should be calm enough to fall asleep
to, and the app must stay readable at night. It ships as an offline PWA.

## Decision

- **Screens:**
  - First screen: one "Begin" button over the aurora, with one line of safety text (wording from ticket 10).
  - Resting screen: the aurora, a glowing ring with the countdown inside, and the phase word below.
- **Controls:** one sheet component. It is a bottom sheet on phones (about 60% height, with a handle) and a
  right-side panel at 900 px and wider. It has three tabs:
  - Breath (indigo): tempo, metronome, seconds mode.
  - Sounds (forest green): master and the mix.
  - Session (plum): sleep timer, presets, dim mode.
- **Sounds tab:** a palette of colour chips. A chip adds or removes a row with a volume slider and the 3 LFO
  colour buttons from ticket 12. Only playing sounds have rows.
- **Auto-hide:** the sheet closes after 8 s idle. Settings is back at the bottom, as if it had never opened. No
  fade, drift or mask (changed from a 5 s noise-mask dissolve, 2026-10-27).
- **Sleep timer:** a moon icon and "42 min" low in a corner, visible while the sheet is closed, shown only
  while a timer runs.
- **Breath visual:** behind a small interface, like `BackgroundRenderer`. It takes the phase and its
  progress and draws itself. v1 ships the glowing ring only.
- **Palette:** dim, deep colours on near-black navy. LFO colours stay teal, violet and amber, deepened, and
  are never shared with the tab colours.
- **Contrast:** all text passes WCAG AA, with no alpha on any text colour. A test parses the palette and
  asserts the ratios, the approach in roboborealis-platform `docs/DESIGN-ETHOS.md`.
- **Dim mode:** a night setting in Session. The aurora is about 50% darker, text is warmer and dimmer but
  still AA, and nothing is blue-tinted.
- **Font:** Nunito, one self-hosted variable font file.

## Rejected

- **A three.js particle dissolve:** more code and GPU cost than the effect is worth for now. Revisit if the
  CSS version looks flat.
- **One long scrolling list instead of tabs:** it puts every control on screen at once, which is the clutter
  the resting screen avoids.
- **A filled orb for the breath visual:** the glowing ring leaves room for the countdown and reads as softer.
- **A system font:** it changes between platforms and breaks the calm, consistent look.

## Consequences

- The contrast test is part of the build. A palette change that fails AA fails the test.
- Nunito is SIL OFL 1.1. Add it to `THIRD_PARTY.md` as a planned entry, and bundle the licence text with the
  font file.
- The breath-visual interface lets Matt add more visuals later without touching the phase machine.
