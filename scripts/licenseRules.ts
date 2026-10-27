// Pure licence rules, shared by check-licenses.mjs (enforces them) and the build's notices
// plugin in vite.config.ts. Erasable TypeScript only: Node runs this file directly.
// Policy: docs/research/license-provenance.md section 5, AGENTS.md rule 7.

export type Scope = "production" | "development";

export type PackageInfo = {
  licenses?: string | string[] | undefined;
  licenseText?: string | undefined;
  repository?: string | undefined;
};

// Ships to users: nothing outside this list may reach the bundle. OFL-1.1 is for font packages.
const PRODUCTION = [
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "CC0-1.0",
  "Unlicense",
  "OFL-1.1",
];

// Dev tools never reach dist/. MPL-2.0 is file-level copyleft that only binds changes to the
// tool's own files (axe-core, lightningcss). BlueOak and MIT-0 are permissive. The CC-BY ones are
// browser data and SPDX tables inside dev tooling, with attribution kept in node_modules.
const DEVELOPMENT_ONLY = ["MPL-2.0", "BlueOak-1.0.0", "MIT-0", "CC-BY-3.0", "CC-BY-4.0"];

const DENIED = /GPL|CC-BY-NC|CC-BY-ND|UNLICENSED|UNKNOWN|SEE LICENSE|\*|^$/i;

// Packages whose metadata says a bare "BSD". Each was read from its own LICENSE file.
// css-mediaquery: three-clause BSD (Yahoo), a StyleX dependency that ships in the bundle.
export const LICENSE_OVERRIDES: Record<string, string> = { "css-mediaquery@0.1.2": "BSD-3-Clause" };

/** One expression: a single id, or a parenthesised `A OR B` / `A AND B`. */
export function isAllowed(expression: string, scope: Scope): boolean {
  const expr = expression.trim();
  const inner = expr.startsWith("(") && expr.endsWith(")") ? expr.slice(1, -1) : expr;
  if (/\sOR\s/.test(inner)) return inner.split(/\sOR\s/).some((part) => isAllowed(part, scope));
  if (/\sAND\s/.test(inner)) return inner.split(/\sAND\s/).every((part) => isAllowed(part, scope));
  if (DENIED.test(inner)) return false;
  const allowed = scope === "production" ? PRODUCTION : [...PRODUCTION, ...DEVELOPMENT_ONLY];
  return allowed.includes(inner);
}

/** The checker reports a string, or an array when a package lists several licences. */
export function licenseOf(info: PackageInfo): string {
  const value = info.licenses;
  if (Array.isArray(value)) return value.length > 1 ? `(${value.join(" OR ")})` : (value[0] ?? "");
  return value ? value : "UNKNOWN";
}

/**
 * Problems, one per disallowed package. `overrides` maps `name@version` to the licence read from
 * the package's own licence file, for packages whose metadata is vague (a bare "BSD").
 */
export function checkLicenses(
  packages: Record<string, PackageInfo>,
  scope: Scope,
  overrides: Record<string, string> = {}
): string[] {
  const problems: string[] = [];
  for (const [id, info] of Object.entries(packages)) {
    const license = overrides[id] ?? licenseOf(info);
    if (!isAllowed(license, scope)) problems.push(`${id}: ${license} is not allowed`);
  }
  return problems.sort();
}

export type Extra = { name: string; license: string; text: string };

/** The text shipped as dist/notices.txt: each package, its licence id and its licence text. */
export function renderNotices(packages: Record<string, PackageInfo>, extras: Extra[] = []): string {
  const sections = Object.keys(packages)
    .sort()
    .map((id) => {
      const info = packages[id] as PackageInfo;
      const link = info.repository ? `${info.repository}\n` : "";
      const text =
        info.licenseText?.trim() ||
        `(no licence file in the package; its package.json declares ${licenseOf(info)})`;
      return `${id}\nLicense: ${licenseOf(info)}\n${link}\n${text}`;
    });
  for (const extra of extras) {
    sections.push(`${extra.name}\nLicense: ${extra.license}\n\n${extra.text.trim()}`);
  }
  const rule = "\n\n" + "-".repeat(72) + "\n\n";
  return (
    "Third-party notices for Breather\n\n" +
    "Breather itself is MIT licensed. These are the packages and fonts that ship in the app.\n" +
    rule +
    sections.join(rule) +
    "\n"
  );
}
