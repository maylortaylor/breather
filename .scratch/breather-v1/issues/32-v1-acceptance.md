Type: build
Status: claimed
Blocked by: 28, 29, 30, 31
Model: sonnet

# Run the v1 acceptance pass against the spec's definition of done

Prove every v1 criterion in the spec on the built app, fix small gaps, and hand the result to ticket 11.

## Context
- Spec "v1 definition of done", criteria 1 to 14, built by tickets 14 to 31.
- Ticket 11 (grilling, open) owns the first push, the full-history gitleaks run and the platform Caddy ticket; this ticket does none of them.
- `docs/WORKING-AGREEMENT.md` rule 8: the gate is tests, gitleaks and `/code-review`.
- A gap larger than a small fix becomes a new build ticket, not a change here.

## Acceptance criteria
1. Every criterion in the spec's definition of done is checked on `npm run preview`, and the result for each is recorded as a numbered comment on this ticket.
2. The full gate passes: `npm run check`, `npm test` with the 75% coverage gate, `npm run build`, `npm run check:build` and the licence check.
3. A 10-minute foreground run at 60 BPM with the metronome at D2 shows no drift against a stopwatch.
4. `gitleaks git . --config .gitleaks.toml` reports no leaks over full history.
5. No Lab code, dev-only timer or `console` call outside the error boundary ships in `dist/`.
6. Every gap found is either fixed here, in under an hour, or filed as a numbered build ticket.
7. A comment on ticket 11 lists what is ready and what it still owns.

## Verify
```sh
npm run check
npm test
npm run build
npm run check:build
node scripts/check-licenses.mjs
npm run preview
```
- Matt checks: listen and look on a desktop browser and an iPhone for one full session with a 30-minute timer, and approve or list fixes.

## Comments
Automated pass on branch `build/32-acceptance`, 2026-10-26. Verdicts: PROVEN BY TEST (T), CODE READING ONLY (C), NEEDS BROWSER OR DEVICE (B).

Gate: `npm run check`, 579 tests, build, `check:build`, licence check (10 prod, 597 dev, 0 problems), pre-push hook and `gitleaks git .` (162 commits) all pass. Coverage 95.5% statements, 91.5% branches; every file in `coverage.include` is above 75% (lowest: `session.ts` 76.8% statements, 79.2% lines). Bundle: index 293.4 kB (94.5 gzip), aurora 526.1 kB (131.5 gzip), css 15.7 kB; precache 14 entries, 891.7 KiB.

1. Criterion 1, welcome then Begin, safety line every launch. T (`Gate.test.tsx`: "Got it sets welcomeSeen...", "shows the safety line on every launch"). Look of the card: B.
2. Criterion 2, Begin starts Sleep or last mix at master 0.7, no burst. T for the mix and master (`Gate.test.tsx` "starts the Sleep mix", "starts the mix saved by the Sounds tab"; `session.test.ts` "resumes the context in the tap, sets master..."). The 3 s `BEGIN_FADE_SEC` is asserted by code only (C). Absence of a click: B.
3. Criterion 3, 4-7-8 in beats, cycle 28.5 s to 14.25 s, center 60 BPM. T (`phases.test.ts` "holds for 7 beats...", `tempo.test.ts` "maps each half separately...", "gives a cycle of about 28.5 s..."). Slider snap: T (`BreathTab.test.tsx` "snaps to exactly 0.5...").
4. Criterion 4, tap pauses the guide, ambient keeps playing. T for the guide (`Ring.test.tsx` "taps to pause...", `beats.test.ts` "stops new beats on pause..."). Ambient continuing: C (pause touches only the phase machine and phase-tone layers).
5. Criterion 5, detents and 10 minute steadiness. Detents T (`tempo.test.ts` metronomeGains, `BreathTab.test.tsx` "snaps to off, phase changes and all beats..."). Steadiness: T added here (`scheduler.test.ts` "keeps every beat on its whole second for 10 minutes of jittery 25 ms ticks": 601 beats at exact seconds); beats are absolute positions on the audio clock, so none can drift. The stopwatch run on a real browser: B (ticket 32 AC3).
6. Criterion 6, seconds mode 4, 7, 8 s, 1 s ticks, tempo slider disabled with tooltip. T (`beats.test.ts` "runs inhale, hold and exhale for 4, 7 and 8 s...", "ticks once a second..."; `BreathTab.test.tsx` "disables the tempo slider and says why...").
7. Criterion 7, add and remove 9 loops, volume slider, 3 LFO colours. T (`SoundsTab.test.tsx` "groups the 9 loops...", "adds a row and starts the sound...", "names each LFO button...").
8. Criterion 8, presets apply with 3 s crossfade, built-ins read-only. T (`SessionTab.test.tsx` "applies the mix over 3 s...", "offers Save as new after an edit, and the built-in itself never changes"). How the crossfade sounds: B.
9. Criterion 9, 30, 60, 90 timer, fade, stop audio and animation. T for the schedule and end (`sleep.test.ts`, `SleepTimer.test.tsx` "at the end: master silent, sounds stopped..."). Two defects found and fixed here (see below). The full fade by ear and a 90 minute locked run: B.
10. Criterion 10, aurora breathes, dims, slows, pauses hidden. T (`background/logic.test.ts` breathLevel, "halves the brightness in dim mode", "slows and flattens under reduced motion"; `loop.test.ts` "renders no frames while the tab is hidden..."). How it looks, phone heat: B.
11. Criterion 11, sheet dissolves after 5 s idle, returns on input. T (`sheetLogic.test.ts`, `Sheet.test.tsx` "dissolves after 5 s idle...", "any pointer move brings it back...").
12. Criterion 12, installs from `/breather/`, offline, CSP. CSP, manifest, precache, canonical and no outside host: T (`buildRules.test.ts`) and re-checked on `dist/` here. The built CSP is `default-src 'self'; media-src 'self' blob:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. Install and offline reload: B (Matt ran offline on 28; the install prompt and the iPhone Home Screen install are not yet run).
13. Criterion 13, AA in both themes, axe on every screen. T (`theme.test.ts`, `a11y.test.tsx`: axe on welcome, Begin, resting, three tabs and About, normal and dim). VoiceOver reading order: B.

### AC5 on `dist/` (ticket 32 criterion 5)
- No "Listening Lab", `lab.html` or `breather.lab` string; `dist/` holds 15 files, no Lab page.
- No `breather-dev-timer` marker and no `?devtimer` flag; `DEV_TIMER` folded away.
- No `.map` file and no `sourceMappingURL`.
- Only app `console` call in `src`: `console.error` in the error boundary, `src/App.tsx:24`. The built bundles also carry library-internal console calls (React, three.js, styleq); none are the app's.
- `index.html`: CSP meta present, canonical `https://roboborealis.com/breather/`. No third-party host is loaded: the only URLs in `dist/` code are XML namespaces, library comments and error-message strings (`react.dev/errors/`, `bit.ly/wb-precache`, `jcgt.org`), none fetched. `notices.txt` holds licence-text links.

