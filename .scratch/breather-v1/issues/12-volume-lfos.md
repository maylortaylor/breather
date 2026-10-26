Type: prototype
Status: claimed
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
