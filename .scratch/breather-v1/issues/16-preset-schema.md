Type: build
Status: claimed
Blocked by: 14
Model: sonnet

# Write the preset schema, built-ins and user-preset rules test-first

Give the app one pure module that defines a mix, the three built-in presets, and safe parsing of anything read from storage.

## Context
- Spec "State and preset schema": `Mix`, `Preset`, `SoundSetting`, `LfoSetting`, version 1, `breather.state` and `breather.presets`.
- Ticket 06 Answer: what a preset saves, the Sleep, Focus and Reset table, 10 user presets, names up to 24 characters, built-ins read-only.
- ADR-0003 Tests: preset save and load is pure logic, test-first, under the 75% gate.
- Master volume and the sleep timer are never part of a preset (ticket 06).

## Acceptance criteria
1. `src/presets.ts` exports the types, `BUILT_INS` (Sleep, Focus, Reset per the ticket 06 table) and `DEFAULT_MIX` equal to Sleep's mix.
2. `parsePreset(unknown)` and `parseState(unknown)` drop unknown sound ids, clamp levels to 0..1 and LFO periods to 8..120, and return null for a missing or higher `version`; tests cover each case.
3. A test round-trips every built-in through JSON and `parsePreset` and gets an equal object.
4. `saveUserPreset` refuses an eleventh preset and a name over 24 characters, and trims surrounding spaces; tests show both refusals.
5. `isModified(preset, mix, dim)` is true after any saved field changes and false after a master-volume change; tests show both.
6. Editing a built-in returns a "Save as new" result and never mutates `BUILT_INS`, shown by a test that freezes the array.
7. `restoreLaunch(stored)` returns Sleep on first launch and the stored mix later, with master volume and sleep timer at defaults; tests cover both.
8. `src/presets.ts` is in `coverage.include` and the 75% gate passes.

## Verify
```sh
npm test
npm run check
```

## Comments
- `parsePreset` takes one preset object that carries `version: 1` (`serializePreset` adds it). `parsePresetList` reads the stored `{ version, presets }` and forces `builtIn` false, so storage cannot forge a read-only preset. Both return null for a missing or higher version.
- The spec `Mix` has no field for "heartbeat at phase changes only". Sleep and Reset save the heartbeat voice at level 0.3; the phase-change-only mode is for the metronome ticket to decide. Focus saves level 0.
- Built-in levels are first guesses, to be tuned by ear. Sleep tempo is slider 0 (about 28 s a cycle).
- `restoreLaunch` returns Sleep's mix, `dim: true`, `presetId: "sleep"` on first launch.
