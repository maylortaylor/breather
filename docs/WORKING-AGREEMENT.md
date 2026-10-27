# Working agreement

How work gets from an idea to merged code in breather. Tickets are files in `.scratch/`. The repo is public (v1 shipped 2026-10-26), so code changes go through pull requests into `main` (see [Since v1](#since-v1)).

Derived from the roboborealis-platform working agreement, slimmed for a solo repo.

---

## The eight rules

### 1. Every change starts as a ticket

No ticket, no branch. The ticket is where the *why* lives; the diff only shows the *what*. Tickets are markdown files in `.scratch/<effort>/issues/`, per [`docs/agents/issue-tracker.md`](agents/issue-tracker.md).

### 2. Grill before building

| You have | Type this |
|---|---|
| A feature you can settle in one sitting, in a codebase | `/grill-with-docs` |
| A plan or decision with no codebase to read | `/grill-me` |
| A build spanning many sessions, route unclear | `/wayfinder` |

`/grill-me` and `/grill-diff` are opposites. `/grill-me` runs before the work exists and reads your plan. `/grill-diff` runs after you commit and reads the diff.

### 3. Wayfinder when it will not fit one session

The test is session count, not project size. If the whole thing fits in one conversation, grilling is cheaper. `/wayfinder` charts a map of decision tickets, resolves them one at a time, and hands off when the route is clear.

```
/wayfinder          chart the map, resolve decision tickets
  → /to-spec        collapse settled decisions into one spec
  → /to-tickets     slice the spec into build tickets
  → /implement      one ticket, one fresh context
  → /code-review
```

### 4. Decision tickets are not build tickets

| | Decision ticket | Build ticket |
|---|---|---|
| Made by | `/wayfinder` | `/to-tickets` |
| `Type:` | `grilling`, `research`, `prototype`, `task` | `build` |
| Body | A question to resolve | What to build, plus numbered acceptance criteria |
| Resolved by | `/grill-me`, `/grill-with-docs`, `/prototype`, `/research` | `/implement`, `/tdd` |

| Decision type | Skill | Produces |
|---|---|---|
| `grilling` (architecture or domain) | `/grill-with-docs` | ADR in `docs/adr/` plus `CONTEXT.md` entries |
| `grilling` (everything else) | `/grill-me` | the named doc |
| `prototype` | `/prototype` | a throwaway artifact, linked from the ticket |
| `research` | `/research` | a findings file on a `research/*` branch |
| `task` | none | the outcome recorded on the ticket |

Grilling tickets resolve only through live exchange with a human. An agent that answers its own grilling questions has broken the ticket. Create the named doc when the session has something to write, not upfront.

### 5. Maps plan. They do not execute.

No map's Notes may grant itself execution licence. A `task` ticket that looks like a slice of the build is mis-typed. Implementation happens in its own sessions, from build tickets.

### 6. Opus plans. Sonnet builds.

| Phase | Model |
|---|---|
| Planning, grilling, wayfinding, code review | Opus |
| Implementing a build ticket | Sonnet, one ticket per fresh context |

A convention, carried as a `Model:` line on each build ticket so it is visible rather than remembered.

### 7. These are slash commands a human types

`/wayfinder`, `/grill-me`, `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/implement` and `/prototype` are human-typed. An agent never reaches for one. If a session is building without a ticket that says what and why, the process is not running.

### 8. Never commit to `main` directly

Before v1, with no remote (history; since v1 use a PR, see [Since v1](#since-v1)):

1. Start. Pick the ticket, set `Status: claimed`. Branch off `main`: `type/short-description`, 3 to 5 words.
2. Commit. Run `/simplify` before committing. Conventional Commit subject, 72 characters or fewer.
3. Gate. Tests pass, `gitleaks` pre-commit passes. After 3 failed fix attempts, stop and report.
4. Review with `/code-review`.
5. Merge to `main` by fast-forward (`git merge --ff-only`). Resolve the ticket.

---

## Writing

- Imperative, present tense, active. Say the specific thing.
- No attribution lines of any kind in commits, tickets or docs.
- Budgets: commit subject 72 chars, commit body 5 lines, wayfinder map 40 lines, issue body 20 lines.
- Acceptance criteria are numbered, never `- [ ]`. Numbers are citable from a commit or test plan.
- Issue = what and why. PR = what changed and how it was proven.

## Ticket status

A ticket is `open`, `claimed` or `resolved`. A ticket is unblocked when every file in its `Blocked by:` line is `resolved`. Resolving appends an `## Answer`, sets `Status: resolved`, and adds a pointer to the map's Decisions so far.

---

## Since v1

The repo has a remote and is public. These steps apply now:

- Open a PR into `main` instead of merging locally. Body under 20 lines, `Closes #N`, draft until the gate is green.
- Run the `bootstrap-process.sh` script from roboborealis-platform to create the labels.
- Decide whether to migrate `.scratch/` tickets to GitHub issues.
- Enable secret scanning and push protection in repo settings. Both are free on public repos.
- `.github/workflows/scan.yml` starts running on the first push: gitleaks over full history, plus shell lint.
- The first push is a manual push by Matt, because a local hook denies `git push origin main`.
