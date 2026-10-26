// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { App } from "./App";

afterEach(cleanup);

function Boom(): never {
  throw new Error("render failure");
}

describe("App", () => {
  it("passes an axe check", async () => {
    const { container } = render(<App />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("shows a fallback with a working Reload button when a child throws", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const onReload = vi.fn();
    render(
      <App onReload={onReload}>
        <Boom />
      </App>
    );
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls.some((c) => String(c[0]).includes("render failure"))).toBe(true);
    logged.mockRestore();
  });
});
