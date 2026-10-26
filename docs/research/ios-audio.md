# iOS audio: what breather can promise

Researched 2026-10-26 for ticket 07. Sources are primary where possible; developer reports are marked. iOS 18 and iOS 26 are the target era. Nothing here was run on a device: section 7 is the test plan that turns each claim into a fact.

## 1. Silent (ringer) switch

- Safari's default audio session type is `auto`, which WebKit treats like `ambient` for Web Audio (a WebKit engineer's comment, relayed by [nattog.dev, 2025-11-22](https://nattog.dev/blog/web-audio-ios-unmute)). Ambient audio obeys the ringer switch, so a bare `AudioContext` goes mute on silent. The [W3C Audio Session draft (2024-11-13)](https://w3c.github.io/audio-session/) defines `auto` as ambient when no media is active; it does not mention the switch itself.
- Fix: `navigator.audioSession.type = "playback"` before the first sound, feature-detected with `"audioSession" in navigator`. Shipped in Safari 16.4, March 2023 ([sadiss #134](https://github.com/fischnall3r/sadiss/issues/134), developer report). Safari-only and an Editor's Draft as of Nov 2025 (nattog.dev). [MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type) marks it experimental.
- Older workaround: loop a silent `<audio playsinline>` on the Begin tap. Media elements use the playback channel and Web Audio follows. Reported as the pre-16.4 method (nattog.dev). For background playback, some users said it did not help ([WebKit 261554, comments 16-18, March 2024](https://bugs.webkit.org/show_bug.cgi?id=261554)).
- Verdict: set `audioSession.type = "playback"` and also loop a silent element as a fallback. No Apple document states the switch behavior outright, so confirm on device.

## 2. Screen lock and background playback

- WebKit policy: inactive pages get timers throttled, and on iOS tabs are suspended when possible ([WebKit blog, 2019-08-27](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/)). That post does not say audio exempts a page.
- A suspended Web Audio graph was a real bug: [WebKit 261554](https://bugs.webkit.org/show_bug.cgi?id=261554), "AudioContext suspended in background despite audioSession.type playback". Reports: broken in iOS 17.0, fixed in 17.1, back in 17.2 to 17.3.1. Fix landed in WebKit main 2024-03-01; a reporter confirmed iOS 17.5 on 2024-05-14. Status RESOLVED FIXED.
- Related: [WebKit 270352](https://bugs.webkit.org/show_bug.cgi?id=270352), resuming media-element audio through an AudioContext after a tab switch. Fixed in WebKit main 2024-05-16; no Safari release named.
- Installed PWA is worse. [Apple forum, Nov 2025](https://developer.apple.com/forums/thread/805900): on iOS 26.0.1, home-screen apps start with a `suspended` context, `resume()` in a click does not fix it, and a retry throws `InvalidStateError: Failed to start the audio device`. Same thread: sequential playback stops on a locked phone until the app returns to the foreground. A [MacRumors thread](https://forums.macrumors.com/threads/ios-26-audio-issues-in-pwa-web-apps-not-fixed-in-26-1-or-26-2-but-much-better.2466839/) is titled "not fixed in 26.1 or 26.2, but much better" (title from a search snippet; the page returned 403). I found nothing newer.
- Media Session is supported since iOS 15 ([firt.dev, updated 2026-10-13](https://firt.dev/notes/pwa-ios/)). Lock-screen controls on a PWA `<audio>` element can die after about 30 seconds paused, until the app is reopened ([Apple forum, Aug 2024](https://developer.apple.com/forums/thread/762582), one reporter, no answer).
- A 90 minute locked run: no source promises it. Treat it as unverified until the test plan passes. A bare Web Audio graph is the likeliest to be suspended; a playing silent `<audio>` element plus Media Session is the best known keep-alive.
- Screen Wake Lock can keep the screen on instead. It failed in home-screen apps from iOS 16.4 to 18.3 and was fixed in 18.4 ([WebKit 254545](https://bugs.webkit.org/show_bug.cgi?id=254545), [Safari 18.4 notes](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)). It releases when the page hides, so reacquire on `visibilitychange`.

## 3. Interrupted state, resume, autoplay

- WebKit adds a non-standard `interrupted` state beyond `suspended`, `running` and `closed`. It appears on calls, Siri, route changes and backgrounding. Code that resumes only `suspended` stays silent ([tc-mobile #106](https://github.com/unfoldingWord/tc-mobile/issues/106), developer report).
- Handle it: listen to `statechange`; on `visibilitychange` to visible and on any tap, call `resume()` if `state` is neither `running` nor `closed`; catch the rejection and show a "Tap to resume" control.
- Autoplay: create or resume the context inside a user gesture handler (the Begin tap). After a call some versions need a fresh gesture, so keep the tap path.

## 4. Timers and the lookahead scheduler

- Hidden pages get throttled timers; on iOS they may be fully suspended ([WebKit blog, 2019](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/)). A `setInterval` scheduler stalls when the page suspends, and only audio already queued plays.
- Keep all timing on `audioContext.currentTime`. Never count ticks or use `Date.now()` for beats. On wake, compute the beat from the clock and skip ahead instead of replaying a backlog.
- Foreground, a 25 ms timer with 100 ms lookahead is fine. A deeper lookahead (2 to 5 seconds) buys a short background tail; accept that the metronome may stop when the page suspends.
- Never drive the sleep timer with `setTimeout`. Schedule the fade with `gain.linearRampToValueAtTime` against the audio clock when the timer starts, so the fade happens even if JS is frozen. Store the end time as a clock value and recompute on resume.

## 5. Vibration

`navigator.vibrate` is unsupported on iOS Safari and installed PWAs ([firt.dev, 2026-10-13](https://firt.dev/notes/pwa-ios/)). MDN's table did not load, so firt.dev is the only source. No web alternative exists. Feature-detect and skip silently, as PLAN.md says.

## 6. PWA install and scope

- Service workers, Cache Storage and manifest `scope` work since iOS 11.3 ([firt.dev](https://firt.dev/notes/pwa-ios/)). There is no `beforeinstallprompt`; install is Share, then Add to Home Screen ([secondary guide](https://progressivewebapps.com/platforms/ios-safari/)).
- Per the same secondary guide, Safari 26 opens any home-screen site as a web app and does not require a manifest. Ship one anyway.
- For `/breather/` on GitHub Pages: set manifest `scope` and `start_url` to `/breather/`, serve the worker from `/breather/sw.js` so its default scope matches, and use relative asset URLs. Links that leave scope open in an in-app browser view (unverified on iOS 26).
- Script-writable storage is cleared after 7 days without use in Safari tabs; sources disagree on whether installed apps are exempt. Offer preset export and recommend installing.
- Installed-app storage is separate from Safari's, so presets saved in a tab do not appear in the installed app.

## 7. Test plan (real iPhone, Matt)

Run each in a Safari tab, then installed. Note iOS version and result.
1. Silent switch: set the ringer to silent, tap Begin. Pass if noise plays. Remove the `audioSession` line once to confirm it was the fix.
2. Lock: play 2 minutes, press the side button. Pass if sound continues 5 minutes, and the state reads running on unlock.
3. 90 minute run: set the timer to 90, lock, leave. Pass if audio fades near the end and is not silent early. Log when any early stop happens.
4. Interruption: play, call the phone (or ask Siri), hang up. Pass if one tap resumes; check that `statechange` logged `interrupted`.
5. App switch: play, open another app for 30 seconds, return. Pass if it resumes without a reload.
6. Metronome: play 10 minutes in foreground, then lock for 2 minutes and unlock. Pass if the beat does not burst through a backlog.
7. Lock-screen controls: pause from the lock screen, wait 60 seconds, press play. Record the response.
8. Cold start (the iOS 26 bug): force-quit the installed app, relaunch, tap Begin. Repeat three times. Pass if sound starts each time.
9. Vibration: show `"vibrate" in navigator` in a debug line. Expect false.
10. Install: Add to Home Screen from `/breather/`, launch in airplane mode, confirm standalone and offline.

## v1 promise

Breather v1 promises on iPhone that sound plays with the ringer switch on silent (`audioSession.type = "playback"` plus a silent looping `<audio>` fallback), that the sleep timer fades on the audio clock rather than a JS timer, and that a tap resumes sound after a call, Siri or an app switch. It does not promise playback with the screen locked for a full 30 to 90 minute session, lock-screen controls, a running metronome while backgrounded, vibration, or presets surviving 7 idle days outside the installed app; these are best effort pending the test plan, with Media Session metadata set where it helps and a note at the timer to keep the screen on.
