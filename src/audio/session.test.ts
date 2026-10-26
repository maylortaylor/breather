import { afterEach, describe, expect, it, vi } from "vitest";
import { beginAudio, resetSession, type SessionDeps } from "./session";
import { createFakeEngine } from "./fakeAudio";
import { restoreLaunch } from "../presets";
import type { AudioStatus } from "../store";

afterEach(resetSession);

const launch = restoreLaunch(null);

function deps(overrides: Partial<SessionDeps> = {}) {
  const statuses: AudioStatus[] = [];
  const resume = vi.fn(() => Promise.resolve());
  const setMaster = vi.fn();
  const engine = { ctx: { resume, state: "running" }, setMaster } as never;
  const d: SessionDeps = {
    createEngine: () => engine,
    hasAudio: () => true,
    onStatus: (s) => statuses.push(s),
    ...overrides,
  };
  return { d, statuses, resume, setMaster };
}

describe("beginAudio", () => {
  it("reports unsupported and returns null when AudioContext is missing", () => {
    const { d, statuses } = deps({ hasAudio: () => false });
    expect(beginAudio(launch, d.onStatus, d)).toBeNull();
    expect(statuses).toEqual(["unsupported"]);
  });

  it("reports unsupported when the engine cannot be created", () => {
    const { d, statuses } = deps({
      createEngine: () => {
        throw new Error("no audio");
      },
    });
    expect(beginAudio(launch, d.onStatus, d)).toBeNull();
    expect(statuses).toEqual(["unsupported"]);
  });
});

describe("beginAudio start", () => {
  it("resumes the context in the tap, sets master and starts the Sleep loops", () => {
    vi.useFakeTimers();
    const fake = createFakeEngine();
    const resume = vi.fn(() => Promise.resolve());
    Object.assign(fake.engine.ctx, { resume, state: "running" });
    const statuses: AudioStatus[] = [];
    const session = beginAudio(launch, (s) => statuses.push(s), {
      createEngine: () => fake.engine,
      hasAudio: () => true,
      onStatus: (s) => statuses.push(s),
    });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(session?.mixer.playing()).toEqual(["brown", "ocean", "bubbles", "whale-b"]);
    expect(fake.calls).toContain("master 0.7");
    expect(statuses).toEqual(["running"]);
    vi.useRealTimers();
  });

  it("reports needs-tap when the context later stops running", () => {
    vi.useFakeTimers();
    const fake = createFakeEngine();
    const ctx = Object.assign(fake.engine.ctx, {
      resume: vi.fn(),
      state: "running",
    }) as unknown as {
      state: string;
      onstatechange: () => void;
    };
    const statuses: AudioStatus[] = [];
    beginAudio(launch, (s) => statuses.push(s), {
      createEngine: () => fake.engine,
      hasAudio: () => true,
      onStatus: (s) => statuses.push(s),
    });
    ctx.state = "interrupted";
    ctx.onstatechange();
    expect(statuses).toEqual(["running", "needs-tap"]);
    vi.useRealTimers();
  });
});
