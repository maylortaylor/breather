Type: grilling
Status: resolved
Blocked by: none

# How are the controls laid out over the aurora?

Decide the mobile-first control layout and visual hierarchy for mixer, tempo, metronome, timer and presets.

## Context
- Design principle: few controls, slow motion, soft contrast (`docs/PLAN.md` Overview).
- Everything must be hideable: music, effects, metronome and breathing text each turn fully off.
- Dim mode lowers brightness and contrast of both the background and the UI text.

## How to resolve
Type `/grill-me`. Produces a layout description recorded under `## Answer`, with a sketch or wireframe link if one is made.

## Answer
Decided with Matt on 2026-10-25. Taste from ticket 12 applies throughout: simple and colourful, few controls, no explanatory chrome, colour shows state.

### Screens
- First screen: one "Begin" button over the aurora, with room for one line of safety text. The wording comes from ticket 10.
- Resting screen: the aurora, a soft glowing ring with the countdown number inside, and the phase word below it. Nothing else.
- Sleep timer: a tiny moon icon and "42 min" low in a corner. It is dim but passes AA, stays visible while the controls dissolve, and shows only while a timer runs.

### Controls
- One sheet component that changes layout by width: a bottom sheet on phones (about 60% height, with a handle) and a right-side panel at 900 px and wider.
- Three tabs:
  - Breath (deep indigo): tempo, metronome, seconds mode.
  - Sounds (deep forest green): master volume and the mix.
  - Session (deep plum): sleep timer, presets, dim mode.
- Sounds tab: a palette of colour chips. Tap a chip to add that sound as a row with its volume slider and the 3 LFO colour buttons from ticket 12. Tap it again to remove it. Only playing sounds have rows.
- Auto-hide: after 5 s idle the controls dissolve. A CSS noise mask breaks them up while they drift up and to the right with a slight blur, over about 1.5 s, like a dandelion being blown away. Use CSS first, not three.js particles. Any tap or pointer move brings them back with a 0.4 s fade. With reduced motion, use a plain fade.
- Tooltips follow ticket 12: they show after a hover or focus rest, or a long press on touch.
- The breath visual sits behind a small interface, the same pattern as `BackgroundRenderer`. It takes the phase and its progress and draws itself. v1 ships only the glowing ring. Matt wants a few different visuals later.

### Visual style
- Dim, deep colours on a near-black navy. Do not let it be too bright.
- LFO colours stay teal, violet and amber but deepened. They are never shared with the tab colours.
- Font: Nunito, self-hosted as one variable font file. The app is an offline PWA, so there are no Google calls.

### Accessibility
- All text passes WCAG AA.
- No alpha on any text colour. Change the colour instead.
- A test parses the palette and asserts the ratios, the same approach as roboborealis-platform `docs/DESIGN-ETHOS.md`.
- Dim mode is an extra night setting, toggled in Session: the aurora about 50% darker, warmer and dimmer text that still passes AA, and no blue tints.
- Reduced motion turns the dissolve into a plain fade.

Recorded in [ADR-0004](../../../docs/adr/0004-ui-layout-and-visual-style.md).
