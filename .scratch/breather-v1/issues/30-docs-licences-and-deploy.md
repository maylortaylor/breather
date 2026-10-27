Type: build
Status: resolved
Blocked by: 25, 27
Model: sonnet

# Add SECURITY.md, the README, the licence check, credits and the deploy workflow

Ready the repo for the public push: security reporting, a real README, an enforced dependency licence list and an inert deploy workflow.

## Context
- Ticket 04: SECURITY.md points to GitHub private vulnerability reporting, so no email is public.
- `docs/research/license-provenance.md` sections 5 and 6: the allow and deny lists, `scripts/check-licenses.mjs` in pre-push, a notices file linked from an About line.
- ADR-0002 and ADR-0003 Actions: deploy with `actions/deploy-pages` on push to `main`, `paths-ignore` for `**.md` and `.scratch/**`, `concurrency` with `cancel-in-progress`, no schedule.
- `AGENTS.md`: no remote and no push until ticket 11; the workflow stays inert until then.

## Acceptance criteria
1. `SECURITY.md` explains private vulnerability reporting through GitHub and names no email address.
2. `README.md` says what breather is, how to run, test and build it, the iPhone limits from ticket 07, and the licence.
3. `scripts/check-licenses.mjs` runs an exact-pinned licence checker with the allow list and exits non-zero on a disallowed licence; pre-push runs it after `vp check`.
4. Adding a fake GPL dependency to a scratch copy of `package.json` makes the script fail.
5. The build writes a notices file of production dependency licences into `dist/`, and it is precached.
6. The Session tab has an About line crediting Nunito, three.js and React, with a link to the notices file.
7. `.github/workflows/deploy.yml` matches ADR-0002 and pins every action by SHA with a version comment, like `scan.yml`.
8. `.env.example` stays empty and `gitleaks git .` reports no leaks.

## Verify
```sh
node scripts/check-licenses.mjs
npm run build
npm run check:build
gitleaks git . --config .gitleaks.toml
```
- Matt checks: read the README and SECURITY.md once; they say what you want said in public.

## Comments
- Built on `build/30-docs-licences-deploy`. Licence checker is `license-checker-rseidelsohn` 5.0.1 (BSD-3-Clause, dev; reads `node_modules` locally, no network). Its licence is BSD-3, which is on the allow list but not in the ticket's "MIT/ISC/Apache" hint.
- `react`, `react-dom` and `@stylexjs/stylex` moved to `dependencies` because they ship in the bundle; otherwise `--production` would miss them.
- Dev-only allowances (MPL-2.0, BlueOak-1.0.0, MIT-0, CC-BY data) are in AGENTS.md rule 7 and THIRD_PARTY.md. `css-mediaquery` declares a bare "BSD"; its LICENSE is BSD-3-Clause, recorded as an override.
- `@stylexjs/stylex` ships no licence file, so `notices.txt` says so for that entry.
- SECURITY.md's 7 day and 30 day response times are placeholders for Matt to confirm.
- The notices link works in the built app only; the dev server does not serve `notices.txt`.

## Answer
Resolved 2026-10-26. All 8 criteria pass (471 tests, licence check 597 packages with 0 problems, gitleaks clean). Matt read the README, SECURITY.md and the About line and approved ("everything else looks good"). Carried to ticket 11: re-read `SECURITY.md` before the push (the 7-day reply and 30-day fix times and "credit in the release notes" were written by the agent, not decided by Matt) and update the README status line, which says pre-v1 and local only. The licence checker `license-checker-rseidelsohn` 5.0.1 is BSD-3-Clause and dev-only; `axe-core` (MPL-2.0) is allowed dev-only.
