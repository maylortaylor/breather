import { describe, expect, it } from "vitest";
import { D1, D2 } from "../breath/tempo";
import {
  inhaleHint,
  inhaleSeconds,
  labelWidth,
  layoutLabels,
  THUMB_PX,
  metronomeText,
  releaseTempo,
  settleMetronome,
  stepMetronome,
  stepTempo,
  tempoText,
  VOICES,
} from "./breathLogic";

describe("inhaleSeconds", () => {
  it("is 4 beats: 6 s slowest, 4 s at center, 3 s fastest", () => {
    expect(inhaleSeconds(0, false)).toBe(6);
    expect(inhaleSeconds(0.5, false)).toBe(4);
    expect(inhaleSeconds(1, false)).toBe(3);
  });

  it("rounds to the nearest second", () => {
    // 45 BPM: 4 x 1.333 = 5.33 s. 70 BPM: 4 x 0.857 = 3.43 s.
    expect(inhaleSeconds(0.125, false)).toBe(5);
    expect(inhaleSeconds(0.75, false)).toBe(3);
    // 41 BPM is 5.85 s.
    expect(inhaleSeconds(0.025, false)).toBe(6);
  });

  it("is 4 s in seconds mode whatever the slider says", () => {
    expect(inhaleSeconds(0, true)).toBe(4);
    expect(inhaleSeconds(1, true)).toBe(4);
  });

  it("builds the hint text", () => {
    expect(inhaleHint(0.5, false)).toBe("Inhale about 4s");
    expect(inhaleHint(0, false)).toBe("Inhale about 6s");
  });
});

describe("tempoText", () => {
  it("names the center, each side and the ends, with no digits", () => {
    expect(tempoText(0.5)).toBe("Resting pace");
    expect(tempoText(0.49)).toBe("Resting pace");
    expect(tempoText(0.25)).toBe("Slow");
    expect(tempoText(0)).toBe("Slowest");
    expect(tempoText(0.75)).toBe("Fast");
    expect(tempoText(1)).toBe("Fastest");
    for (let v = 0; v <= 1; v += 0.05) expect(tempoText(v)).not.toMatch(/\d/);
  });
});

describe("tempo detent", () => {
  it("snaps to exactly 0.5 on release near the center only", () => {
    expect(releaseTempo(0.51)).toBe(0.5);
    expect(releaseTempo(0.48)).toBe(0.5);
    expect(releaseTempo(0.54)).toBe(0.54);
    expect(releaseTempo(0.2)).toBe(0.2);
  });

  it("steps by arrow keys and lands on the center before crossing it", () => {
    expect(stepTempo(0.2, 1)).toBeCloseTo(0.225, 6);
    expect(stepTempo(0.49, 1)).toBe(0.5);
    expect(stepTempo(0.52, -1)).toBe(0.5);
    // Leaves the center in either direction, so the key never sticks.
    expect(stepTempo(0.5, 1)).toBeCloseTo(0.525, 6);
    expect(stepTempo(0.5, -1)).toBeCloseTo(0.475, 6);
    expect(stepTempo(1, 1)).toBe(1);
    expect(stepTempo(0, -1)).toBe(0);
  });
});

describe("metronome detents", () => {
  it("snaps to off, D1 or D2 at or below D2 and moves freely above", () => {
    expect(settleMetronome(0.05)).toBe(0);
    expect(settleMetronome(0.15)).toBe(D1);
    expect(settleMetronome(0.35)).toBe(D2);
    expect(settleMetronome(D2)).toBe(D2);
    expect(settleMetronome(0.43)).toBe(0.43);
    expect(settleMetronome(1)).toBe(1);
  });

  it("steps from stop to stop below D2 and by a fixed amount above it", () => {
    expect(stepMetronome(0, 1)).toBe(D1);
    expect(stepMetronome(D1, 1)).toBe(D2);
    expect(stepMetronome(D2, 1)).toBeCloseTo(D2 + 0.05, 6);
    expect(stepMetronome(D2 + 0.05, -1)).toBe(D2);
    expect(stepMetronome(D2 + 0.02, -1)).toBe(D2);
    expect(stepMetronome(D2, -1)).toBe(D1);
    expect(stepMetronome(D1, -1)).toBe(0);
    expect(stepMetronome(0, -1)).toBe(0);
    expect(stepMetronome(0.98, 1)).toBe(1);
    expect(stepMetronome(1, 1)).toBe(1);
  });

  it("describes the level without numbers", () => {
    expect(metronomeText(0)).toBe("Off");
    expect(metronomeText(D1)).toBe("Phase changes only");
    expect(metronomeText(D2)).toBe("All beats, very quiet");
    expect(metronomeText(0.55)).toBe("All beats, soft");
    expect(metronomeText(0.75)).toBe("All beats");
    expect(metronomeText(1)).toBe("All beats, loud");
  });
});

describe("voices", () => {
  it("lists the four voices by name, the heartbeat thump first", () => {
    expect(VOICES.map((v) => v.label)).toEqual([
      "Heartbeat thump",
      "Wood block",
      "Soft tick 700 Hz",
      "Soft tick 350 Hz",
    ]);
    expect(VOICES[0]!.id).toBe("metro-heartbeat-thump");
  });
});

describe("layoutLabels", () => {
  const items = [
    { at: 0, text: "Off" },
    { at: D1, text: "Phase" },
    { at: D2, text: "Beats" },
    { at: 1, text: "Louder", align: "end" as const },
  ];

  // Boxes by row, so a test can assert that none overlap.
  const boxes = (rows: number[], px: number) =>
    items.map((it, i) => {
      const w = labelWidth(it.text);
      const left = it.align === "end" ? px - w : THUMB_PX / 2 + (px - THUMB_PX) * it.at - w / 2;
      return { row: rows[i]!, left, right: left + w };
    });

  it("keeps adjacent labels from overlapping at a 300 px track", () => {
    const rows = layoutLabels(items, 300);
    const b = boxes(rows, 300);
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        if (b[i]!.row !== b[j]!.row) continue;
        expect(b[i]!.right <= b[j]!.left || b[j]!.right <= b[i]!.left).toBe(true);
      }
    }
  });

  it("uses one row when there is room, and a second when the track is too short", () => {
    expect(layoutLabels(items, 300)).toEqual([0, 0, 0, 0]);
    expect(Math.max(...layoutLabels(items, 140))).toBe(1);
  });
});
