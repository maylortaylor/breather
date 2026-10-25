Type: grilling
Status: open
Blocked by: none

# What do the built-in presets contain, and what does the metronome do in seconds mode?

Define Sleep, Focus and Reset contents, confirm dropping the half and double buttons, and decide metronome behavior in seconds mode.

## Context
- Presets store slider levels, tempo, metronome level, sound, music mood and dim mode (`docs/PLAN.md` v1 features).
- The half and double buttons are an assumed drop; the tempo slider covers speed.
- Seconds mode decouples phases from tempo, but the doc never says what the metronome does then.

## How to resolve
Type `/grill-me`. Produces the preset table and the seconds-mode rule recorded under `## Answer`, and a `CONTEXT.md` entry for any new term.
