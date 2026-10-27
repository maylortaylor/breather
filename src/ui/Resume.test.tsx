// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DEFAULT_STATE, store } from "../store";
import { RESUME_LABEL, Resume } from "./Resume";
import * as session from "../audio/session";

afterEach(() => {
  cleanup();
  store.set({ audio: DEFAULT_STATE.audio });
  vi.restoreAllMocks();
});

describe("Resume", () => {
  it("shows nothing while the sound runs", () => {
    store.set({ audio: "running" });
    render(<Resume />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the control when a tap is needed and resumes on press", async () => {
    const spy = vi.spyOn(session, "resumeAudio").mockResolvedValue(true);
    store.set({ audio: "needs-tap" });
    const { container } = render(<Resume />);
    fireEvent.click(screen.getByRole("button", { name: RESUME_LABEL }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await axe(container)).violations).toEqual([]);
  });
});
