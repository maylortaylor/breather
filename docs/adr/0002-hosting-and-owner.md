# 0002. Hosting: roboborealis.com/breather/ proxied to GitHub Pages

## Context

Breather is a static PWA. Its URL sets the build `base`, the manifest `id`, `start_url` and `scope`, and
the service-worker scope. An installed PWA belongs to its origin, so changing the URL after people install
it strands those installs. The app should live on roboborealis.com. That domain is served by the platform
box behind one CloudFront distribution shared by every client, and its path rules apply to every host.

## Decision

- The repo is `maylortaylor/breather`, public, MIT.
- The canonical URL is `https://roboborealis.com/breather/`. Base path, manifest `id`, `start_url`,
  `scope` and service-worker scope are all `/breather/`.
- The origin is GitHub Pages at `maylortaylor.github.io/breather/`, deployed by GitHub Actions
  (`actions/deploy-pages`) with no custom domain. Each page carries
  `<link rel="canonical">` pointing at roboborealis.com.
- The roboborealis Caddy fragment in the platform repo:
  - proxies `/breather/*` to `maylortaylor.github.io` with that domain as the Host header
  - redirects `/breather` to `/breather/`, because GitHub's own redirect would send visitors to github.io
  - sends `Cache-Control: no-cache` on `/breather/sw.js` so updates are not stuck in CloudFront or the browser
- The PWA installs from roboborealis.com. Only that URL is ever linked or shared. The github.io copy is a
  preview, never promoted.
- Actions stays lean:
  - no `dev` branch
  - deploy only on push to `main`
  - the secret scan only on PRs and pushes to `main`, never filtered by path, because a secret can
    arrive in a docs-only change
  - `paths-ignore` for `**.md` and `.scratch/**` on the deploy workflow only
  - `concurrency` with `cancel-in-progress`
  - no scheduled jobs

## Rejected

- **A roboborealis.com subdomain.** Matt wants the app as a path on the main site.
- **Copying the build into the platform repo.** Every breather release would become a platform image build and deploy.
- **S3 plus a CloudFront `/breather/*` rule.** It needs AWS keys in an open-source repo or manual uploads, and
  the rule would also serve the app on every other client's domain unless an edge function blocks them.
- **Files on the box disk.** Deploys become a manual step on the box, outside version control.

## Consequences

- The breather repo holds no secrets at all.
- `roboborealis.com/breather/` depends on the platform box being up. After the first visit the service
  worker serves the app offline.
- The app is also reachable at github.io. The canonical tag keeps search engines on roboborealis.com.
- The Caddy rule and an "Apps by roboBOREALIS" link are one platform-repo ticket. Ticket 11 opens it at v1
  and does not resolve until the app installs from `roboborealis.com/breather/`.