### Defects fixed (commit `fix(session): restore aurora on Begin and pause keep-alive at sleep end`)
- After a sleep timer ended, `rested` was never cleared, so the aurora stayed off (CSS gradient only) after the next Begin until a reload. Gate now clears it. Test: `Gate.test.tsx`.
- The finished timer left the silent iPhone keep-alive loop playing (lock-screen card, battery). `KeepAlive.pause()` and `AudioSession.pauseKeepAlive()` added; `finish()` calls it; the next Begin plays it again. Tests: `keepAlive.test.ts`, `session.test.ts`, `SleepTimer.test.tsx`.

### Scenarios (code reading unless noted)
- First visit: welcome, Got it, Begin, Sleep mix. OK (T).
- Reload mid-session: returns to Begin, mix, dim, seconds mode and preset restored, master 0.7, timer and pause not stored by design. OK (T `store.test.ts`).
- Storage cleared: defaults, first-launch Sleep. OK (T).
- Storage holding garbage or throwing: defaults, nothing shown. OK (T `store.test.ts`, `presetStore.test.ts`).
- AudioContext missing: "Sound is not available" line, ring on `performance.now()`, timer buttons disabled. OK (T `Gate.test.tsx`; ring clock C).
- WebGL missing or lost: canvas, then CSS gradient. OK (T `pickRenderer`; `onLost` wiring C; a real context loss B).
- Begin tapped twice: the button unmounts on the first tap; `beginAudio` reuses the session anyway. OK (C, T for reuse).
- Preset switch while the timer runs: the switch never touches master or the timer. OK (T "never changes master volume on a switch").
- Sleep timer ending with the sheet open: `finish()` closes the sheet and returns to Begin. OK (T).
- Dim on first paint: the store reads storage before the first render and `Shell` and `Background` take `dim` from it; body is dark before JS. No flash by code (C); eyes: B.
- "Tap to resume": shown on `needs-tap`; taps, `touchend` and a return to the tab retry. OK (T `session.test.ts`); on a real iPhone: B.
- Tab hidden 10 minutes: aurora stops (T), the ring is right on return, the sleep fade runs on the audio clock (T). The metronome clicks are mostly lost while hidden: the 1 s throttled tick and 0.1 s lookahead hand out about one beat in ten. Not a spec criterion; filed as ticket 33.
- Tempo changed during pause: the machine folds position in and holds it, scheduler resets. OK (T `phases.test.ts` "applies while paused without moving"; subscription C).
- Focus lost on screen swaps (from ticket 31): filed as ticket 34.

### Tickets filed
- 33 hidden-tab metronome; 34 focus on screen swap.

### Matt checks by eye and ear
1. Begin: no click or burst; the Sleep mix rises over about 3 s.
2. Run 10 minutes at 60 BPM, metronome at D2, against a stopwatch (AC3).
3. 30 minute timer, or `?devtimer=1` in dev: the fade, the corner moon, return to Begin, then Begin again brings the aurora back.
4. Dim mode on reload: no bright flash.
5. Preset crossfade and the aurora on a phone.
6. Install from `/breather/` and reload offline.
7. iPhone checklist in ticket 29 (10 steps), then VoiceOver (criterion 14 is Matt's).
