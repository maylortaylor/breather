Type: research
Status: open
Blocked by: none

# What third-party code and audio can enter an MIT repo?

Set the rules for borrowed shader or noise code and for audio samples, and fill `THIRD_PARTY.md`.

## Context
- Shadertoy snippets default to CC BY-NC-SA, which is incompatible with MIT.
- Samples, if any, must be CC0.
- The aurora shader and the pink-noise filter are the likeliest places for borrowed code.

## How to resolve
Type `/research`. Produces a findings file on a `research/license-provenance` branch, with the rules copied into `THIRD_PARTY.md` and `AGENTS.md`.
