# Grid & register implementation

Implemented 2026-09-06 on `feat/playable-foundation`. Ethan accepted the [rendered design](prototypes/grid-settings/design-review.md) and confirmed the four proposed defaults before implementation. No Superpowers, commits, pushes, or publication were used. Source is under `src/grid-settings/`; artifacts remain under `docs/`.

## Using the controls

Click **Grid & register…** beside the grid heading. Set horizontal and vertical intervals independently from 1 to 12 semitones, or use 4×3, 5×7, and 1×12 shortcuts. Choose the grid's lower-left C, clavier's lowest C, and highest playable MIDI pitch. Register labels include both note names and MIDI numbers.

The preview follows the draft without moving the playing surface. Apply commits the settings and closes the panel; Cancel or Escape discards them. Invalid entries keep the last valid preview visible and disable Apply. The actions remain visible at both accepted viewport sizes; fields can scroll when necessary. The preview uses C major to illustrate pitch layout, rather than displaying live playing or creating sound.

Grid lower C choices are MIDI 0–108 in octaves; clavier lower C choices are MIDI 0–72, retaining a three-octave span plus the upper C. These are the reviewed modern UI ranges, expressed as exact MIDI values rather than an inferred conversion of historical octave numbering. The maximum must be 0–127 and at least as high as both lowest surface notes. The initial layout remains grid MIDI 24, clavier MIDI 48–84, maximum 127, axes 4×3.

## Confirmed musical behavior

- Applying a layout updates hit testing and displayed mapping together. It does not synthesize a newly mapped pitch at a stationary pointer. A fresh movement/press uses the new mapping. A physically held pointer must be released before it can start a new gesture after Apply.
- Raising the ceiling does not introduce previously excluded chord members under an unchanged pointer; its next gesture makes the new range available.
- Lowering the ceiling preserves pitches already retained by Sustain, Hold, or Drone. Other current mouse chord members above the ceiling leave through the normal playing/tick path. Existing retention ownership continues to govern release.
- New mouse/clavier chord members above the ceiling are suppressed, rather than being folded or transposed into range. Unavailable cells and keys are visibly dimmed separately from mode filtering. Retained or MIDI-sounding pitches remain visibly sounding even where pointer playing is unavailable.
- Entering an unavailable area cannot attack its pitch; an ordinary active mouse source receives a release, respecting the existing tick and retention rules.
- Capture follows the configured axes and register instead of switching to the old hard-coded grid base. Its narrower display still accommodates the capture panel. Pointer capture respects the ceiling. Auto Button still starts off, and audition eviction still defaults off.
- Incoming MIDI, MIDI-generated chords, and Thru remain independent of this pointer ceiling. MIDI can therefore collect/audition an exact pitch above it. Such a pitch can still be removed through the capture selection list.
- Grid settings cannot be edited during capture. The modal pauses new playing input; existing held-control releases remain effective. A modal keyboard guard prevents performance shortcuts leaking through after viewport changes move focus out of a field.

Geometry Apply is a layout transaction, not a musical tick or an attack. The existing sound and chord snapshots still follow the audio engine. New input after Apply retains metronome quantization. No MIDI channel-routing policy was changed by this slice.

## Files and compatibility

All 144 axis pairs now validate and save. Version 1 files support optional `surface.gridLow` and `surface.clavierLow` values, and `settings.maxPitch`. New saves include the registers and ceiling. Older files without them load as MIDI 24 / 48 / 127. Unknown fields are still rejected; only these specific additions are accepted. Explicit default registers do not create artificial dirty changes when opening an older file.

Open, Save, Save As, Revert, and New include the new settings. The unsaved-change summary identifies axis, register, and ceiling changes. New restores the established defaults. Worker rendering, fallback rendering, normal clavier hit testing, and Smooth Clavier all receive the configured register and range.

## Verification

- `npm test`: **128 tests pass across 14 files**. New cases exercise all 144 axes and cell hit pitches, file migration and dirty tracking, numeric constraints, register mapping, clipping, preserved retention owners, MIDI independence, capture removal above the ceiling, deferred expansion until a gesture, and tick commitment.
- `npm run build`: passes TypeScript checking and creates `docs/build/`.
- [Worker browser checks](grid-settings-runs/browser-check.json): **21 pass**.
- [Fallback browser checks](grid-settings-runs/fallback/browser-check.json): **21 pass**, with OffscreenCanvas transfer disabled at the browser boundary to exercise main-thread Canvas rendering.
- [Capture regression](capture-runs/browser-check.json): **37 pass**, including 15 seconds of continuous capture dragging and 30 seconds of normal dragging, finite nonzero audio, and no reported queue overflow. Its target coordinates were updated to the now-shared configured register; expected musical pitches remain unchanged.
- [Document regression](document-runs/browser-check.json): **29 pass**.
- [Slot regression](slot-runs/browser-check.json): **30 pass**.

Browser checks use isolated Chrome profiles and actual UI/worklet/rendering paths. Save/reload/Open/Revert uses real browser origin-private file streams with the picker boundary substituted, as in the earlier document harness. The checks establish software behavior, not physical MIDI latency or native chooser prompts. The final capture-list exception for removing MIDI pitches above the ceiling is covered by the unit test; the browser runs precede that narrowly scoped engine correction.

Production states were rendered and visually inspected: [default](grid-settings-runs/01-default.png), [draft](grid-settings-runs/02-draft.png), [invalid](grid-settings-runs/03-invalid.png), [ceiling](grid-settings-runs/04-ceiling.png), and [wide](grid-settings-runs/05-wide.png). [The browser harness](grid-settings-runs/browser-check.mjs) is reproducible with the production server running on port 5174:

```sh
node docs/grid-settings-runs/browser-check.mjs
node docs/grid-settings-runs/browser-check.mjs http://127.0.0.1:5174/ --fallback
```

## Hands-on check

1. Open Grid & register, try 5×7 and 1×12, then Cancel once and Apply once. Play the new layouts.
2. Change the clavier's lowest C and test normal and Smooth Clavier. Start capture and confirm its pitches follow the same settings, with Auto Button off.
3. Retain notes with Drone, lower the ceiling, and Apply. The retained notes should continue; new pointer playing should stay within the ceiling.
4. Save, reopen, and Revert an instrument with non-default axes and registers.

This completes the bounded grid/register slice. Performance-value controls, routing-channel semantics, SoundFonts, musical variations, help/examples, and physical real-time acceptance remain in the [feature-gap audit](feature-gap-audit.md).
