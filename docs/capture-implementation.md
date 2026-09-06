# Live chord and mode capture

Implemented 2026-09-05, following accepted [design review 03](prototypes/capture-revision/design-review.md) and the [capture requirements](requirements.md#creating-chords-and-modes). This is the capture implementation slice. The original rendered prototypes are preserved.

## What is playable

Use **Make chord** / **Make mode**, or hold **N** / **M**. Capture starts sound if needed and opens an empty draft above the continuing performance. Mouse and MIDI note-ons select exact pitches; a second selection toggles that pitch off. MIDI key-up retains the selection. Collection bypasses chord generation, scale filtering, and Smooth Clavier. Auto Button starts **off for every new capture**, independently of its normal-playing setting. Click or drag with the button held to select pitches. You can explicitly enable Auto Button during capture to select pitches on cell/key entry. Switching chord/mode or returning from naming to Edit pitches preserves that capture-local choice; finishing or canceling restores the normal-playing setting. This default was corrected at Ethan’s request after the initial capture implementation.

The first selected pitch remains the reference after removal, clearing, refilling, and switching chord/mode. Grid outlines and clavier bars mark selections; mint fills mark sound. The capture list distinguishes auditioning, shared audition/performance, performance-only, and selected-but-silent pitches. It scrolls independently of the reference, optional-limit control, and collection actions.

Capture audition has its own note ownership. Selecting an already-sounding pitch retriggers it without deleting the earlier performance's ownership. Auditions sustain with **Limit capture audition notes unchecked by default**. Enabling it applies the document's Hold Number separately to capture audition; only the oldest auditions stop. Selected pitches and prior performance ownership remain intact. The existing Hold Number default is 32; this slice displays that value but adds no separate number editor. An explicitly enabled limit remains enabled for subsequent captures in the same instrument; Reset document returns it to off.

With the metronome on, capture selections, their attacks, and their selection/sound indicators commit on the next tick. Switching capture type also uses that boundary. Leaving collection for naming or cancellation releases audition ownership immediately, including between ticks. An overlapping performance owner keeps its note sounding. With the metronome off, selections commit immediately through the audio engine.

Release the active capture key, or use **Name & choose slot**. Naming stops audition, preserves the draft, and identifies the slot to replace. Slot 1 remains protected. Press **2–0**, then **Tab** to enter the name; **Enter** in the name field or **Replace** commits. Chords store exact relative intervals, including negative offsets and octave spacing; modes fold octave-equivalent offsets into pitch classes. The created pattern replaces and selects the chosen slot. The performance's scale root remains unchanged; capture's reference defines the stored relative pattern. Names render as text and have no newly imposed character limit.

Escape or Cancel discards the draft without changing either pattern table or its current selection. Empty completion shows **No pitches selected** in the header for five seconds. Very short N/M taps preserve this feedback even if entry and exit fall inside one display frame. Reset document clears capture, performance notes, and live controls and restores the original fixture slots.

## Provisional transition choices

These were proposed during implementation and have not received separate user confirmation. They are explicit implementation choices, not additions to the accepted requirements:

- Turning the audition limit off, increasing its allowance, or removing an audition does not automatically revive earlier evicted notes. Toggle a pitch off and back on to audition it again.
- **Edit pitches** resumes auditioning the preserved draft, subject to the current limit and tick timing. When the limit is enabled, resume traverses the draft in ascending pitch order; the highest pitches remain auditioning if the draft exceeds the allowance.
- The most recently pressed N/M key controls completion. The confirmed N-down → M-down → N-up → M-up handoff works. In reversed release order, releasing the newer key finishes even if the older key remains held.

These policies can become document configuration variants in a later behavior-settings design. The accepted configurable audition limit is already represented in the engine's settings.

## Verification

- **68 tests pass** across ten test files. The new capture witnesses cover raw MIDI, fixed references, kind switches, all 128 selected pitches without default eviction, optional eviction, shared Sustain/Drone reattacks and releases, next-tick selection, immediate exit, edit resumption, and panic/document reset.
- The real worklet has a 256-voice bank so a full 128-pitch capture can coexist with a full second-channel performance. A worklet test verifies all 256 committed notes with zero voice steals, then capture-only release preserving the other 128 notes. The existing duplicate-audio-quantum regression remains passing. This remains a bounded synthesizer, not a promise of unlimited hardware polyphony.
- `npm run build` passes TypeScript checking and writes the production bundle to `docs/build/`.
- [Browser checks](capture-runs/browser-check.json) exercise the production bundle in isolated Chrome with real browser keyboard and pointer input, the AudioWorklet, and OffscreenCanvas rendering. They cover actual pattern replacement, slot protection and Tab navigation, name retention through editing, raw clavier capture with Smooth enabled, Auto Button, a 40-pitch draft, optional-limit behavior, list scrolling, cancellation, quick empty taps, timed notice removal, and layout at 1280 × 800 and 1600 × 1000. The run also exercises continuous capture dragging and subsequent ordinary playing; exact counts, durations, audio health, and draw metrics are recorded in the report.
- [Browser trace](capture-runs/browser-trace.json) records actual engine actions and draw events. Browser audio is muted during automation: nonzero finite worklet samples are verified, but physical output, subjective sound/feel, hardware MIDI, and end-to-end physical latency remain unverified.
- The [capture render](capture-runs/02-chord.png), [naming render](capture-runs/04-naming.png), and [long-list render](capture-runs/07-limited-scroll.png) were visually inspected. The selection/sound distinction, spacing, list scroll area, and visible actions follow the accepted design.

Reproduce against the production server:

```sh
npm test
npm run build
python3 -m http.server 5174 --bind 127.0.0.1 --directory docs/build
# In another terminal:
node docs/capture-runs/browser-check.mjs
```

The verification script creates an isolated temporary Chrome profile under `docs/capture-runs/` and removes it afterward. It does not access the user's browser profile or MIDI devices.

## Auto Button default correction

Ethan requested that Auto Button default to off during pitch selection. Each new capture now starts off, with an independent capture-local toggle; ordinary playing retains its earlier setting. The production build passes. [Fifteen focused browser checks](capture-runs/auto-default/browser-check.json) pass, covering N/M and button entry, hover versus click, explicit enabling, chord/mode handoff, Edit pitches, fresh-capture reset, and restoration after cancel, save, and empty completion. [Updated capture screenshot](capture-runs/auto-default/capture-auto-off.png). Reproduce with `node docs/capture-runs/auto-default/browser-check.mjs` against the production server.

## Hands-on check

1. Start playing, latch Drone or Sustain, then hold N. Confirm the earlier notes continue and the draft starts empty. Select an earlier pitch and listen for a fresh attack.
2. Add and remove pitches, including the first one. Confirm its reference remains fixed. Test Auto Button both on and off and check that selected marks agree across grid and clavier.
3. Hold N, press M, release N, then release M. Confirm collection continues until M release, audition stops at naming, and the earlier performance remains.
4. Choose a slot with 2–0, Tab to name, and replace. Play the new pattern. Repeat with Escape to verify that cancellation preserves the prior selection.
5. Try the optional audition limit with more than 32 selections, and capture with the metronome on. Confirm selected-but-silent notes remain visibly selected and leaving collection stops audition immediately.

## Remaining scope

The subsequent [document slice](document-implementation.md) now provides Open/Save/Save As/Revert and guarded New, so captured slots can persist in instrument files. The old Reset document button is replaced by New instrument in File. Slot editing/copy-paste, additional behavior configuration, and the wider original-instrument feature set remain later implementation slices. This does not establish full Harmony Grid parity or browser latency acceptance. No commit, push, or publication was performed.
