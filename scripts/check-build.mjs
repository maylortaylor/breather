// Guards stylex #1918: a CSS-only change renames the CSS asset without updating its reference.
// Run after `npm run build`. Asserts every CSS/JS asset that index.html or a JS chunk references
// exists in dist/, and that every one of them is in the service worker precache list.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { checkHtml, checkManifest, checkPrecache } from "./buildRules.ts";

const BASE = "/breather/";
const dist = new URL("../dist/", import.meta.url).pathname;
const failures = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const toRel = (url) => posix.normalize(url.startsWith(BASE) ? url.slice(BASE.length) : url);
const isAsset = (rel) => /\.(css|js)$/.test(rel);

if (!existsSync(join(dist, "index.html"))) {
  console.error("check-build: dist/index.html missing, run npm run build first");
  process.exit(1);
}

// 0. The page: CSP meta, no inline source, nothing off-origin, canonical and touch icon.
// The CSP forbids what these rules forbid, so a failure here is a page that would break in use.
const html = readFileSync(join(dist, "index.html"), "utf8");
failures.push(...checkHtml(html));

// 1. References from index.html and from JS chunks.
const referenced = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:css|js))"/g)) {
  referenced.add(toRel(m[1]));
}
const files = walk(dist).map((f) => f.slice(dist.length));
for (const rel of files.filter((f) => f.endsWith(".js") && f.startsWith("assets/"))) {
  const code = readFileSync(join(dist, rel), "utf8");
  for (const m of code.matchAll(
    /["'`]((?:\.\/|\/breather\/)?(?:assets\/)?[\w.-]+\.(?:css|js))["'`]/g
  )) {
    const ref = m[1];
    const candidate = ref.startsWith("./")
      ? posix.join(posix.dirname(rel), ref)
      : ref.startsWith(BASE)
        ? toRel(ref)
        : ref.startsWith("assets/")
          ? ref
          : posix.join(posix.dirname(rel), ref);
    // Library strings such as "index.js" only count when a matching hashed asset is expected.
    if (candidate.startsWith("assets/")) referenced.add(candidate);
  }
}
for (const rel of referenced) {
  if (!existsSync(join(dist, rel))) failures.push(`referenced asset is missing from dist/: ${rel}`);
}

// 2. Precache list in sw.js.
const swPath = join(dist, "sw.js");
if (!existsSync(swPath)) {
  failures.push("dist/sw.js is missing");
} else {
  const sw = readFileSync(swPath, "utf8");
  const precached = new Set([...sw.matchAll(/\{url:"([^"]+)"/g)].map((m) => m[1]));
  const built = files.filter(isAsset).filter((f) => f.startsWith("assets/"));
  for (const rel of new Set([...referenced, ...built])) {
    if (!precached.has(rel)) failures.push(`asset is not in the service worker precache: ${rel}`);
  }
  // The shell (page, manifest, icons, font) must work offline.
  failures.push(...checkPrecache(precached, files));
  // Fonts ship with their licence text (AGENTS.md rule 6).
  for (const rel of files.filter((f) => f.endsWith(".woff2"))) {
    if (!existsSync(join(dist, posix.dirname(rel), "OFL.txt"))) {
      failures.push(`font has no OFL.txt beside it: ${rel}`);
    }
  }
  // The licence notices ship and work offline (MIT needs them in every copy).
  if (!precached.has("notices.txt")) {
    failures.push("notices.txt is not in the service worker precache");
  }
  for (const url of precached) {
    if (!existsSync(join(dist, url))) failures.push(`precache entry is missing from dist/: ${url}`);
  }
}

// 2a. The licence notices: present, and naming what ships.
if (!existsSync(join(dist, "notices.txt"))) {
  failures.push("dist/notices.txt is missing");
} else {
  const notices = readFileSync(join(dist, "notices.txt"), "utf8");
  for (const name of ["react@", "three@", "Nunito"]) {
    if (!notices.includes(name)) failures.push(`dist/notices.txt does not mention ${name}`);
  }
}

// 2b. The manifest.
if (existsSync(join(dist, "manifest.webmanifest"))) {
  const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
  failures.push(...checkManifest(manifest));
  for (const icon of manifest.icons ?? []) {
    if (!existsSync(join(dist, icon.src))) failures.push(`manifest icon is missing: ${icon.src}`);
  }
} else {
  failures.push("dist/manifest.webmanifest is missing");
}

// 3. The dev-only Listening Lab must not ship.
for (const rel of files) {
  if (/\.(?:html|js|css|map|json|webmanifest)$/.test(rel)) {
    if (readFileSync(join(dist, rel), "utf8").includes("Listening Lab")) {
      failures.push(`dev-only Lab code is in dist/: ${rel}`);
    }
  }
}

// 4. Registration scope.
const reg = existsSync(join(dist, "registerSW.js"))
  ? readFileSync(join(dist, "registerSW.js"), "utf8")
  : "";
if (!reg.includes(`register('${BASE}sw.js', { scope: '${BASE}' })`)) {
  failures.push(`registerSW.js does not register ${BASE}sw.js with scope ${BASE}`);
}

if (failures.length > 0) {
  console.error(`check-build: ${failures.length} problem(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-build: ok (${referenced.size} referenced, all present and precached)`);
