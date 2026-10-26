Type: build
Status: claimed
Blocked by: 19
Model: sonnet

# Build the controls sheet with three tabs, the dissolve and the responsive panel

One sheet holds every control: a bottom sheet on phones, a right panel on wide screens, and it dissolves when idle.

## Context
- ADR-0004 Controls and Auto-hide. Ticket 05 Controls: Breath indigo, Sounds forest green, Session plum.
- Ticket 10 welcome step 3: swipe up, or tap the screen, to open the controls. A tap on the ring still pauses (ticket 19).
- Promote `Tip` and `RowVolume` from `src/lab/Lfo.tsx` into `src/ui/Tip.tsx` and `src/ui/Slider.tsx`, and `tooltipTimer.ts` into `src/ui/`; the Lab imports them from there (ticket 12 tooltip rules).
- Files: `src/ui/Sheet.tsx`, `Slider.tsx`, `Tip.tsx`. Tab bodies are their own small files from tickets 22, 24 and 25.

## Acceptance criteria
1. A tap away from the ring, or a swipe up, opens the sheet on the last-used tab; Breath on first open.
2. Below 900 px it is a bottom sheet about 60% tall with a handle; at 900 px and wider it is a right-side panel.
3. After 5 s with no pointer, touch or key input, the sheet dissolves over about 1.5 s: a CSS noise mask, drift up and right, slight blur.
4. Any tap or pointer move during or after the dissolve brings it back with a 0.4 s fade.
5. Under `prefers-reduced-motion` the dissolve is a plain fade, shown by a test that checks the applied style.
6. Keyboard focus inside the sheet keeps it open; it never dissolves while a control has focus.
7. The Sounds tab shows the master volume slider, wired to `Mixer.setMaster` and never persisted.
8. Tooltips appear after 2500 ms of hover or focus, or a 600 ms long press; the Lab still uses the same components.
9. A sheet smoke test on each tab passes `vitest-axe`, and the Lab still loads.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: on a phone width and a desktop width, the dissolve looks like a dandelion blown away, and nothing feels busy.

## Comments
- Built in `build/20-controls-sheet`. Pure rules sit in `src/ui/sheetLogic.ts` (auto-hide with an injected `after`, tap and swipe classifier, width rule, sheet style) under the coverage gate. `Sheet.tsx` is the component; `SoundsTab.tsx` holds only the master slider until ticket 24.
- `Tip`, `RowVolume` and `useFrame` moved to `src/ui/Tip.tsx` and `Slider.tsx`; `tooltipTimer.ts` and its test moved to `src/ui/`. The Tip colours now use palette tokens.
- Deviation: ticket 14 persisted `master` in `breather.state`, which contradicts AC7 and the spec. Removed it from `SavedState`; an old stored value is ignored.
- Deviation: keyboard focus holds the sheet open only when the last input was a key. A mouse click leaves focus on a button, which would stop the dissolve on desktop.
- The dissolve mask is CSS only: three tiled dot grids whose holes grow with the registered property `--cut`. No image, so the CSP stays `default-src 'self'`. Not yet seen in a real browser.
- Added: the Up arrow opens the sheet, so a keyboard user can reach it. Escape and the handle close it. `touch-action: none` on the resting screen so a swipe up reaches pointer events.
- Tabs 22 and 25 replace `null` in the `BODIES` map in `Sheet.tsx`.
