// Pure rules for the built page, shared by vite.config.ts (adds the CSP) and check-build.mjs
// (enforces it). Erasable TypeScript only: Node runs this file directly from check-build.mjs.

export const CANONICAL_URL = "https://roboborealis.com/breather/";

// Built app only; dev needs Vite's inline client script. Every source is the page's own origin.
// - default-src 'self': scripts, styles, fonts and images are all same-origin files. three.js
//   needs no eval, StyleX ships one static CSS file, and React sets styles through the CSSOM,
//   which style-src allows. Nothing here needs 'unsafe-inline' or 'unsafe-eval'.
// - media-src 'self' blob: lets the iPhone keep-alive play a silent WAV built as a blob URL.
// - worker-src 'self' is explicit for sw.js (it falls back to default-src, so this is a label).
// - manifest-src 'self' covers the web manifest the same way.
// - object-src, base-uri and form-action do not fall back to default-src, so they are set here.
export const CSP = [
  "default-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** Insert the CSP meta right after the charset meta, so it precedes every script and link. */
export function withCsp(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
  return html.replace(/(<meta charset[^>]*>)/i, `$1\n    ${meta}`);
}

type Attr = { name: string; value: string };
type Tag = { name: string; attrs: Attr[] };

function parseTags(html: string): Tag[] {
  const tags: Tag[] = [];
  for (const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs: Attr[] = [];
    for (const a of (m[2] ?? "").matchAll(
      /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
    )) {
      attrs.push({ name: (a[1] ?? "").toLowerCase(), value: a[2] ?? a[3] ?? a[4] ?? "" });
    }
    tags.push({ name: (m[1] ?? "").toLowerCase(), attrs });
  }
  return tags;
}

const attr = (tag: Tag, name: string) => tag.attrs.find((a) => a.name === name)?.value;

export function checkHtml(html: string): string[] {
  const problems: string[] = [];
  const tags = parseTags(html);

  const csp = tags.find(
    (t) => t.name === "meta" && attr(t, "http-equiv")?.toLowerCase() === "content-security-policy"
  );
  if (!csp) {
    problems.push("index.html: Content-Security-Policy meta is missing");
  } else {
    const policy = attr(csp, "content") ?? "";
    if (!/(^|;)\s*default-src 'self'\s*(;|$)/.test(policy)) {
      problems.push("index.html: CSP does not start from default-src 'self'");
    }
    for (const bad of ["'unsafe-inline'", "'unsafe-eval'"]) {
      if (policy.includes(bad)) problems.push(`index.html: CSP allows ${bad}`);
    }
    if (/https?:|\/\//.test(policy)) problems.push("index.html: CSP names an outside host");
  }

  let canonical = false;
  let appleIcon = false;
  for (const tag of tags) {
    if (tag.name === "script" && attr(tag, "src") === undefined) {
      problems.push("index.html: inline <script> found");
    }
    for (const { name } of tag.attrs) {
      if (/^on[a-z]/.test(name)) problems.push(`index.html: <${tag.name}> has ${name}= handler`);
      if (name === "style") problems.push(`index.html: <${tag.name}> has a style="" attribute`);
    }
    const rel = attr(tag, "rel")?.toLowerCase();
    const isCanonical = tag.name === "link" && rel === "canonical";
    if (isCanonical && attr(tag, "href") === CANONICAL_URL) canonical = true;
    if (tag.name === "link" && rel === "apple-touch-icon") appleIcon = true;
    for (const name of ["src", "href"]) {
      const value = attr(tag, name);
      if (value === undefined || (isCanonical && value === CANONICAL_URL)) continue;
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) {
        problems.push(`index.html: <${tag.name}> ${name} points off-origin: ${value}`);
      }
    }
  }
  if (!canonical) problems.push(`index.html: canonical link to ${CANONICAL_URL} is missing`);
  if (!appleIcon) problems.push("index.html: apple-touch-icon link is missing");
  return problems;
}

type ManifestIcon = { src?: string; sizes?: string; purpose?: string };
type Manifest = {
  name?: string;
  short_name?: string;
  id?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  icons?: ManifestIcon[];
};

export function checkManifest(manifest: Manifest): string[] {
  const problems: string[] = [];
  if (manifest.name !== "Breather") problems.push("manifest: name must be Breather");
  if (manifest.short_name !== "Breather") problems.push("manifest: short_name must be Breather");
  for (const key of ["id", "start_url", "scope"] as const) {
    if (manifest[key] !== "/breather/") problems.push(`manifest: ${key} must be /breather/`);
  }
  if (manifest.display !== "standalone") problems.push("manifest: display must be standalone");
  const icons = manifest.icons ?? [];
  for (const size of ["192x192", "512x512"]) {
    if (!icons.some((i) => i.sizes === size)) problems.push(`manifest: no ${size} icon`);
  }
  if (!icons.some((i) => i.purpose?.split(/\s+/).includes("maskable"))) {
    problems.push("manifest: no maskable icon");
  }
  return problems;
}

/** Shell files the app needs offline: html, manifest, icons and the font. */
export function checkPrecache(precached: Set<string>, files: string[]): string[] {
  const problems: string[] = [];
  for (const rel of files) {
    const kind = rel.endsWith(".woff2")
      ? "font"
      : /(?:^|\/)(?:icon|apple-touch-icon)[\w-]*\.png$/.test(rel)
        ? "icon"
        : rel === "manifest.webmanifest"
          ? "manifest"
          : rel === "index.html"
            ? "page"
            : null;
    if (kind && !precached.has(rel)) {
      problems.push(`${kind} is not in the service worker precache: ${rel}`);
    }
  }
  return problems;
}

/** The string the dev-only 2 minute timer button carries; it must never reach `dist/`. */
export const DEV_TIMER_MARK = "breather-dev-timer";

export function checkNoDevTimer(code: string, name: string): string[] {
  return code.includes(DEV_TIMER_MARK) ? [`dev-only 2 minute timer is in dist/: ${name}`] : [];
}
