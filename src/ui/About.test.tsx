// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { About, NOTICES_HREF } from "./About";

afterEach(cleanup);

describe("About", () => {
  it("credits Nunito, three.js and React with their licences", () => {
    render(<About />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Nunito (SIL OFL)");
    expect(text).toContain("three.js (MIT)");
    expect(text).toContain("React (MIT)");
  });

  it("links the notices file under the app base, opening a new tab", () => {
    render(<About />);
    const link = screen.getByRole("link", { name: "Licence notices" });
    expect(link.getAttribute("href")).toBe(NOTICES_HREF);
    expect(NOTICES_HREF.endsWith("/notices.txt")).toBe(true);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
  });
});
