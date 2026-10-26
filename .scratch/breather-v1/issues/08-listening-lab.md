Type: prototype
Status: open
Blocked by: 02

# Do the synthesized sounds hold up to the ear?

Audition each synthesized sound in a plain page and approve or reject it. This is build phase 2 and the main sound-quality risk.

## Context
- Whales and ocean waves are the likeliest to sound fake (`docs/PLAN.md` Risks).
- A rejected sound may get a small CC0 sample for that sound only, which needs ticket 09 first.
- One play button and one volume slider per sound, no main UI.
- Stack is fixed by ADR-0003. The first scaffold also runs its three spikes: Oxfmt style options, StyleX #1918 build check, and vite-plugin-pwa under Vite+ at `/breather/`.

## How to resolve
Type `/prototype`. Produces a throwaway Listening Lab page linked from this ticket, and an approve or reject list under `## Answer`.
