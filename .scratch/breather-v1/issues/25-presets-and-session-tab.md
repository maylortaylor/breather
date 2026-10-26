Type: build
Status: open
Blocked by: 22, 24
Model: sonnet

# Build the Session tab: presets with crossfade, dim mode and the storage line

Put built-in and user presets, dim mode, the storage notice and "How it works" in the plum Session tab.

## Context
- Ticket 06 Answer: built-ins read-only, "Save as new", 10 user presets, 24-character names, 3 s crossfade, first launch loads Sleep.
- Ticket 04: the storage line repeats in the Session tab. Ticket 10: a "How it works" link reopens the welcome card.
- ADR-0004 Dim mode; the dim theme exists from ticket 15. Spec "State and preset schema" and `presets.ts` from ticket 16.
- One file, `src/ui/SessionTab.tsx`. The sleep timer joins this tab in ticket 26.

## Acceptance criteria
1. The tab lists Sleep, Focus and Reset, then user presets; the active one is marked.
2. Choosing a preset crossfades over 3 s: levels glide, new sounds fade in over 1.5 s, removed sounds fade out, and tempo, metronome and dim follow.
3. After any change to a built-in, the tab offers "Save as new"; the built-in itself never changes.
4. Saving asks for a name, refuses an empty name, a name over 24 characters and an eleventh preset with a calm message.
5. A user preset can be renamed and deleted, and the list persists in `breather.presets`.
6. A dim mode switch applies the dim theme to the UI at once and persists.
7. The tab shows the storage line from ticket 04 and a "How it works" link that reopens the welcome card.
8. Master volume never changes on a preset switch, shown by a test.
9. A Session tab smoke test passes `vitest-axe`.

## Verify
```sh
npm test
npm run check
npm run dev
```
- Matt checks: switch Sleep to Reset to Focus; each crossfade is smooth, with no click and no jump in loudness. Tune built-in levels by ear and note any change here.
