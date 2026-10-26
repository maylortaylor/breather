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
- **Never add analytics, a tracker, a network dependency or an API key** unless a new ADR allows it (ticket 04, temporary).
- **Never put personal or client info in a ticket.** The repo goes public at v1, and so does every grill transcript in `.scratch/`.
- **Never take shader or noise code without a license check.** Only MIT-compatible code and CC0 audio. See `THIRD_PARTY.md`.
- **Never build inside a wayfinder map.** Maps plan; build tickets execute.

## Third-party code and audio rules

1. Write the aurora shader and noise code from scratch. Never copy or port Shadertoy code (default CC BY-NC-SA).
2. Never paste Paul Kellett's pink-noise snippet (no stated license). Use Voss-McCartney or derived filters.
3. Borrowed code needs an MIT, CC0 or Unlicense header. Log URL, author and date in `THIRD_PARTY.md`.
4. No audio files in v1. Later samples must be CC0, approved by ear, logged with source, license URL, date and SHA-256.
5. Never use CC BY-NC or Sampling+. CC BY only with an in-app About credit.
6. Ship Nunito with its `OFL.txt`. Keep the copyright notice and never sell the font alone.
7. npm licenses: allow MIT, ISC, BSD-2/3, Apache-2.0, 0BSD, CC0, Unlicense. Deny GPL, AGPL, CC-BY-NC, unlicensed.
8. Details and the check command: `docs/research/license-provenance.md`.

## Models

Opus plans, Sonnet builds. Planning, grilling, wayfinding and review run on Opus. A build ticket carries a `Model: sonnet` line and is implemented one ticket per fresh context.

## Testing

Risk-weighted. Pure logic gets Vitest unit tests, written test-first: the lookahead scheduler, the tempo mapping (halves mapped separately, center fixed at 60 BPM) and the phase state machine. Presentational UI gets a smoke test at most. Tests assert values and behavior, never just existence. Vitest, React Testing Library and `vitest-axe`. Test-first with a 75% coverage gate on pure logic: the scheduler, tempo mapping, phase machine, preset save and load, and detent snapping. Keep components few; a new file earns its place. Stack details in [ADR-0003](docs/adr/0003-stack-and-tests.md).

## Slash commands

`/grill-me`, `/grill-with-docs` and `/wayfinder` are typed by a human. An agent never reaches for them.
