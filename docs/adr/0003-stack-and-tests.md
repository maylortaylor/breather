# 0003. Stack: Vite+, React 19, three.js, StyleX, hand-rolled store

## Context

Breather is a small static PWA served at `/breather/` (ADR-0002). Most of its work happens outside React:
the audio graph, the lookahead scheduler, the phase machine and the aurora renderer. The UI is about 15
controls. Matt wants Vite+ as the foundation, Actions used sparingly, and checks run locally. The dev-brain
standard is ESLint, Prettier and Vitest, with style rules that do not change between tools.

## Decision

- **Toolchain:** Vite+ (`vite-plus`), exact-pinned as a devDependency (v1.4.0 at decision time), run only
  through npm scripts. No `curl | bash` install. npm, Node 24 pinned in `.nvmrc`, `engines` and CI.
- **Lint and format:** Oxlint and Oxfmt through Vite+, with the standard rules: double quotes, 2-space
  indent, semicolons, trailing commas (es5), `no-console`, no `any`. Verify at scaffold that Oxfmt has each
  option and that Oxlint has `rules-of-hooks`. A missing one goes back to Matt.
- **UI:** React 19 and strict TypeScript. Keep components few: the layout is `src/audio/`, `src/breath/`,
  `src/background/`, `src/store.ts`, `src/App.tsx` and a handful of controls. A new file earns its place.
- **Audio:** the raw Web Audio API, no library.
- **Background:** three.js, with a canvas 2D fallback, both behind one `BackgroundRenderer` interface
  (`start`, `setBreath`, `setDim`, `resize`, `stop`).
- **State:** a hand-rolled external store (about 40 lines), read in React through `useSyncExternalStore` and
  persisted to localStorage. The audio, breath and renderer modules subscribe to it directly. Jotai is the
  step up if the store outgrows that.
- **Styling:** StyleX through `@stylexjs/unplugin`, gated by a build check for
  [stylex #1918](https://github.com/facebook/stylex/issues/1918). The bug renames the CSS asset on a
  CSS-only change without updating the reference.

  The check builds, changes one style, builds again, then asserts two things: every referenced CSS asset
  exists, and the service worker precaches it. If the check fails, the fallback is CSS Modules. StyleX lint
  rules wait until Oxlint JS plugins run them reliably. Dim mode is a `createTheme` class on the root.
- **Tests:** Vitest, React Testing Library and `vitest-axe`.
  - Pure logic is written test-first behind a 75% coverage gate: the scheduler, the tempo mapping (two
    halves, center fixed at 60 BPM), the phase machine, preset save and load, and detent snapping.
  - UI gets smoke tests. No snapshot-only tests, and time is injected rather than slept.
- **PWA:** vite-plugin-pwa (Workbox) with `base: "/breather/"`. The first build checks the generated
  `sw.js` scope. If the plugin fails under Vite+, a hand-written service worker is Matt's call.
- **Git hooks** (`.githooks/`, `core.hooksPath`, no `vp hooks`):
  - pre-commit runs gitleaks, then `vp staged`
  - pre-push runs `vp check`, then `vp test`
- **Actions:**
  - deploy on push to `main` with `paths-ignore` for docs and `.scratch`
  - the secret scan per ADR-0002
  - Dependabot monthly, one grouped PR each for npm and github-actions

## Rejected

- **Plain TypeScript or Preact:** they save bundle size that the PWA cache makes irrelevant after the
  first load.
- **Tone.js:** about 150 KB, and its Transport clock would replace the scheduler the plan specifies.
- **Zustand, Valtio and signals:**
  - Zustand isn't Matt's preference.
  - Valtio's proxies hide when updates fire.
  - Signals patch React internals, which is a risk on React 19.
- **Tailwind:** Matt wants to trial StyleX here.
- **`vp hooks`:** it would fight the existing `core.hooksPath` dispatcher.

## Consequences

- Vite+ is young (1.0 on 2026-09-28, four releases in four weeks), so upgrades are deliberate, not automatic.
- The first scaffold carries three spikes:
  - the Oxfmt options
  - StyleX #1918
  - vite-plugin-pwa under Vite+

  Each has a named fallback.
- Personal repos otherwise use ESLint and Prettier. This difference is recorded in the dev-brain
  "Personal vs PSD Justified Differences" note.
