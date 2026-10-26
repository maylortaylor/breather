Type: grilling
Status: open
Blocked by: 12

# Should the aurora react to the sounds, and how?

Decide whether and how the three.js aurora responds to each sound layer, alongside its breath sync.

## Context
- An `AnalyserNode` per layer can drive visuals, for example noise as shimmer, pads as color shift, the heartbeat as a pulse.
- The aurora already follows the 4-7-8 phase through the `breath` uniform. The two signals must be designed together or they compete.
- Out of v1 unless this grill pulls it in. Decided with Matt on 2026-10-25.
- Needs the aurora renderer to exist first. No build ticket for it exists yet, so this stays parked until one does.

## How to resolve
Type `/grill-me` once the aurora renders. Produces a short design under `## Answer`, or an ADR if it changes the renderer interface.
