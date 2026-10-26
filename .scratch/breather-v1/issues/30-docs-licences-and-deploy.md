Type: build
Status: open
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
