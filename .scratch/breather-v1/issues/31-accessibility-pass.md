Type: build
Status: open
Blocked by: 23, 26, 27
Model: sonnet

# Run an accessibility pass over every screen, tab and control

Confirm the whole app works by keyboard and screen reader, honours reduced motion, and passes AA in both themes.

## Context
- ADR-0004 Contrast and Dim mode; ticket 05 Accessibility; ticket 10 safety line read before Begin.
- Ticket 12: tooltip text is always linked through `aria-describedby`.
- Spec "Testing": one smoke test per screen and tab through `vitest-axe`; the contrast test from ticket 15.
- Fix what this finds inside the existing files; add no new component.

## Acceptance criteria
1. Every screen and tab, in normal and dim theme, passes `vitest-axe` with no violations.
2. Tab order runs welcome card, Begin, then ring, sheet tabs and controls in reading order; focus is always visible.
3. Every slider has an accessible name and an `aria-valuetext` in words; LFO buttons announce their number, colour and on state.
4. Every tooltip is linked through `aria-describedby`, and the text is present before it shows.
5. Escape closes the sheet; focus returns to where it was.
6. With `prefers-reduced-motion`, the ring, dissolve and aurora all use their reduced forms, shown by a test per piece.
7. Phase changes are announced once per phase through a polite live region, not every countdown number.
8. The contrast test passes, and no text colour uses alpha.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: use the app with VoiceOver for one full cycle and one preset switch; nothing is unlabelled or chatty.
