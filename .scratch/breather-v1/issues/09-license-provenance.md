Type: research
Status: resolved
Blocked by: none

# What third-party code and audio can enter an MIT repo?

Set the rules for borrowed shader or noise code and for audio samples, and fill `THIRD_PARTY.md`.

## Context
- Shadertoy snippets default to CC BY-NC-SA, which is incompatible with MIT.
- Samples, if any, must be CC0.
- The aurora shader and the pink-noise filter are the likeliest places for borrowed code.

## How to resolve
Type `/research`. Produces a findings file on a `research/license-provenance` branch, with the rules copied into `THIRD_PARTY.md` and `AGENTS.md`.

## Answer
Findings are in [docs/research/license-provenance.md](../../../docs/research/license-provenance.md), researched 2026-10-26, and the rules are in `AGENTS.md` and `THIRD_PARTY.md`. This is not legal advice.
- Write the aurora shader and noise code from scratch. Never port Shadertoy code (default licence CC BY-NC-SA).
- Do not use Kellett's pink-noise snippet (no stated licence). Matt approved swapping to Voss-McCartney on branch `fix/pink-voss`.
- Borrowed code needs an MIT, CC0 or Unlicense header and a `THIRD_PARTY.md` entry.
- No audio files in v1. Later samples must be CC0, approved by ear, logged with source, licence URL, date and SHA-256.
- Ship Nunito with its OFL.txt. Allow MIT, ISC, BSD, Apache-2.0, 0BSD, CC0 and Unlicense dependencies. Deny GPL, AGPL, CC-BY-NC and unlicensed ones.
- Open for a lawyer: whether a filter re-derived from published coefficients is a derivative work, and whether minified bundles need the full MIT text inline.
