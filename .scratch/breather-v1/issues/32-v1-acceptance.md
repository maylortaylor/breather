Type: build
Status: claimed
Blocked by: 28, 29, 30, 31
Model: sonnet

# Run the v1 acceptance pass against the spec's definition of done

Prove every v1 criterion in the spec on the built app, fix small gaps, and hand the result to ticket 11.

## Context
- Spec "v1 definition of done", criteria 1 to 14, built by tickets 14 to 31.
- Ticket 11 (grilling, open) owns the first push, the full-history gitleaks run and the platform Caddy ticket; this ticket does none of them.
- `docs/WORKING-AGREEMENT.md` rule 8: the gate is tests, gitleaks and `/code-review`.
- A gap larger than a small fix becomes a new build ticket, not a change here.

## Acceptance criteria
1. Every criterion in the spec's definition of done is checked on `npm run preview`, and the result for each is recorded as a numbered comment on this ticket.
2. The full gate passes: `npm run check`, `npm test` with the 75% coverage gate, `npm run build`, `npm run check:build` and the licence check.
3. A 10-minute foreground run at 60 BPM with the metronome at D2 shows no drift against a stopwatch.
4. `gitleaks git . --config .gitleaks.toml` reports no leaks over full history.
5. No Lab code, dev-only timer or `console` call outside the error boundary ships in `dist/`.
6. Every gap found is either fixed here, in under an hour, or filed as a numbered build ticket.
7. A comment on ticket 11 lists what is ready and what it still owns.

## Verify
```sh
npm run check
npm test
npm run build
npm run check:build
node scripts/check-licenses.mjs
npm run preview
```
- Matt checks: listen and look on a desktop browser and an iPhone for one full session with a 30-minute timer, and approve or list fixes.
