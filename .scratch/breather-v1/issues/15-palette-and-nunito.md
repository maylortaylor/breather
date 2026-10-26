Type: build
Status: claimed
Blocked by: 14
Model: sonnet

# Add the palette tokens, the dim theme, the contrast test and self-hosted Nunito

Define every colour once in StyleX tokens, prove AA with a test, and load Nunito from the app's own files.

## Context
- ADR-0004 Palette, Contrast, Dim mode and Font. Ticket 05 Visual style and Accessibility.
- Three contrast tables, not two: text on background, text on each tab colour, and tab colour on tab colour (roboborealis-platform `docs/DESIGN-ETHOS.md`).
- Tabs: Breath deep indigo, Sounds deep forest green, Session deep plum. LFO colours teal, violet, amber, deepened, never shared with tabs.
- Licence rules: `AGENTS.md` rule 6, `docs/research/license-provenance.md` section 4.

## Acceptance criteria
1. `src/theme.stylex.ts` holds the palette with `defineVars`, and a dim theme with `createTheme`: aurora about 50% darker, warmer and dimmer text, no blue-tinted text.
2. `src/theme.test.ts` parses the file and asserts at least 4.5:1 for body text and 3:1 for large text and slider thumbs, in both themes, across all three tables.
3. The same test fails if any text colour has an alpha channel or if any `.tsx` uses an alpha or `opacity` on text; changing one text colour to fail AA makes the test fail.
4. LFO colours and tab colours share no value, asserted by the test.
5. One Nunito variable `.woff2` and its `OFL.txt` sit together under `public/fonts/`, loaded by `@font-face` in `src/index.css` with a system fallback.
6. `THIRD_PARTY.md` records the Nunito source, version and date taken.
7. With the network blocked in devtools, the app still renders in Nunito after a reload of the built preview.

## Verify
```sh
npm test
npm run build
npm run check:build
npm run preview
```
- Matt checks: open the preview in normal and dim theme and confirm the colours read as calm, deep and not too bright.
