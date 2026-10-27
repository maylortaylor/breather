# Breather

A calm, installable web app for winding down. Layered synthesized sound, an optional soft metronome, a guided 4-7-8 breath and a slow aurora background that breathes with you.

Every sound is generated live with the Web Audio API, so the app ships no audio files. Music, effects, metronome and breathing text can each be turned fully off. It works offline and installs to the home screen like an app.

**Status:** pre-v1, local only. No remote, no releases yet. The planned address is `https://roboborealis.com/breather/`.

## Run it

Node 24 is required (`.nvmrc`).

```sh
npm ci
npm run dev
```

The dev server opens at `http://localhost:5173/breather/`. Add `-- --port 5188 --strictPort` to pick a port.

## Test

```sh
npm test              # unit and component tests
npm run check         # format, lint and types
node scripts/check-licenses.mjs   # dependency licences against the allow list
```

Pure logic (scheduler, tempo mapping, phase machine, presets) is tested first and gated at 75% coverage: `npm test -- --coverage`.

To run everything a push runs, enable the hooks once with `git config core.hooksPath .githooks`. Pre-commit scans for secrets with [gitleaks](https://github.com/gitleaks/gitleaks); pre-push runs the check, the licence check and the tests.

## Build and deploy

```sh
npm run build         # writes dist/
npm run check:build   # fails on a missing asset, an uncached asset, a bad CSP or missing notices
npm run preview       # serves dist/ at /breather/
```

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main` that changes more than docs. The workflow stays inert until the repository has a remote. The app is served under `/breather/` and is proxied from roboborealis.com; see [ADR-0002](docs/adr/0002-hosting-and-owner.md).

## iPhone limits

What works: sound plays with the ringer switch on silent, the sleep timer fades on the audio clock, and one tap resumes sound after a call, Siri or an app switch.

What is not promised: playback with the screen locked for a full 30 to 90 minute session, lock-screen controls, a metronome while the app is in the background, vibration (iOS does not support it), and saved presets after 7 idle days outside the installed app. Keep the screen on while the timer runs. Details and the device test plan are in [docs/research/ios-audio.md](docs/research/ios-audio.md).

## Privacy

Breather saves your mix on this device. No cookies, no tracking, no accounts, no analytics and no network requests beyond its own files. A Content Security Policy and a build check enforce that.

## Security

Report a vulnerability privately through GitHub. See [SECURITY.md](SECURITY.md).

## Licence

MIT. See [LICENSE](LICENSE). The font is Nunito under the SIL Open Font License. Third-party components are listed in [THIRD_PARTY.md](THIRD_PARTY.md), and the built app links the full licence text as `notices.txt`.

## More

- [docs/PLAN.md](docs/PLAN.md): what is being built.
- [docs/WORKING-AGREEMENT.md](docs/WORKING-AGREEMENT.md): how work is done here.
- [docs/adr/](docs/adr/): the decisions and why.
- [CONTEXT.md](CONTEXT.md): vocabulary.
