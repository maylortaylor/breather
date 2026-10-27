# Third-party components

Rules and reasoning: [docs/research/license-provenance.md](docs/research/license-provenance.md). Short form is in `AGENTS.md`.

Only MIT-compatible code, CC0 audio, and no CC BY-NC-SA shader code (Shadertoy snippets default to CC BY-NC-SA and cannot be used). Every entry records name, author, source URL, license, date taken and version or hash.

## Fonts

| Component | Source | License | Notes |
|---|---|---|---|
| Nunito variable font, latin subset | [Google Fonts](https://fonts.google.com/specimen/Nunito), file `v32/XRXV3I6Li01BKofINeaBTMnFcQ.woff2` from the [CSS API](https://fonts.googleapis.com/css2?family=Nunito:wght@200..1000), taken 2026-10-26. Upstream [googlefonts/nunito](https://github.com/googlefonts/nunito) | SIL OFL 1.1 | Copyright 2014 The Nunito Project Authors. No Reserved Font Name. Stored as `public/fonts/Nunito-latin-variable.woff2`, weights 200 to 1000, SHA-256 `20fc9b6fc618e7c3c68d3ac750a2a5dfbceb8521675458d2cea580b5693e4798`. `public/fonts/OFL.txt` is the upstream `OFL.txt` (SHA-256 `580df76c95a1ec5ab878ceb25bb3d85c6a076804e9c970c8c6972aea775fdf65`). The file is a subset, so it is a modified version under the OFL; do not present it as the original. Never sell it alone. Loaded by `@font-face` in `src/index.css`, precached by the PWA build, never fetched from a CDN |

## Code, shaders and audio

None. The aurora shader and the noise generators are written from scratch. v1 ships no audio files.

## npm dependencies

`node scripts/check-licenses.mjs` checks every installed package against the allow list and runs in pre-push. The build writes the licence text of each shipped package to `dist/notices.txt`, which the Session tab links as "Licence notices".

Shipped (production dependencies): react, react-dom, scheduler, three, @stylexjs/stylex, css-mediaquery, styleq, invariant, loose-envify and js-tokens. All are MIT except css-mediaquery, which declares a bare "BSD"; its own `LICENSE` is three-clause BSD (Yahoo), recorded as an override in `scripts/licenseRules.ts`. `@stylexjs/stylex` ships no licence file; its `package.json` declares MIT.

**Dev-only exception.** axe-core (via `vitest-axe`) and lightningcss are MPL-2.0. Neither ships in `dist/`, so the file-level copyleft never reaches users. The check allows MPL-2.0, BlueOak-1.0.0, MIT-0 and the CC-BY data licences (caniuse-lite, SPDX tables) for dev dependencies only, and denies them in production. `license-checker-rseidelsohn` 5.0.1 (BSD-3-Clause, dev) reads the installed packages from disk and makes no network calls.

| Package | Version | License | Notes |
|---|---|---|---|
| [three](https://github.com/mrdoob/three.js) | 0.186.1 (exact pin) | MIT | Copyright 2010-2026 three.js authors. Checked `node_modules/three/LICENSE` on 2026-10-26. Draws the aurora behind `BackgroundRenderer`; loaded lazily, makes no network requests. Only the library is used: the shader is original work |
| [@types/three](https://github.com/DefinitelyTyped/DefinitelyTyped) | 0.186.0 (exact pin, dev) | MIT | Type declarations only, not shipped |
