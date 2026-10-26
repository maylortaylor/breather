# License provenance for third-party code, fonts, shaders and audio

Researched 2026-10-26 for ticket 09. This is not legal advice. Items marked LAWYER need one before v1 goes public.

## Verdict

Write all shader and noise code from scratch. Ship no audio files in v1 (PLAN already says so). Bundle Nunito under the OFL with its license text. Allow only permissive npm dependencies.

## 1. Shadertoy

- Shadertoy's [terms](https://www.shadertoy.com/terms) say an author owns each shader and picks its license. A shader with no license text falls under CC BY-NC-SA 3.0 Unported. The page returned HTTP 403 to my fetch, so this comes from search results quoting it. Re-read it in a browser.
- CC BY-NC-SA blocks MIT twice. NC forbids commercial use, which MIT grants to every downstream user. SA forces the same license on adaptations. [Creative Commons says](https://creativecommons.org/faq/) its licenses are not compatible with the major software licenses.
- Copied means any code lifted, ported to another language, or renamed line by line. Renaming variables is still derived. A published technique (layered noise curtains, fbm) is an idea and carries no copyright. The code that expresses it does.
- Safe approach for the aurora:
  1. Read technique descriptions (articles, papers, [Inigo Quilez on fbm](https://iquilezles.org/articles/)), close the tab, then write the GLSL from the description.
  2. Never keep a Shadertoy tab open while typing the shader.
  3. Derive the noise yourself: a hash from `fract(sin(dot(p, k)) * n)`, value noise, then fbm by summing octaves.
  4. A snippet is usable only if its own header says MIT, CC0 or Unlicense. Record URL, author and date in `THIRD_PARTY.md`.
  5. Put one comment above the shader: written from scratch, no third-party code.

## 2. Noise and Web Audio code

- Paul Kellett's pink-noise filter (the seven-state `b0..b6` code) is credited in the [musicdsp archive](https://www.musicdsp.org/en/latest/Filters/76-pink-noise-filter.html) and on [Robin Whittle's page](https://www.firstpr.com.au/dsp/pink-noise/) (spelled Kellet there). Neither states a license for the code. Whittle says the work was placed in the public domain by its creators, and asks readers not to mirror his page. The archive's main page states no terms for its code.
- Treat the Kellett code as unlicensed. An unlicensed snippet grants no permission by default. Do not paste it.
- Make pink noise another way: the Voss-McCartney algorithm described in prose, or white noise summed through one-pole low-pass filters whose coefficients you derive. Write it fresh and say so in a comment.
- Brown noise by a leaky integrator (`y = (y + k * white) / (1 + k)`) is a one-line textbook recurrence. Write it yourself.
- MDN examples: [MDN's guidelines](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Attrib_copyright_license) put samples from 2010-08-20 onward under CC0 and earlier ones under MIT. Since the 2020 Yari platform, no sample shows which date applies. Either license is MIT-compatible. Prefer writing your own, and cite the page URL in a comment when you adapt one.

## 3. Audio samples

| License | In the repo? | Why |
|---|---|---|
| CC0 | Yes, v1 | No conditions. Record it anyway |
| CC BY 4.0 | Not in v1 | Needs credit shown to users |
| CC BY-NC | Never | NC conflicts with MIT use by others |
| Sampling+ (legacy) | Never | Retired in 2011, NC-like |

- [Freesound](https://freesound.org/help/faq/) licenses each file separately: CC0, CC BY 4.0, CC BY-NC 4.0 and legacy Sampling+. Read the license on the sound's own page. Use the "Creative Commons 0" filter.
- CC BY in a PWA still needs credit. Show title, author, source link and license in an About screen inside the app, plus `THIRD_PARTY.md`. A repo file does not reach an installed-app user.
- Rule for v1: CC0 only, and only after Matt approves the sound by ear. Record in `THIRD_PARTY.md`: name, author, source URL, license URL, date downloaded and SHA-256. Re-check the page on that date, since uploaders can change or delete a license.
- Sounds Matt records, or the app synthesizes, need no entry.

## 4. Nunito

- Nunito is OFL 1.1. The [googlefonts/nunito](https://github.com/googlefonts/nunito) `OFL.txt` reads "Copyright 2014 The Nunito Project Authors" and names no Reserved Font Name. The older 2011 release declared one.
- Bundling and self-hosting in an MIT app is allowed. The [OFL FAQ](https://openfontlicense.org/ofl-faq/) says loading fonts through `@font-face` from your own server is allowed, and the font stays OFL while the app stays MIT. Never sell the font alone.
- Ship the copyright statement, license notice and license text. The FAQ accepts an About box and strongly recommends the text travel with the font. Do both: copy `OFL.txt` beside the font file, and list Nunito in `THIRD_PARTY.md`.
- Reserved Font Name: none declared here, so no rename is forced. The FAQ calls subsetting a modified version, so keep the notices and do not present a subset as the original. Recheck `OFL.txt` for an RFN if you take another release.
- Source: the googlefonts repo or [@fontsource/nunito](https://www.npmjs.com/package/@fontsource/nunito) (OFL-1.1). Record version and date.

## 5. npm dependencies

Read from the installed `node_modules` on 2026-10-26: vite-plus, react, react-dom, @stylexjs/stylex, @stylexjs/unplugin, vite-plugin-pwa, workbox-build and workbox-core are all MIT. three.js is [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) but not yet in `package.json`. Zustand is not used. Transitive dependencies are unchecked.

- Allow: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, CC0-1.0, Unlicense, BlueOak-1.0.0, and OFL-1.1 for font packages only.
- Deny: GPL, AGPL, LGPL (ask first), CC-BY-NC, and any unlicensed, `UNLICENSED` or `SEE LICENSE IN` package.
- Command, no global install (not run here; run it once at scaffold and pin a version, per the no-`latest` rule):
  `npx --yes license-checker-rseidelsohn --production --excludePrivatePackages --onlyAllow "MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;0BSD;CC0-1.0;Unlicense;BlueOak-1.0.0;OFL-1.1"`
  It exits non-zero on a disallowed license. Run it without `--production` as a report.
- Enforce: add `scripts/check-licenses.mjs` that runs the command with `execFileSync`, and call it in pre-push after `vp check`. A Vitest test that shells out to npx is slow and needs the network, so prefer the script.

## 6. Attribution mechanics

- MIT requires the copyright notice and permission text in all copies or substantial portions. A bundled dependency counts. Bundlers keep license comments only partly, so generate a notices file at build time from the checker's output and link it from the About screen. LAWYER: whether minified bundles need the full text inline. Shipping the file is common practice.
- Credits go in two places: an About screen (one line each for Nunito, three.js, React and any CC BY sound) and `THIRD_PARTY.md`. The repo file serves source readers. The About screen serves installed users, and the OFL FAQ accepts it.
- With no CC BY audio, the v1 About screen can be a Nunito line and a link to the notices file.

## Not settled

- The Shadertoy terms text rests on search snippets.
- The checker command was not run.
- LAWYER: whether a re-derived filter based on Kellett's published coefficients is a derivative work.
