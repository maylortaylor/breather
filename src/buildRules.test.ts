import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_URL,
  CSP,
  checkHtml,
  checkManifest,
  checkNoDevTimer,
  DEV_TIMER_MARK,
  checkPrecache,
  withCsp,
} from "../scripts/buildRules";

const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
const canonical = `<link rel="canonical" href="${CANONICAL_URL}" />`;
const apple = `<link rel="apple-touch-icon" href="/breather/apple-touch-icon.png" />`;
const good = (extra = "") =>
  `<!doctype html><html><head>${cspMeta}${canonical}${apple}` +
  `<script type="module" src="/breather/assets/a.js"></script>` +
  `<link rel="stylesheet" href="/breather/assets/a.css"></head><body><div id="root"></div>${extra}</body></html>`;

describe("CSP", () => {
  it("starts from default-src 'self' and never allows eval or inline code", () => {
    expect(CSP.startsWith("default-src 'self';")).toBe(true);
    expect(CSP).toContain("media-src 'self' blob:");
    expect(CSP).not.toMatch(/unsafe-/);
    expect(CSP).not.toMatch(/https?:/);
  });

  it("withCsp inserts the meta once, right after the charset", () => {
    const out = withCsp(`<head><meta charset="UTF-8" /><title>x</title></head>`);
    expect(out).toContain(`<meta charset="UTF-8" />${"\n    "}<meta http-equiv`);
    expect(out.match(/Content-Security-Policy/g)).toHaveLength(1);
  });
});

describe("checkHtml", () => {
  it("accepts a clean page", () => {
    expect(checkHtml(good())).toEqual([]);
  });

  it("flags a missing CSP meta", () => {
    expect(checkHtml(good().replace(cspMeta, ""))).toEqual([
      expect.stringContaining("Content-Security-Policy meta is missing"),
    ]);
  });

  it("flags a CSP without default-src 'self' or with unsafe sources", () => {
    const weak = good().replace(CSP, "script-src 'self' 'unsafe-inline'");
    const problems = checkHtml(weak);
    expect(problems.some((p) => p.includes("default-src 'self'"))).toBe(true);
    expect(problems.some((p) => p.includes("unsafe-inline"))).toBe(true);
  });

  it("flags an inline script but not an external one", () => {
    expect(checkHtml(good("<script>alert(1)</script>"))).toEqual([
      expect.stringContaining("inline <script>"),
    ]);
  });

  it("flags on* handler attributes and style attributes", () => {
    const problems = checkHtml(good(`<button onclick="x()" STYLE="color:red">b</button>`));
    expect(problems).toEqual([
      expect.stringContaining("onclick"),
      expect.stringContaining("style"),
    ]);
  });

  it("does not mistake data-on or aria attributes for handlers", () => {
    expect(checkHtml(good(`<div data-one="1" aria-label="once"></div>`))).toEqual([]);
  });

  it("flags off-origin src and href but not the canonical link", () => {
    const problems = checkHtml(
      good(`<img src="https://cdn.example.com/a.png"><a href="//evil.test/x">x</a>`)
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("https://cdn.example.com/a.png");
    expect(problems[1]).toContain("//evil.test/x");
  });

  it("flags a missing or wrong canonical link", () => {
    expect(checkHtml(good().replace(canonical, ""))).toEqual([
      expect.stringContaining("canonical link"),
    ]);
    const wrong = good().replace(CANONICAL_URL, "https://roboborealis.com/other/");
    expect(checkHtml(wrong).some((p) => p.includes("canonical link"))).toBe(true);
  });

  it("flags a missing apple-touch-icon link", () => {
    expect(checkHtml(good().replace(apple, ""))).toEqual([
      expect.stringContaining("apple-touch-icon"),
    ]);
  });
});

describe("checkManifest", () => {
  const manifest = {
    name: "Breather",
    short_name: "Breather",
    id: "/breather/",
    start_url: "/breather/",
    scope: "/breather/",
    display: "standalone",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  it("accepts the full manifest", () => {
    expect(checkManifest(manifest)).toEqual([]);
  });

  it("flags a missing maskable icon, a missing size and a wrong scope", () => {
    const icons = manifest.icons.filter((i) => i.purpose !== "maskable" && i.sizes !== "192x192");
    const problems = checkManifest({ ...manifest, icons, scope: "/" });
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toMatch(/maskable/);
    expect(problems.join("\n")).toMatch(/192x192/);
    expect(problems.join("\n")).toMatch(/scope/);
  });
});

describe("checkPrecache", () => {
  const files = [
    "index.html",
    "manifest.webmanifest",
    "icon-192.png",
    "icon-512.png",
    "icon-maskable-512.png",
    "apple-touch-icon.png",
    "fonts/Nunito-latin-variable.woff2",
    "fonts/OFL.txt",
    "assets/a.js",
  ];

  it("accepts a precache that lists every shell file", () => {
    const precached = new Set(files.filter((f) => !f.endsWith(".txt")));
    expect(checkPrecache(precached, files)).toEqual([]);
  });

  it("flags the font, an icon and the manifest when they are missing", () => {
    const precached = new Set(["index.html", "assets/a.js", "icon-192.png"]);
    const problems = checkPrecache(precached, files);
    expect(problems.join("\n")).toMatch(/font.*Nunito-latin-variable\.woff2/);
    expect(problems.join("\n")).toMatch(/icon-512\.png/);
    expect(problems.join("\n")).toMatch(/apple-touch-icon\.png/);
    expect(problems.join("\n")).toMatch(/manifest\.webmanifest/);
    expect(problems.join("\n")).not.toMatch(/icon-192\.png/);
  });
});

describe("checkNoDevTimer (AC7)", () => {
  it("flags the dev timer marker in a built file", () => {
    expect(checkNoDevTimer(`x("${DEV_TIMER_MARK}")`, "assets/a.js")).toEqual([
      "dev-only 2 minute timer is in dist/: assets/a.js",
    ]);
  });

  it("accepts a file without it", () => {
    expect(checkNoDevTimer("const a = 2;", "assets/a.js")).toEqual([]);
  });

  it("matches the marker the timer button actually carries", () => {
    const source = readFileSync("src/ui/SleepTimer.tsx", "utf8");
    expect(source).toContain(DEV_TIMER_MARK);
  });
});
