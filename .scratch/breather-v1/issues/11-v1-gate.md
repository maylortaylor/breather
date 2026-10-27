Type: grilling
Status: open
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12

# What counts as v1, and how does it get pushed?

Define done for v1 and the first-push procedure.

## Context
- Local history goes public at the first push, so a clean `gitleaks git .` over full history is required first.
- A local hook denies pushing `main` to origin, so the first push is a manual push by Matt.
- Remote setup: enable GitHub secret scanning and push protection, and let `.github/workflows/scan.yml` start running.
- Open a platform-repo ticket for the roboborealis Caddy rule (proxy `/breather/*`, add the trailing slash, `no-cache` on `sw.js`) plus an "Apps by roboBOREALIS" link (ADR-0002). v1 resolves only after the app installs from `roboborealis.com/breather/`.
- Before the push, re-read `SECURITY.md` (the reply and fix times and the release-notes credit were drafted by an agent, not decided) and update the README status line ("pre-v1, local only"). Both go public with the first push.

## How to resolve
Type `/grill-me`. Produces a v1 checklist under `## Answer` with numbered acceptance criteria. Then run `bootstrap-process.sh` for labels and decide whether to migrate `.scratch/` tickets to GitHub issues.

## Comments
- Ready (ticket 32, branch `build/32-acceptance`): the full gate passes (579 tests, coverage gate, build, `check:build`, licence check, pre-push hook); `gitleaks git .` is clean over the 162 local commits; `dist/` holds no Lab code, dev timer, source map, console call of the app's own outside the error boundary, or third-party host.
- Ticket 11 still owns: the final full-history `gitleaks` run right before the push; the first push (manual, `main` to origin); enabling GitHub secret scanning, push protection and private vulnerability reporting; the platform Caddy ticket (proxy `/breather/*`, trailing slash, `no-cache` on `sw.js`, "Apps by roboBOREALIS" link).
- Also ticket 11: re-read `SECURITY.md` (reply and fix times and release-notes credit were agent-drafted) and update the README status line ("pre-v1, local only").
- After the first HTTPS deploy: install from `roboborealis.com/breather/`, reload offline, and run the ticket 29 iPhone checklist.
- Matt still owes the 10 minute stopwatch run (ticket 32 AC3), if not done, and criterion 14.
- Tickets 33 (hidden-tab metronome) and 34 (focus on screen swap) are open and not blockers for v1 unless Matt says so.
