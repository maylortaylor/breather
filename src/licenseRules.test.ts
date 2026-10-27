import { describe, expect, it } from "vitest";
import {
  checkLicenses,
  isAllowed,
  licenseOf,
  renderNotices,
  type PackageInfo,
} from "../scripts/licenseRules";

describe("isAllowed", () => {
  it.each(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "CC0-1.0"])(
    "allows %s in production",
    (id) => expect(isAllowed(id, "production")).toBe(true)
  );

  it.each(["Unlicense", "OFL-1.1", "(MIT OR CC0-1.0)", "(MIT AND ISC)"])(
    "allows %s in production",
    (id) => expect(isAllowed(id, "production")).toBe(true)
  );

  it.each([
    "GPL-3.0",
    "GPL-2.0-or-later",
    "AGPL-3.0",
    "LGPL-3.0",
    "CC-BY-NC-4.0",
    "CC-BY-NC-SA-4.0",
    "UNLICENSED",
    "UNKNOWN",
    "SEE LICENSE IN LICENSE.md",
    "MIT*",
    "",
  ])("denies %s in both scopes", (id) => {
    expect(isAllowed(id, "production")).toBe(false);
    expect(isAllowed(id, "development")).toBe(false);
  });

  it("allows MPL-2.0 and other dev-tool-only licences in development only", () => {
    for (const id of ["MPL-2.0", "BlueOak-1.0.0", "MIT-0", "CC-BY-4.0", "CC-BY-3.0"]) {
      expect(isAllowed(id, "production")).toBe(false);
      expect(isAllowed(id, "development")).toBe(true);
    }
  });

  it("takes either side of OR, needs both sides of AND", () => {
    expect(isAllowed("(GPL-3.0 OR MIT)", "production")).toBe(true);
    expect(isAllowed("(GPL-3.0 AND MIT)", "production")).toBe(false);
    expect(isAllowed("(MIT AND CC-BY-3.0)", "development")).toBe(true);
    expect(isAllowed("(MIT AND CC-BY-3.0)", "production")).toBe(false);
  });

  it("never lets a deny pattern through a dev allowance", () => {
    expect(isAllowed("CC-BY-NC-3.0", "development")).toBe(false);
  });
});

describe("licenseOf", () => {
  it("joins an array into an OR expression and trims the guess star", () => {
    expect(licenseOf({ licenses: ["MIT", "ISC"] })).toBe("(MIT OR ISC)");
    expect(licenseOf({ licenses: "MIT" })).toBe("MIT");
    expect(licenseOf({})).toBe("UNKNOWN");
  });
});

describe("checkLicenses", () => {
  const pkgs: Record<string, PackageInfo> = {
    "a@1.0.0": { licenses: "MIT" },
    "b@2.0.0": { licenses: "GPL-3.0" },
    "c@3.0.0": { licenses: "BSD*" },
  };

  it("reports each disallowed package with its licence", () => {
    expect(checkLicenses(pkgs, "production")).toEqual([
      "b@2.0.0: GPL-3.0 is not allowed",
      "c@3.0.0: BSD* is not allowed",
    ]);
  });

  it("accepts a package through a recorded override", () => {
    expect(checkLicenses(pkgs, "production", { "c@3.0.0": "BSD-3-Clause" })).toEqual([
      "b@2.0.0: GPL-3.0 is not allowed",
    ]);
  });

  it("returns nothing when every package passes", () => {
    expect(checkLicenses({ "a@1.0.0": { licenses: "MIT" } }, "production")).toEqual([]);
  });
});

describe("renderNotices", () => {
  it("lists packages sorted by name with licence and text, and a header", () => {
    const out = renderNotices({
      "zed@1.0.0": { licenses: "MIT", licenseText: "Zed text" },
      "alpha@2.0.0": { licenses: "ISC", licenseText: "Alpha text", repository: "https://x/a" },
    });
    expect(out.startsWith("Third-party notices for Breather")).toBe(true);
    expect(out.indexOf("alpha@2.0.0")).toBeLessThan(out.indexOf("zed@1.0.0"));
    expect(out).toContain("alpha@2.0.0\nLicense: ISC\nhttps://x/a\n\nAlpha text");
    expect(out).toContain("Zed text");
  });

  it("says so when a package has no licence text", () => {
    expect(renderNotices({ "q@1.0.0": { licenses: "MIT" } })).toContain(
      "(no licence file in the package; its package.json declares MIT)"
    );
  });

  it("appends extra entries such as the font after the packages", () => {
    const out = renderNotices({ "a@1.0.0": { licenses: "MIT", licenseText: "A" } }, [
      { name: "Nunito", license: "OFL-1.1", text: "Font text\n" },
    ]);
    expect(out.indexOf("a@1.0.0")).toBeLessThan(out.indexOf("Nunito"));
    expect(out).toContain("Nunito\nLicense: OFL-1.1\n\nFont text");
  });
});
