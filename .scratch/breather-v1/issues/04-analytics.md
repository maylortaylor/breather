Type: grilling
Status: resolved
Blocked by: none

# Does breather collect any analytics?

Choose no analytics or a privacy-first option, knowing the answer decides whether any key exists.

## Context
- The app is static with no backend, and the design leans calm and private (`docs/PLAN.md` Overview).
- Any key or script in a client bundle is public.
- A no-analytics answer keeps `.env.example` empty and the privacy story one line long.

## How to resolve
Type `/grill-me`. Produces a decision recorded under `## Answer`, and an ADR in `docs/adr/` only if analytics is chosen.

## Answer
Decided with Matt on 2026-10-26. No ADR yet: analytics and error reporting each get an ADR when they are wanted.
- **v1 has no analytics, no cookies, no third-party requests and no error-reporting service.** `.env.example` stays empty. Errors stay in the console, with a calm fallback screen and a reload button.
- **No usage counting.** The only future option noted is counting page loads from the Caddy request log, with no script in the app.
- **CSP:** a `<meta>` Content Security Policy limits the page to its own files (`default-src 'self'`). A build check fails if an outside request or inline source slips in.
- **Storage:** presets and the last mix use local storage, never cookies. Every key the app writes starts with `breather.`, because `roboborealis.com/breather/` shares an origin with the main site. A test asserts the prefix.
- **Storage notice, not a cookie banner:** a one-line first-run notice under Begin, one "OK", repeated in the Session tab: "Breather saves your mix on this device. No cookies, no tracking." It claims only what the CSP check enforces. A consent banner returns with the analytics ADR if that ever lands.
- **SECURITY.md** explains private reporting through GitHub private vulnerability reporting, so no email address is public. Turning it on goes on the v1 gate checklist.
- **AGENTS.md rule** (temporary): no analytics, network dependency or key unless a new ADR allows it.
- **Carry to ticket 11:** Safari may clear local storage after 7 days without a visit. Show an install-to-home-screen tip. Preset export and import is the later fix. A lawyer should glance at the storage notice before wide promotion.
