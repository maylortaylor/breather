Type: grilling
Status: open
Blocked by: 01

# What stack and test runner does breather use?

Choose Vite + React + TypeScript versus plain TypeScript, confirm Vitest, and pin Node 24.

## Context
- `docs/PLAN.md` only suggests Vite, React and TypeScript, and allows plain JS for a tiny bundle.
- Scheduler timing, the tempo half-mapping and the phase machine are pure logic and easy to get wrong, so they need test-first coverage.
- Ticket 01 fixed the base path at `/breather/` (ADR-0002): build `base`, manifest `id`, `start_url`, `scope` and the service worker all use it.
- The deploy workflow is GitHub Actions to Pages: deploy on push to `main` only, `paths-ignore` for `**.md` and `.scratch/**`, `concurrency` with `cancel-in-progress`, no scheduled jobs.

## How to resolve
Type `/grill-with-docs`. Produces an ADR in `docs/adr/` (stack, test runner, Node pin). Update the `AGENTS.md` testing section to match.
