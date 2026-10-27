import { afterEach, describe, expect, it, vi } from "vitest";
import { beginAudio, resetSession, resumeAudio, type SessionDeps } from "./session";
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

describe("beginAudio after a sleep timer ended (AC4)", () => {
  it("reuses the context but resumes it, restores master and starts the mix again", () => {
    vi.useFakeTimers();
    const fake = createFakeEngine();
    const resume = vi.fn(() => Promise.resolve());
    Object.assign(fake.engine.ctx, { resume, state: "running" });
    const d: SessionDeps = {
      createEngine: () => fake.engine,
      hasAudio: () => true,
      onStatus: () => {},
    };
    const first = beginAudio(launch, d.onStatus, d)!;
    first.mixer.stopAll(0.1);
    vi.advanceTimersByTime(200);
    expect(first.mixer.playing()).toEqual([]);
    fake.calls.length = 0;
    const second = beginAudio(launch, d.onStatus, d);
    expect(second).toBe(first);
    expect(resume).toHaveBeenCalledTimes(2);
    expect(fake.calls).toContain("master 0.7");
    expect(second?.mixer.playing()).toEqual(["brown", "ocean", "bubbles", "whale-b"]);
    vi.useRealTimers();
  });
});

describe("iOS audio session (tickets 07 and 29)", () => {
  function setup(state = "running") {
    vi.useFakeTimers();
    const order: string[] = [];
    const fake = createFakeEngine();
    const ctx = Object.assign(fake.engine.ctx, { state }) as unknown as {
      state: string;
      resume: () => Promise<void>;
      onstatechange: () => void;
    };
    ctx.resume = vi.fn(() => {
      order.push("resume");
      return Promise.resolve();
    });
    const audioSession = {
      set type(v: string) {
        order.push(`type:${v}`);
      },
    } as { type: string };
    const statuses: AudioStatus[] = [];
    const keep = { play: vi.fn(), stop: vi.fn() };
    const media: string[] = [];
    let wake: () => void = () => {};
    let presetChanged: (n: string) => void = () => {};
    const unlisten = vi.fn();
    const d: SessionDeps = {
      createEngine: () => {
        order.push("engine");
        return fake.engine;
      },
      hasAudio: () => true,
      onStatus: (s) => statuses.push(s),
      audioSession,
      startKeepAlive: () => {
        order.push("keepalive");
        return keep;
      },
      setMedia: (n) => media.push(n),
      watchPreset: (fn) => {
        presetChanged = fn;
        return () => {};
      },
      listen: (fn) => {
        wake = fn;
        return unlisten;
      },
    };
    return {
      d,
      ctx,
      order,
      statuses,
      keep,
      media,
      wake: () => wake(),
      presetChanged: (n: string) => presetChanged(n),
      unlisten,
    };
  }
  afterEach(() => vi.useRealTimers());

  it("AC1 sets the playback type before the context is made or resumed", () => {
    const s = setup();
    beginAudio(launch, s.d.onStatus, s.d);
    expect(s.order.slice(0, 3)).toEqual(["type:playback", "engine", "resume"]);
  });

  it("AC1 runs without audioSession where the browser has none", () => {
    const s = setup();
    expect(beginAudio(launch, s.d.onStatus, { ...s.d, audioSession: null })).not.toBeNull();
    expect(s.order).not.toContain("type:playback");
  });

  it("AC2 starts the silent loop in the same tap, after the resume", () => {
    const s = setup();
    beginAudio(launch, s.d.onStatus, s.d);
    expect(s.order).toEqual(["type:playback", "engine", "resume", "keepalive"]);
  });

  it("AC3 suspended and interrupted need a tap; closed does not", () => {
    const s = setup();
    beginAudio(launch, s.d.onStatus, s.d);
    s.ctx.state = "suspended";
    s.ctx.onstatechange();
    s.ctx.state = "interrupted";
    s.ctx.onstatechange();
    s.ctx.state = "closed";
    s.ctx.onstatechange();
    expect(s.statuses).toEqual(["running", "needs-tap", "needs-tap"]);
  });

  it("AC3 a context still idle after the first resume shows the tap control", async () => {
    const s = setup("suspended");
    beginAudio(launch, s.d.onStatus, s.d);
    await Promise.resolve();
    await Promise.resolve();
    expect(s.statuses).toEqual(["running", "needs-tap"]);
  });

  it("AC4 a tap or a return to the tab resumes an interrupted context", async () => {
    const s = setup();
    const session = beginAudio(launch, s.d.onStatus, s.d)!;
    s.ctx.state = "interrupted";
    s.ctx.resume = vi.fn(() => {
      s.ctx.state = "running";
      return Promise.resolve();
    });
    s.wake();
    await Promise.resolve();
    await Promise.resolve();
    expect(s.ctx.resume).toHaveBeenCalledTimes(1);
    expect(s.statuses.at(-1)).toBe("running");
    expect(await session.resume()).toBe(true);
  });

  it("AC4 a wake while running does nothing", () => {
    const s = setup();
    beginAudio(launch, s.d.onStatus, s.d);
    const calls = (s.ctx.resume as ReturnType<typeof vi.fn>).mock.calls.length;
    s.wake();
    expect(s.ctx.resume).toHaveBeenCalledTimes(calls);
  });

  it("AC4 a rejected resume keeps the control and reports nothing else", async () => {
    const s = setup();
    const session = beginAudio(launch, s.d.onStatus, s.d)!;
    s.ctx.state = "interrupted";
    s.ctx.onstatechange();
    s.ctx.resume = vi.fn(() => Promise.reject(new Error("InvalidStateError")));
    expect(await session.resume()).toBe(false);
    s.wake();
    await Promise.resolve();
    await Promise.resolve();
    expect(s.statuses.filter((x) => x === "running")).toHaveLength(1);
    expect(s.statuses.at(-1)).toBe("needs-tap");
  });

  it("AC4 resumeAudio is false with no session", async () => {
    expect(await resumeAudio()).toBe(false);
  });

  it("AC6 sets the preset name at Begin and when the preset changes", () => {
    const s = setup();
    beginAudio(launch, s.d.onStatus, s.d);
    expect(s.media).toEqual(["Sleep"]);
    s.presetChanged("Focus");
    expect(s.media).toEqual(["Sleep", "Focus"]);
  });

  it("a second Begin restarts the silent loop; reset stops it and the listeners", () => {
    const s = setup();
    beginAudio(launch, s.d.onStatus, s.d);
    beginAudio(launch, s.d.onStatus, s.d);
    expect(s.keep.play).toHaveBeenCalledTimes(1);
    resetSession();
    expect(s.keep.stop).toHaveBeenCalled();
    expect(s.unlisten).toHaveBeenCalled();
  });
});
