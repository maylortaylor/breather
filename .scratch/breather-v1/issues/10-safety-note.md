Type: grilling
Status: resolved
Blocked by: none

# What safety note does the breath guide show, and where?

Decide the wording and placement of an on-screen "stop if lightheaded, this is not medical advice" note.

## Context
- The 7-beat hold can cause dizziness.
- The note must be visible without cluttering the calm layout from ticket 05.
- Text only in v1, so the note is plain copy, not a modal.

## How to resolve
Type `/grill-me`. Produces the final copy and placement recorded under `## Answer`.

## Answer
Decided with Matt on 2026-10-26.
- **Safety line, final copy:** "Stop if you feel lightheaded. Not for use while driving or in water. Not medical advice."
- **Placement:** on the Begin screen under the button, shown every session with no "don't show again". Plain text that passes AA contrast, read by screen readers before the Begin button.
- **Pause:** tapping the breath ring pauses the guide. The countdown freezes, the phase tones fade, background sounds keep playing, and a second tap resumes.
- **Welcome card, first launch only:** one card, no tour. Title "Breather". Line: "Slow sound and a guided 4-7-8 breath to wind down." Steps: 1. "Tap Begin to start the sound." 2. "Follow the ring: breathe in for 4, hold for 7, out for 8." 3. "Tap the Settings button for sounds, tempo and presets." Then the safety line and one "Got it" button that leads to the normal Begin screen.
- **Storage line:** the card also carries the storage notice from ticket 04 ("Your mix stays on this device. No cookies, no tracking."), so first run has one screen, not two. Returning visitors see only Begin and the safety line. A "How it works" link in the Session tab reopens the card.
- **No Tips panel in v1.** The tips bullet in `docs/PLAN.md` is marked deferred.

### Amended 2026-10-26
Welcome card step 3 now reads "Tap the Settings button for sounds, tempo and presets." because ticket 20 added a visible Settings button at the bottom of the screen. Matt approved the new wording.
