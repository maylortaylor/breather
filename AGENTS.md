# AGENTS.md - breather

> Agent-agnostic: this is the real file. `CLAUDE.md` is a local symlink to it (`ln -s AGENTS.md CLAUDE.md`), globally gitignored.

Breather is a static, installable web app for winding down: synthesized Web Audio layers, a soft metronome, a guided 4-7-8 breath and an aurora background. MIT licensed, open source at v1.

**Read [`docs/PLAN.md`](docs/PLAN.md) and [`docs/WORKING-AGREEMENT.md`](docs/WORKING-AGREEMENT.md) before doing anything.** Vocabulary is in [`CONTEXT.md`](CONTEXT.md). Decisions carry their rationale in [`docs/adr/`](docs/adr/); do not silently reverse one.

## Tickets

Local until v1. Tickets live in `.scratch/` as markdown files, in the format of mattpocock-skills 1.3.1 `issue-tracker-local.md`. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md). The current effort is [`.scratch/breather-v1/map.md`](.scratch/breather-v1/map.md).

Triage roles are in [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md). Domain docs are in [`docs/agents/domain.md`](docs/agents/domain.md).

## Never do these

- **Never put a secret in code.** The app is static; anything in a client bundle is public.
- **Never commit `.env*`.** Only `.env.example` is tracked.
- **Never add a git remote or push** until the v1 gate ticket (`.scratch/breather-v1/issues/11-v1-gate.md`) resolves.
- **Never use `:latest`** on any image or tool version.
- **Never put personal or client info in a ticket.** The repo goes public at v1, and so does every grill transcript in `.scratch/`.
- **Never take shader or noise code without a license check.** Only MIT-compatible code and CC0 audio. See `THIRD_PARTY.md`.
- **Never build inside a wayfinder map.** Maps plan; build tickets execute.

## Models

Opus plans, Sonnet builds. Planning, grilling, wayfinding and review run on Opus. A build ticket carries a `Model: sonnet` line and is implemented one ticket per fresh context.

## Testing

Risk-weighted. Pure logic gets Vitest unit tests, written test-first: the lookahead scheduler, the tempo mapping (halves mapped separately, center fixed at 60 BPM) and the phase state machine. Presentational UI gets a smoke test at most. Tests assert values and behavior, never just existence. The runner is confirmed by the stack ticket (`02-stack-and-tests`).

## Slash commands

`/grill-me`, `/grill-with-docs` and `/wayfinder` are typed by a human. An agent never reaches for them.
