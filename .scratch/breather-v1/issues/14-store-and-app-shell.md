Type: build
Status: resolved
Blocked by: none
Model: sonnet

# Add the store, persistence and app shell, and move the Lab to a dev-only page

Replace the Lab as the app entry with an `App` shell over a hand-rolled store that persists under the `breather.` prefix.

## Context
- Spec "Module map": `src/store.ts`, `src/App.tsx`, `lab.html` dev-only. ADR-0003 State: about 40 lines, `useSyncExternalStore`.
- Spec "State and preset schema": persisted keys `breather.state` and `breather.presets`, each with `version: 1`. Ticket 04 Storage.
- Spec "Errors and fallbacks" items 1 and 5: storage failures are silent; a render error shows a calm reload screen.
- Spec "Open risks": prove `vitest-axe` and jsdom under the Vite+ Vitest here, before any UI ticket depends on them.

## Acceptance criteria
1. `src/store.ts` exports `createStore` (`get`, `set`, `subscribe`) and `useStore(selector)`; a test shows a subscriber fires once per `set` and not after unsubscribe.
2. A `persist` helper reads and writes JSON with `version: 1`; a test shows a stored value with a higher version, a missing version or invalid JSON returns null and does not throw.
3. A test stubs `localStorage` to throw on every call, and the store still reads and writes in memory.
4. A test records every key passed to `localStorage.setItem` during a save and asserts each starts with `breather.`.
5. `npm run dev` serves the app at `/breather/` showing an empty `App` shell on the near-black background, and the Lab at `/breather/lab.html` still plays sounds.
6. `npm run build` output contains no Lab code: `check-build.mjs` fails if any file in `dist/` contains the string "Listening Lab".
7. A component that throws inside `App` renders the fallback screen with a working Reload button, shown by a test.
8. `@testing-library/react`, `jsdom` and `vitest-axe` are exact-pinned devDependencies, and one smoke test of `App` passes an axe check.
9. `src/store.ts` is in `coverage.include` and the 75% gate passes.

## Verify
```sh
npm run check
npm test
npm run build
npm run check:build
npm run dev
```
- Open `http://localhost:5173/breather/lab.html` and play one sound to confirm the Lab still works.

## Comments
- The App shell styles the near-black background in `src/index.css`, not StyleX. The StyleX plugin is off under Vitest, so `stylex.create` would throw in the smoke test. Ticket 15 can move colors into tokens.
- The store holds every key in the spec except `mix`; it arrives with the preset schema (ticket 16). Saved under `breather.state`: `welcomeSeen`, `dim`, `secondsMode`, `master`, `presetId`.
- `vitest-axe` pulls in `axe-core` (MPL-2.0). It is a devDependency and never ships in `dist/`.
- The Lab entry is `lab.html` plus `src/lab/main.tsx`. Vite builds only `index.html`, so the Lab stays out of `dist/`.

## Answer
Resolved with Matt on 2026-10-26. All 9 criteria pass (70 tests, store 92 to 97% coverage). Matt checked the dev-only Lab page and re-listened to every sound: all approved except whale C, which he rejected on this pass (removed in the next commit). Left over from the fix: the dev server must be restarted after any `node_modules` reinstall.
