import { expect, it } from "vite-plus/test";
import { CATALOG, TRIMS } from "./catalog";

// Named drift guard: a new sound without a measured trim would silently play at the wrong level.
it("every sound except the test tone has a level-match trim, and no trim is orphaned", () => {
  const ids = CATALOG.map((e) => e.id).filter((id) => id !== "test-tone");
  expect(ids.filter((id) => !(id in TRIMS))).toEqual([]);
  expect(Object.keys(TRIMS).filter((id) => !ids.includes(id))).toEqual([]);
});
