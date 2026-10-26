Type: grilling
Status: resolved
Blocked by: none

# What do the built-in presets contain, and what does the metronome do in seconds mode?

Define Sleep, Focus and Reset contents, confirm dropping the half and double buttons, and decide metronome behavior in seconds mode.

## Context
- Presets store slider levels, tempo, metronome level, sound, music mood and dim mode (`docs/PLAN.md` v1 features).
- The half and double buttons are an assumed drop; the tempo slider covers speed.
- Seconds mode decouples phases from tempo, but the doc never says what the metronome does then.

## How to resolve
Type `/grill-me`. Produces the preset table and the seconds-mode rule recorded under `## Answer`, and a `CONTEXT.md` entry for any new term.

## Answer
Decided with Matt on 2026-10-26.
- **What a preset saves:** every sound's level, its LFO and min/max range, each LFO's period and shape, tempo, metronome level and voice, pad mood, and dim mode. Master volume and the sleep timer are never saved, so a preset cannot make the speakers louder.
- **Built-ins** (tune by ear after the build):

| | Sleep | Focus | Reset |
|---|---|---|---|
| Sounds | brown noise, ocean on LFO 3, underwater bubbles, whale B very quiet | pink noise steady, Tonal pad low | ocean on LFO 1, Dreamy pad |
| Tempo | slow end, about 28 s a cycle | center, 60 BPM | center, 60 BPM |
| Metronome | heartbeat, phase changes only | off | heartbeat, phase changes only |
| Dim mode | on | off | off |

- **User presets:** built-ins are read-only. Changing one offers "Save as new". Up to 10 user presets, names up to 24 characters, stored on the device. No export or import in v1.
- **Switching:** a 3 s crossfade. Levels glide, new sounds fade in over 1.5 s, removed sounds fade out.
- **Half and double buttons:** dropped. The tempo slider with its center detent covers speed.
- **Seconds mode:** the metronome ticks once a second so ticks match the 4, 7, 8 count. The tempo slider is disabled, with a tooltip saying why.
- **Launch:** the first launch loads Sleep. Later launches restore the last mix, minus the timer and master volume.
