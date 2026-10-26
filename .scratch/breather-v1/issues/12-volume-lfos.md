Type: prototype
Status: resolved
Blocked by: 08

# Do slow volume LFOs make the mix feel alive?

Add a bank of 3 slow LFOs to the Listening Lab that any sound can follow, and judge them by ear.

## Context
- Decided with Matt on 2026-10-25:
  - **The bank:** 3 LFOs, each with its own color. Each sound row picks None, 1, 2 or 3, plus a depth slider.
  - **Speed limit:** 8 s to 120 s per cycle, nothing faster. Defaults: LFO 1 at 20 s, LFO 2 at 45 s, LFO 3 at 90 s.
  - **Shapes:** sine and smooth random, picked per LFO.
- Visual, per sound row: a live volume bar filled in the assigned LFO's color. The fill rises and falls with the modulated level, and a dot marks the LFO's position in its cycle.
- The LFO math lives in `src/audio/`, written test-first with injected time, so the app reuses it. The Lab UI stays throwaway.
- Rate clamping, shape output range and depth scaling are pure logic and fall under the 75% coverage gate (ADR-0003).

## How to resolve
Build it in the Lab on `prototype/listening-lab` (Sonnet). Matt listens, then the verdict and any tuning go under `## Answer`.

## Comments
- Built in `5cdc49c`: `src/audio/lfo.ts` (tested, 46 tests total, 84% branch coverage), `modulation.ts`, `Lfo.tsx`. Defaults: LFO 1 teal 20 s sine, LFO 2 violet 45 s sine, LFO 3 amber 90 s smooth random. The reverb send follows the modulation.
- Known gap for the app build: each Play of a sound with reverb leaves a send gain node registered. Clean it up on stop.

## Answer
Resolved with Matt on 2026-10-25. He approved the LFO UI after three rounds. Final build `0bef40c` (colour buttons), `d628806` and `9eb173d` (tooltips).
- A bank of 3 LFOs: teal 20 s sine, violet 45 s sine, amber 90 s smooth random. Period 8 s to 120 s, shape per LFO.
- Each loop row has one volume slider. Tapping a colour button (1 teal, 2 violet, 3 amber) turns it into a min/max range, and the LFO's colour fills the track to the live level. Tapping again turns it off. There is no depth control: the gap between the handles is the swing.
- No info buttons. Tooltips appear after 2.5 s of hover or keyboard focus, or a 600 ms long press on touch. The text is always linked through `aria-describedby`.
- Matt's UI taste from this ticket, for ticket 05: simple and colourful, few controls, no explanatory chrome, colour that shows state.
- Carry into the app build: clean up the reverb send gain node on stop.
