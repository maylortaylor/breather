# 0001. Local-first tracker and MIT license

## Context

Breather is a small open-source app. The repo goes public at v1. Until then there is no remote, and the planning output (maps, grill transcripts, tickets) needs a home that works without GitHub. Local history becomes public at the first push, so anything committed before then must already be clean.

## Decision

- Tickets and wayfinder output live in `.scratch/` as markdown, in the mattpocock-skills 1.3.1 local tracker format.
- Branches merge locally by fast-forward. No remote, no push, no GitHub until the v1 gate ticket resolves.
- The license is MIT. Code and assets must be MIT-compatible; audio samples must be CC0.
- Secret guards run from the first commit: a fail-closed gitleaks pre-commit hook, and `.env*` ignored.

## Consequences

- Tickets are public once pushed, so they carry no personal or client info.
- The v1 gate ticket owns a clean `gitleaks git .` over full history and the first-push procedure.
- Migrating `.scratch/` tickets to GitHub issues is optional and decided at the v1 gate.
- Borrowed shader or noise code needs a license check before it enters the repo.

## Amended 2026-10-26

The v1 gate cleared: a clean `gitleaks git .` over the full history (162 commits, none with a personal email), then a manual first push of `main` by Matt. The repo is public at `github.com/maylortaylor/breather`. Branches now go through pull requests into `main`. Tickets stay in `.scratch/`.
