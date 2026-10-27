// Fails when an installed dependency has a licence outside the allow list (AGENTS.md rule 7).
// Production dependencies get the strict list; dev tools may also carry MPL-2.0 and a few
// permissive extras (scripts/licenseRules.ts). Usage: node scripts/check-licenses.mjs [dir]
import { resolve } from "node:path";
import { checkLicenses } from "./licenseRules.ts";
import { scanLicenses } from "./scanLicenses.ts";

const start = resolve(process.argv[2] ?? ".");
const failures = [];
for (const scope of ["production", "development"]) {
  const found = await scanLicenses(start, scope);
  const problems = checkLicenses(found, scope);
  console.log(
    `check-licenses: ${scope} ${Object.keys(found).length} packages, ${problems.length} problem(s)`
  );
  failures.push(...problems.map((p) => `[${scope}] ${p}`));
}
if (failures.length > 0) {
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("check-licenses: ok");
