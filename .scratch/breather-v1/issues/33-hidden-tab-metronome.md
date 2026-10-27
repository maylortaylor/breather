Type: build
Status: open
Blocked by: 32
Model: sonnet

# Keep the metronome sounding while the tab is hidden

A hidden tab throttles the 25 ms scheduler tick to about 1 s, and the 0.1 s lookahead then hands out roughly one beat in ten. The ring is right on return; the clicks and phase tones were lost.

## Context
- Found by reading `src/breath/beats.ts` and `src/breath/scheduler.ts` against spec criterion 5, which only promises steady timing in the foreground.
- Ambient sound is unaffected: it runs on the audio graph, not the tick.
- The scheduler is pure and under the 75% gate; `lookahead` and `maxCatchUp` are already options.
- Ticket 29 device step 6 (lock 2 minutes, unlock) shows whether iOS freezes the tick entirely; decide with that result in hand.

## Acceptance criteria
1. While `document.hidden` is true, the scheduler hands out beats up to 2 s ahead, so a 1 s tick misses none.
2. Back in the foreground the lookahead returns to 0.1 s with no doubled or dropped beat at the switch.
3. A pause or tempo change while hidden still resets the horizon, so no stale beat sounds after it.
4. Tests inject the clock and the hidden flag; none sleeps. The 75% gate holds.

## Verify
```sh
npm run check
npm test
npm run build
npm run check:build
```
- Matt checks: start a session, switch to another tab for 2 minutes, return: the beat kept sounding and does not burst on return.
