Type: build
Status: claimed
Blocked by: 15, 27
Model: sonnet

# Lock the PWA, offline cache and the Content Security Policy into the build check

Make the built app install and run offline at `/breather/`, under a CSP that allows only its own files.

## Context
- ADR-0002: base, manifest `id`, `start_url`, `scope` and service-worker scope are `/breather/`; a canonical link to `https://roboborealis.com/breather/`.
- Ticket 04 CSP: a `<meta>` policy with `default-src 'self'`, and a build check that fails on an outside request or inline source.
- ADR-0003 PWA and the existing `scripts/check-build.mjs` (stylex #1918 and precache guard). Spec "Open risks": add the CSP at build only.
- Spec question 3 decides whether `media-src blob:` joins the policy for ticket 29.

## Acceptance criteria
1. The built `index.html` carries the CSP meta with `default-src 'self'`; the dev server does not, and dev still works.
2. `check-build.mjs` fails if the CSP meta is missing, if `index.html` has an inline `<script>` or an `on*=` attribute, or if any `src` or `href` points off-origin other than the canonical link.
3. The precache includes the font file, icons and manifest as well as JS, CSS and HTML; the check fails if the font is missing from it.
4. `<link rel="canonical" href="https://roboborealis.com/breather/">` is in the built page.
5. The manifest has name, short name, both icon sizes including maskable, and an `apple-touch-icon` link exists.
6. In the built preview, the browser console shows no CSP violation through Begin, every tab, the aurora and a preset switch.
7. With devtools offline after one visit, a reload of `/breather/` loads the full app.
8. Breaking one rule on purpose (adding an inline script) makes `npm run check:build` fail.

## Verify
```sh
npm run build
npm run check:build
npm run preview
```
- Open `http://localhost:4173/breather/`, use the app, then go offline in devtools and reload.
