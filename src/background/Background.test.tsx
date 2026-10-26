// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { Background } from "./Background";

describe("Background", () => {
  it("shows only the CSS gradient layer when no canvas context exists, with no error", async () => {
    const { container } = render(<Background />);
    expect(container.querySelector("canvas")).toBeNull();
    const layer = container.firstElementChild!;
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect((await axe(container)).violations).toEqual([]);
  });
});
