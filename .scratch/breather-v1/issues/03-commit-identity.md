Type: grilling
Status: resolved
Blocked by: none

# Which email goes on breather commits?

Choose the GitHub noreply address or the gmail address as the repo-local `user.email`.

## Context
- The repo goes public at v1, and every commit author email becomes public.
- It must be set before the first commit, because changing it later rewrites history.
- No `user.email` is set in this repo yet, and the pre-commit hook needs gitleaks installed.

## How to resolve
Type `/grill-me`. Produces a short decision note on this ticket (`## Answer`), then run `git config user.email <choice>` in this repo.

## Answer
Use the GitHub noreply address `7232060+maylortaylor@users.noreply.github.com` as the repo-local `user.email`, so no personal address lands in public history. Decided by Matt on 2026-10-25 and set with `git config user.email`.
