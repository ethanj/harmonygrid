# Slot editing and pattern copy/paste

Implemented on `feat/playable-foundation` in the existing checkout. Source is under `src/slots/`; design and verification artifacts stay under `docs/`. No Superpowers, commits, pushes, or publication were used.

## Using the editor

Choose **Edit…** in the header. Chords and Modes each show ten slots, their names, and relative intervals. Select a slot to rename it or edit its exact intervals. Chord offsets preserve negative values and octave spacing; mode offsets range from 0 to 11. Zero is optional. Empty names, empty patterns, repeated intervals, fractional values, and out-of-range values are rejected.

Changes are staged across slot and tab navigation. **Apply changes** validates the entire transaction and commits all changed slots together; **Cancel** or Escape discards every unapplied change. An invalid draft blocks Apply even after navigating away from it. Editing an inactive slot leaves the playing pattern unchanged. Editing the selected slot's intervals uses the existing engine settings path and tick behavior. Renaming alone does not send an engine settings event or retrigger notes.

**Copy** takes a value copy of the displayed draft. **Paste here** replaces the destination draft and still requires Apply. The clipboard is tagged as chord or mode; cross-type paste is unavailable. Slot 1, Solo/Chromatic, cannot be renamed, edited, or replaced, but can be copied to other slots. Protection also applies to the underlying transaction and clipboard APIs.

While the editor owns focus, performance key-downs and new mouse/MIDI attacks are paused; existing notes and controls follow the same continuing-performance policy as the File dialog, and held-control releases can still reach the engine. Finish/cancel capture before editing; close the editor before starting capture or working with files. The editor scrolls on smaller screens.

## Original shortcuts and modern choices

The original manual's section 4.10, printed page 26 (PDF page 30), was visually checked in [this render](slot-runs/manual-copy-paste.png). During normal playing:

- C copies the currently selected slot; V replaces the currently selected destination slot.
- Command is optional; Ctrl is also supported for the browser implementation.
- Shift or Caps Lock, but not both, targets modes. Neither or both targets chords.
- No paste is allowed before copying, across pattern types, or into slot 1.

Input fields retain native text copy/paste. The editor uses its explicit Copy/Paste buttons and active tab, so text editing cannot accidentally replace a playing slot.

Staged transactions, direct interval text entry, typed clipboard feedback, and validation messages are modern implementation choices. The application clipboard survives Open/New/Revert within the same page, allowing patterns to move between instrument files; it does not survive reload and is not the system clipboard. The earlier prototype's return-to-pitch-collection action is not implemented in this slice: existing patterns are edited through exact intervals, and Make chord/mode continues to create new captured patterns.

## Persistent selection identity

Identical note patterns can occupy multiple slots after copying. Playing selection therefore tracks a slot index independently of the note array. The display marks one selected slot, and editing or pasting into another identical slot does not silently retarget the playing selection.

Version 1 files now support an optional `selection` object containing zero-based chord/mode indices, or null for a custom pattern. New saves include it. Older files without this field still load by inferring the first matching slot. Non-null indices must agree with the saved playing patterns. Identity-only selection changes are included in the unsaved-change summary. Save, Open, and Revert preserve this identity.

## Design and verification

The accepted [authoring layout](prototypes/authoring/design-review.md) was retained. Before implementation, supplemental interval-entry states were rendered and inspected: [chord](prototypes/slot-editor/chord.png), [mode](prototypes/slot-editor/mode.png), and [invalid draft](prototypes/slot-editor/invalid.png). They are available in the [prototype](prototypes/slot-editor/index.html?scene=4).

- 111 tests pass across 13 files. New witnesses cover interval parsing, mode bounds, value-copy semantics, protected slots, staged drafts, atomic validation, the total file-size limit, inactive/current pattern updates, duplicate slot identity, and backward-compatible file loading.
- `npm run build` passes TypeScript checking and creates the production bundle in `docs/build/`.
- All 30 [slot browser checks](slot-runs/browser-check.json) exercise the real production UI and AudioWorklet: staging/cancel, invalid transactions, protected slots, all modifier combinations, rename without a settings event, selected interval updates, duplicate selection, save/reload/Open/Revert, capture gating, and viewport behavior.
- File persistence uses real browser origin-private file streams with only the picker boundary substituted. Caps Lock combinations use explicit keyboard events with a supplied lock state because CDP has no lock-state bit; plain, Shift, and Command shortcuts use CDP key input. These checks do not establish behavior of the native OS chooser or a physical Caps Lock key.
- The document regression passes all 29 checks, and the capture regression passes all 37 checks, including 15 seconds of capture dragging and 30 seconds of normal dragging with finite nonzero audio and no queue overflows. Their reports remain under `document-runs/` and `capture-runs/`.
- Production screenshots: [staged editor](slot-runs/01-staged-editor.png), [invalid draft](slot-runs/02-invalid.png), and [compact scrolling layout](slot-runs/03-compact.png).

Reproduce with the production server on port 5174:

```sh
npm test
npm run build
node docs/slot-runs/browser-check.mjs
node docs/document-runs/browser-check.mjs
node docs/capture-runs/browser-check.mjs
```

## Hands-on check (accepted)

Ethan approved this slice after the live implementation review. The checklist below is retained for regression use.

1. Open Edit, rename a chord and change its intervals to `-12, 4, 12`. Switch tabs and back; confirm the draft remains. Cancel once, then repeat and Apply.
2. Copy to another chord slot. Check that mode paste is unavailable and Solo/Chromatic remain protected.
3. Play the edited slot, then try normal C/V and Shift+C/V. Save and reopen the instrument; confirm the exact selected slot and patterns return.

This completes the bounded slot editor and original copy/paste workflow. Returning existing patterns to pitch collection, broader behavior controls, legacy-file import, factory-preset reconstruction, and complete original-instrument parity remain separate work.
