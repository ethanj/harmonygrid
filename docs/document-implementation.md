# Instrument files

Implemented 2026-09-05 in the existing `feat/playable-foundation` checkout. This follows the accepted [document designs](prototypes/authoring/design-review.md#documents), [unsaved-list spacing](prototypes/authoring/design-review.md#changes-list-revision--2026-09-05), and [requirements](requirements.md#documents-focus-and-background-operation). No Superpowers workflow, commits, pushes, or publication were used.

## Using files

Open **File…** in the instrument header. It provides New instrument, Open, Save, Save As, and Revert to saved. The old unguarded Reset document button is replaced by New instrument with unsaved-change handling. Command/Ctrl+S saves an existing destination; Shift+Command/Ctrl+S opens Save As; Command/Ctrl+O opens the file panel's Open operation.

The first save asks for an instrument name and location. Save updates the current file; Save As chooses a separate file and leaves the earlier file intact. An explicitly selected existing destination can be overwritten through the native chooser. Save As refuses the current file itself so the distinction remains clear. The name and saved baseline change only after the write stream closes successfully.

Open reads and validates the entire incoming file before replacing anything. If the current instrument has changes, Cancel keeps it open, Discard & open replaces it, and Save & open writes the outgoing version before replacement. A failed/canceled save never proceeds to replacement. If the instrument changes during saving, remaining changes stay dirty and Save & open asks for a new decision. Saving over the very file pending Open is rejected; cancel and save first, or explicitly discard and open, to avoid reopening a stale copy of newly written data.

Revert restores the last successfully saved or opened snapshot, after confirmation. It does not reread an externally modified file. Open, confirmed New, and confirmed Revert immediately release the previous performance and reset live Sustain, Hold, Drone, and Repeat, including between ticks. Merely opening the panel, canceling it, failing a save, or rejecting a file preserves the current performance. The changes list keeps the accepted 36px left inset and scrolls independently of the confirmation actions.

File actions are disabled during capture: finish or cancel the pitch draft first. Existing notes and Repeat can continue while a file dialog is open; new mouse/MIDI-generated performance attacks and performance key-downs are paused while the dialog owns focus. Releases of already-held controls still reach the engine. Replacing an instrument clears pointer ownership and requires release before a physically held pointer can trigger the new instrument. MIDI port selections remain session choices; loaded instruments do not reconnect devices automatically.

Normal-playing Auto Button, Smooth Clavier, clavier visibility, axes, MIDI Thru, and the implemented playing settings are saved. Capture Auto Button is transient and still starts off for each new capture. The optional capture audition limit is a saved behavior setting. Base tempo is saved; temporary held tempo modifiers and live retention latches are not. Browser reload/close gets an unsaved-change guard, subject to the browser's standard dialog policy.

## File format and implementation choices

New files use readable JSON with the suggested extension `.hgrid.json`, `format: "harmony-grid"`, and `version: 1`. They contain:

- Instrument name, ten named chord slots, and ten named mode slots.
- Selected relative chord/mode patterns, scale root, base tempo, metronome state, Hold Number, velocity, channels, Play Chords, Mouse Solo, Sets Root, and the capture audition limit.
- Internal Organ/Pluck sound choice and the playing-surface settings listed above.

They exclude active voices, Sustain/Hold/Drone/Repeat latch states, captured drafts, MIDI device identities, and browser file handles. This format is for the current reimplementation; it does not import legacy Harmony Grid binary files or claim complete original-preset reconstruction. [An actual first-save example](document-runs/saved-instrument.hgrid.json) is included.

Validation rejects unsupported versions, unknown/missing fields, invalid types, out-of-range values, empty/duplicate patterns, changed protected Solo/Chromatic slots, and files larger than 1 MiB. Names have no separate character cap; the overall file bound applies. Chord offsets use -127 through 127, mode intervals use 0 through 11, and each chord can contain up to 128 distinct offsets. Hold Number supports 0 through 128 in this schema. Files support the three currently implemented grid-axis choices and Organ/Pluck sounds. Additional future features will need deliberate schema evolution.

Saving obtains an audio-engine checkpoint after queued inputs have been applied, so settings selected between ticks are included without forcing an extra musical tick. The saved baseline is an isolated copy of exactly the serialized snapshot. Changing back to saved values clears the corresponding dirty entries. Before overwriting a previously opened/saved destination, the current file contents are compared with the last read/written contents; an external edit is preserved and directs the user to Save As. This is a pre-write conflict check, not an operating-system-wide lock against unrelated applications writing concurrently.

Chrome's native file-picker APIs provide direct file access. The write is considered successful only after `close()` resolves, following the [Chrome File System Access workflow](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) and [writable-stream documentation](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable).

Where direct saving is unavailable, the panel explicitly offers Download copy. Requesting a download does **not** establish a successful saved baseline or automatically continue Save & open; the current instrument and dirty state remain. Open falls back to a normal file input. The user can keep the downloaded copy and then explicitly discard/open. This fallback avoids claiming knowledge of whether a requested download was actually retained.

These versioning, validation bounds, conflict detection, fallback, and held-input policies are implementation choices made to make the approved workflow concrete. They were not separately established by the original manual discussion.

## Design and verification

The accepted main document/unsaved/Revert renders were preserved. Before adding runtime document controls, [four supplementary states](prototypes/documents/index.html) were rendered and inspected: [first save](prototypes/documents/first.png), [save error](prototypes/documents/error.png), [invalid file](prototypes/documents/invalid.png), and [download fallback](prototypes/documents/fallback.png). [Their renderer](prototypes/documents/render.mjs) uses an isolated local Chrome profile. These supplement the accepted design; separate hands-on acceptance of the added states remains pending.

- **97 tests pass** across twelve files. New cases verify complete document round trips, validation boundaries, protected slots, immutable initial fixtures, dirty-value restoration, successful and failed writes, external edits, separate Save As destinations, concurrent edits remaining dirty, Revert copies, and queued-settings checkpoints without extra ticks. Existing performance, audio, capture, keyboard, and MIDI tests remain passing.
- `npm run build` passes TypeScript checking and creates the production bundle under `docs/build/`.
- [Document browser checks](document-runs/browser-check.json) exercise capture → save → full page reload → open, settings restoration, current-file Save, canceled pickers, failed close during Save & open, retry, note/control reset, Revert and its cancellation, invalid files, external edits, separate Save As, download fallback, actual file-input Open, New confirmation/cancellation, and both review viewport sizes.
- The document harness replaces only the native picker boundary with handles backed by real browser origin-private file streams. File reads/writes/close and page-reload persistence are real. Cancellation and close failures are deliberately injected. The fallback Open reads the actual example JSON file under `docs/document-runs/`; fallback downloads are written under that directory's `downloads/` folder. The harness does not access user files or install mutable diagnostics in the application.
- The [capture browser regression](capture-runs/browser-check.json) passes after adapting New instrument to its new confirmation flow. It still verifies explicit capture Auto Button enabling, raw selection, shared-note ownership, naming, cancellation, scrolling, 15 seconds of continuous capture dragging, and 30 seconds of normal dragging without an audio fault or queue overflow.
- Production [first-save](document-runs/01-first-save.png), [unsaved-open](document-runs/02-unsaved-open.png), [save-error](document-runs/03-save-error.png), [Revert](document-runs/04-revert.png), and [fallback](document-runs/06-download-fallback.png) states are captured. Main states were visually inspected; the file panel fits 1280 × 800 and 1600 × 1000.

The native operating-system picker and its permission/overwrite prompts still need a hands-on check. The browser automation proves the workflow and real stream lifecycle with controlled picker results, not the native chooser UI. Physical audio/MIDI timing and subjective playability remain outside these software checks.

Reproduce with the production server running on port 5174:

```sh
npm test
npm run build
python3 -m http.server 5174 --bind 127.0.0.1 --directory docs/build
# In another terminal:
node docs/document-runs/browser-check.mjs
node docs/capture-runs/browser-check.mjs
```

## Hands-on check

1. Capture a named chord or mode. Choose File → Save As and save an instrument file under `docs/` for the first check. Reload the page and Open that file; check the captured slot, selected pattern, sound, and Auto Button setting.
2. Change the instrument and Save. Use Save As to create another file and confirm that the first file remains separate.
3. Hold notes with Sustain or Drone, change a setting, and Open another file. Try Cancel first, then Save & open; notes should continue until replacement, then stop.
4. Make another change and use Revert. Confirm that settings return to the last saved/opened version and all live latches turn off.

[Slot editing/copy-paste](slot-implementation.md) is now implemented, with optional version 1 selection metadata preserving duplicate-slot identity. Additional behavior controls, legacy-file import, full preset reconstruction, and broader original-instrument parity remain later work. This slice completes file persistence for the features currently implemented.
