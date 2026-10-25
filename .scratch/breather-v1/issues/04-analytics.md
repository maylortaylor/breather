Type: grilling
Status: open
Blocked by: none

# Does breather collect any analytics?

Choose no analytics or a privacy-first option, knowing the answer decides whether any key exists.

## Context
- The app is static with no backend, and the design leans calm and private (`docs/PLAN.md` Overview).
- Any key or script in a client bundle is public.
- A no-analytics answer keeps `.env.example` empty and the privacy story one line long.

## How to resolve
Type `/grill-me`. Produces a decision recorded under `## Answer`, and an ADR in `docs/adr/` only if analytics is chosen.
