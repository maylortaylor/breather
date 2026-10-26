Type: grilling
Status: resolved
Blocked by: none

# Where does breather live, and under which owner?

Pick GitHub Pages at a project subpath versus a roboborealis.com subdomain, and the maylortaylor versus roboborealis GitHub owner.

## Context
- `maylortaylor.github.io` has no CNAME, so project Pages would serve at `maylortaylor.github.io/breather/`.
- The base path sets the Vite `base`, the manifest `start_url` and `scope`, and the service-worker scope.
- Changing the URL later breaks installed PWAs.
- The owner changes the Pages URL and the brand link.

## How to resolve
Type `/grill-with-docs`. Produces an ADR in `docs/adr/` (hosting and owner), plus `CONTEXT.md` entries if new terms appear. Blocks tickets 02 and 08.

## Answer
Decided with Matt on 2026-10-25, recorded in [ADR-0002](../../../docs/adr/0002-hosting-and-owner.md).
- Owner `maylortaylor/breather`. Canonical URL `roboborealis.com/breather/`, base path `/breather/`.
- Origin is GitHub Pages at `maylortaylor.github.io/breather/` via Actions, no custom domain, canonical tag to roboborealis.com.
- The roboborealis Caddy fragment proxies `/breather/*` to Pages, redirects `/breather` to `/breather/`, and sends `no-cache` on `sw.js`.
- The PWA installs from roboborealis.com only. Lean Actions, no `dev` branch.
