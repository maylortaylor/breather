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

Run the license check in the research file (section 5). A generated notices file is linked from the About screen.
