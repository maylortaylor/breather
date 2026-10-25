Type: grilling
Status: open
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10

# What counts as v1, and how does it get pushed?

Define done for v1 and the first-push procedure.

## Context
- Local history goes public at the first push, so a clean `gitleaks git .` over full history is required first.
- A local hook denies pushing `main` to origin, so the first push is a manual push by Matt.
- Remote setup: enable GitHub secret scanning and push protection, and let `.github/workflows/scan.yml` start running.

## How to resolve
Type `/grill-me`. Produces a v1 checklist under `## Answer` with numbered acceptance criteria. Then run `bootstrap-process.sh` for labels and decide whether to migrate `.scratch/` tickets to GitHub issues.
