// Reads installed packages with the pinned licence checker. Local files only, no network.
// Erasable TypeScript only: Node runs this file directly from check-licenses.mjs.
import { init, type ModuleInfos } from "license-checker-rseidelsohn";
import { LICENSE_OVERRIDES, type Scope } from "./licenseRules.ts";

export function scanLicenses(start: string, scope: Scope): Promise<ModuleInfos> {
  return new Promise((resolve, reject) => {
    init(
      {
        start,
        production: scope === "production",
        excludePrivatePackages: true,
        // Ship the licence text from the package, not a guess from its README.
        customFormat: {
          name: "",
          version: "",
          licenses: "",
          repository: "",
          licenseText: "",
          licenseFile: "",
        },
      },
      (err, found) => {
        if (err) return reject(err);
        for (const [id, license] of Object.entries(LICENSE_OVERRIDES)) {
          if (found[id]) found[id] = { ...found[id], licenses: license };
        }
        // A README is not a licence: keep the text only when it came from a licence file.
        for (const [id, info] of Object.entries(found)) {
          if (!/(?:licen[sc]e|copying)[^/]*$/i.test(info.licenseFile ?? "")) {
            found[id] = { ...info, licenseText: undefined };
          }
        }
        resolve(found);
      }
    );
  });
}
