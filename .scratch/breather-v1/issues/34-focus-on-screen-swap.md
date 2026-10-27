Type: build
Status: open
Blocked by: 32
Model: sonnet

# Move focus when the screen changes

Welcome to Begin to resting, and "How it works", unmount the focused control, so keyboard and VoiceOver focus drops to the page. Carried from ticket 31's follow-ups.

## Context
- Ticket 31 closed the sheet case (focus returns to the opener or Settings) and left screen swaps open.
- Targets: Begin after "Got it", the ring after Begin, Begin after a sleep timer ends, the Session tab's "How it works" button after the card closes.
- Fix inside `Gate.tsx`, `Ring.tsx` and `SessionTab.tsx`; add no component.

## Acceptance criteria
1. After "Got it", focus is on Begin.
2. After Begin, focus is on the ring button.
3. After a sleep timer ends, focus is on Begin.
4. Closing the reviewed welcome card returns focus to "How it works".
5. `a11y.test.tsx` asserts `document.activeElement` for each of 1 to 4.

## Verify
```sh
npm run check
npm test
npm run build
npm run check:build
```
- Matt checks: tab through welcome, Begin and the ring with VoiceOver on; each swap announces the new control.
