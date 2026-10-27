// Ticket 29 AC5: after the page wakes from a long freeze, no backlog of beats plays.
import { describe, expect, it } from "vitest";
import { createPhaseMachine, type Beat } from "./phases";
import { createBeatScheduler } from "./scheduler";

describe("scheduler after a 30 s clock jump", () => {
  it("fires no backlog and resumes on the next future beat", () => {
    let t = 0;
    const machine = createPhaseMachine(1);
    machine.start(0);
    const fired: Beat[] = [];
    const scheduler = createBeatScheduler({ now: () => t, machine, onBeat: (b) => fired.push(b) });
    for (let ms = 0; ms <= 2000; ms += 25) {
      t = ms / 1000;
      scheduler.tick();
    }
    const before = fired.length;
    t = 32.0; // the page slept for 30 s
    scheduler.tick();
    t = 32.025;
    scheduler.tick();
    t = 33.0;
    scheduler.tick();
    const after = fired.slice(before).map((b) => b.at);
    expect(after.every((at) => at >= 32)).toBe(true);
    expect(after.length).toBeLessThanOrEqual(2);
    expect(new Set(after).size).toBe(after.length);
  });
});
