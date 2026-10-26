Type: prototype
Status: resolved
Blocked by: 02

# Do the synthesized sounds hold up to the ear?

Audition each synthesized sound in a plain page and approve or reject it. This is build phase 2 and the main sound-quality risk.

## Context
- Whales and ocean waves are the likeliest to sound fake (`docs/PLAN.md` Risks).
- A rejected sound may get a small CC0 sample for that sound only, which needs ticket 09 first.
- One play button and one volume slider per sound, no main UI.
- Stack is fixed by ADR-0003. The first scaffold also runs its three spikes: Oxfmt style options, StyleX #1918 build check, and vite-plugin-pwa under Vite+ at `/breather/`.

## How to resolve
Type `/prototype`. Produces a throwaway Listening Lab page linked from this ticket, and an approve or reject list under `## Answer`.

## Comments

Prototype built on branch `prototype/listening-lab`. Status stays claimed until Matt has listened.

### Run the Lab

```sh
nvm use            # Node 24
npm ci
npm run dev        # http://localhost:5173/breather/
```

Click Begin (it creates the audio context), then Play, Approve or Reject per row. Verdicts persist in localStorage; the textarea at the bottom is the summary to paste back under `## Answer`. Production check: `npm run build && npm run check:build && npm run preview` serves `http://localhost:4173/breather/`.

Every sound was driven in real Chrome through an analyser on the output: all 17 rows produce signal, and every loop is silent after Stop. Nothing was judged by ear.

### Spike results

| Spike | Item | Result |
| --- | --- | --- |
| A | Oxfmt double quotes, semicolons, trailingComma es5, 2-space indent, printWidth 100 | Found, all work (`fmt` block in `vite.config.ts`) |
| A | Oxfmt `ignorePatterns` | Found. Needed, because `vp check` formats Markdown by default |
| A | Oxlint `no-console` | Found, works. Scripts get an override |
| A | Oxlint `typescript/no-explicit-any` | Found, works |
| A | Oxlint `react-hooks/rules-of-hooks` and `exhaustive-deps` | Found, work. Need `plugins: ["react"]`, and the rule names are `react-hooks/...` |
| B | `@stylexjs/unplugin/vite`, `runtimeInjection: false`, lightningcss minify | Works. The build needs a real CSS file (`src/index.css`) to append StyleX CSS to; importing `virtual:stylex.css` fails to resolve |
| B | stylex #1918 | Did not reproduce in one run: a one-value change renamed the CSS asset (`index-BcDngBX_.css` to `index-C7jxf5_0.css`), the reference in `index.html` and the precache entry both followed, `check:build` passed. CSS Modules fallback not needed |
| C | vite-plugin-pwa 2.0.0 `generateSW` under Vite+ 1.4.0 | Works. `dist/sw.js` built, registers `/breather/sw.js` with scope `/breather/`, activates in Chrome, precaches shell, CSS, JS, icons and manifest |

### Notes

- No fallback was taken. No deviation from ADR-0003.
- `check:build` checks index.html and JS chunk references exist, every built asset is precached, and the registration scope.
- The build-only plugins (StyleX, PWA) are skipped under `VITEST`. With them on, vitest hung 10 s on exit.
- Vitest, the coverage gate and the test runner come bundled with Vite+. Tests import from `vite-plus/test`.
- `workbox-build` 7.4.1 arrives as a peer of vite-plugin-pwa and is pinned only by the lockfile.
- Coverage is gated at 75% on `src/audio/dsp.ts` only (statements 100%, branches 75%, functions 100%, lines 100%). Branches sit on the line; the uncovered ones are `?? 0` guards from `noUncheckedIndexedAccess`.
- Placeholder icons are generated PNGs, not final art.

### Dependencies (exact)

| Package | Version |
| --- | --- |
| vite-plus | 1.4.0 |
| react, react-dom | 19.3.1 |
| @types/react, @types/react-dom | 19.3.0 |
| @types/node | 24.19.2 |
| typescript | 5.9.3 |
| @vitejs/plugin-react | 6.1.2 |
| @stylexjs/stylex, @stylexjs/unplugin | 0.19.1 |
| vite-plugin-pwa | 2.0.0 |
| @vitest/coverage-v8 | 5.0.5 |

### Matt's first listen, 2026-10-25
- First build: every sound was a constant sharp high-pitched hiss and far too loud. Fixed with stereo noise, a rolled-off top end, RMS normalization, a damped reverb tail, a soft limiter and 1.5 s fade-ins.
- Approved: white, pink and brown noise; ocean waves; all 3 music pads (Dreamy, Tonal, Deep), "great for now".
- Bubbles: keep, but less often and more random.
- Whales: rejected. Retry as three variants (humpback song, deep moan, distant call) to pick from.
- Metronome voices, phase tones and test tone: silent to the ear. Cause: one-shots used the loop layer default and landed near -45 dBFS. Retry with their own level.

### Matt's second listen, 2026-10-25
- Approved: whale B (deep moan, "love"), whale C (distant call), wood block ("love"), heartbeat thump, phase tones ("fine for now").
- Heartbeat thump is the default metronome voice.
- Rejected and removed: whale A (humpback song), bell.
- Soft tick: too high. Retry as two rows, 700 Hz and 350 Hz.
- Bubbles: approved in character, slightly louder (+4 dB over the level-match target).

## Answer
Resolved with Matt on 2026-10-25 after three listening rounds. Built on `prototype/listening-lab`, last sound commit `dada29a`.

| Sound | Verdict |
|---|---|
| White, pink, brown noise | Keep |
| Ocean waves | Keep |
| Underwater bubbles | Keep: 3 to 14 s irregular gaps, 30% clusters, peak about -10 dBFS |
| Whale B (blue moan), whale C (distant call) | Keep |
| Whale A (humpback song) | Dropped |
| Pads: Dreamy, Tonal, Deep | Keep, for now |
| Metronome: heartbeat thump (default), wood block, soft tick 700 Hz, soft tick 350 Hz | Keep |
| Bell | Dropped for now |
| Phase tones: inhale, hold, exhale | Keep, for now |

- Levels: every loop is trimmed to about -30 dBFS RMS and every one-shot to about -14 dBFS peak at default sliders (`TRIMS` in `src/audio/catalog.ts`).
- Spikes from ADR-0003 all passed: Oxfmt and Oxlint options, StyleX #1918 did not reproduce, vite-plugin-pwa registers at `/breather/`.
- No CC0 samples are needed. Every sound stays synthesized.
- The branch stays open for ticket 12. Whether it merges or gets rebuilt from build tickets is decided when 12 resolves.

### Matt's re-listen, 2026-10-26
Whale C (distant call) is now rejected and removed. The humpback code that only whales A and C used went with it. Everything else stays approved, including both soft ticks. The loop set is 9 sounds: white, pink and brown noise, ocean, bubbles, whale B, and the 3 pads.
