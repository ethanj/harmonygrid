# Harmony Grid — design review 02: authoring and documents

Created 2026-09-05. Status: review in progress. Ethan accepted the chord capture panel's selection/reference clarity, the naming/slot-replacement flow, mode capture with octave folding, the slot-editor layout, the file-based document workflow, and unsaved-change handling. Revert reset behavior and clearing Drone on Open are accepted. Capture prototype revisions are rendered in [design review 03](../capture-revision/design-review.md) and are accepted as the capture implementation reference. The remaining implementation decisions below are still outstanding. The hands-on playing checklist is accepted. These authoring/document interfaces are not yet implemented in the instrument.

Open [the prototype](index.html) and use the cream footer to navigate six main scenes. The mode naming/editor, Open, and Revert variants are reached through their corresponding buttons. Everything in this directory is a design artifact. No audio, MIDI connection, real clipboard, file access, or document persistence is implemented here.

## Rendered screens

Each state was rendered and visually inspected at 1280 × 800 and 1600 × 1000, device scale 1. These are review sizes, not measured dimensions of Ethan's display.

| Screen | Baseline render | Larger render |
| --- | --- | --- |
| Chord capture: removed C4 remains the anchor | [07](07-collect-chord.png) | [1600 × 1000](1600x1000/07-collect-chord.png) |
| Chord naming and slot replacement | [08](08-name-chord.png) | [1600 × 1000](1600x1000/08-name-chord.png) |
| Mode capture: six exact pitches become five tones | [09](09-collect-mode.png) | [1600 × 1000](1600x1000/09-collect-mode.png) |
| Mode naming and slot replacement | [08b](08b-name-mode.png) | [1600 × 1000](1600x1000/08b-name-mode.png) |
| Chord slot editor and copy/paste | [10](10-edit-slots.png) | [1600 × 1000](1600x1000/10-edit-slots.png) |
| Mode slot editor and copy/paste | [10b](10b-edit-modes.png) | [1600 × 1000](1600x1000/10b-edit-modes.png) |
| Save As | [11](11-save-document.png) | [1600 × 1000](1600x1000/11-save-document.png) |
| Open | [11b](11b-open-document.png) | [1600 × 1000](1600x1000/11b-open-document.png) |
| Unsaved changes before opening | [12](12-unsaved-changes.png) | [1600 × 1000](1600x1000/12-unsaved-changes.png) |
| Long changes list with scrolling | [12c](12c-many-changes.png) | [1600 × 1000](1600x1000/12c-many-changes.png) |
| Revert confirmation | [12b](12b-revert-document.png) | [1600 × 1000](1600x1000/12b-revert-document.png) |

## Capture and naming

The grid and clavier retain the accepted visual language. The collection panel lists exact pitches and keeps the reference visible. In the chord example, C4 was selected first and then removed. E4, G4, B4, and C5 remain, producing offsets +4, +7, +11, and +12 from C4. A reference need not be a chord member. In the mode example, C4 and C5 remain separate selections but contribute one C pitch class to the completed mode.

The [manual](../../harmonygrid.pdf), printed pages 23–25 (PDF pages 27–29), describes holding N for Make Chord or M for Make Mode, collecting raw pitches in temporary Solo/Chromatic operation, then releasing the key to name and assign the result. The [confirmed requirements](../../requirements.md) govern exact-pitch toggling, MIDI release retaining selections, fixed references after removal, and octave folding. The capture fixture shows Auto Button off; this does not propose silently changing that setting on entry. The manual's Auto Button behavior must remain available.

Visible Make buttons and a Name & choose slot button are proposed alternatives to holding a key. Naming shows protected slot 1, the slot that will be replaced, and a pitch summary before commitment. The original digit-then-Tab workflow remains part of the intended implementation. Short names are encouraged without deciding a new character limit.

## Editing slots

The proposed editor offers Chords/Modes tabs, all ten slots, names, and relative intervals. Slot 1 remains protected. Copy/paste stays within the pattern type, as described on printed page 26 (PDF page 30). The original C/V and modifier-based targeting remain required even though these screens emphasize visible buttons.

Direct renaming and returning to pitch collection are modern editing proposals. Saved patterns are relative structures; C4 in these capture examples is a reference used to explain the offsets, not a restriction that the chord can only play at C4. Fixture slot contents are illustrative, not a reconstruction of every original preset.

## Documents

Ethan approved normal instrument files with Open, Save, Save As, and Revert on 2026-09-05, with chords, modes, sound, and playing settings saved together. This follows printed page 34 (PDF page 38) and the manual's menu inventory. A browser library was offered as an alternative; the file-based workflow is now selected. Browser file permissions and compatibility have not yet been implemented or validated.

Save writes the existing document, using Save As when there is no destination. Save As chooses a separate file. Open checks the selected file before replacing the instrument; unsaved changes offer Cancel, Discard & open, or Save & open. Revert explicitly identifies the loss of changes since the last save. The operating system's file chooser is the next step, not a custom filesystem browser in the application.

The confirmed rule is that opening another instrument immediately releases all old notes, including Sustain and Drone, regardless of tick timing. Live Sustain, Hold, Drone, and Repeat latches are not restored. Ethan approved Revert restoring saved settings, immediately releasing current notes, and clearing live Sustain, Hold, Drone, and Repeat states on 2026-09-05. Ethan also explicitly approved turning Drone off when opening another document, so all four live controls start inactive on Open.

Ethan accepted the unsaved-changes flow on 2026-09-05: Cancel, Discard & open, or Save & open. Cancel or a failed save keeps the current instrument intact; Save & open proceeds only after saving succeeds. The proposal also preserves the current document when a file chooser is canceled or an incoming file is invalid. Merely opening the File panel or losing ordinary focus does not release notes. Replacing the instrument is the release boundary. Error-message designs, first-save state, and held physical inputs during replacement need a later pass before document implementation is complete.

## Decisions still needed before implementation

- The [capture eviction control and selected/sounding distinction](../capture-revision/design-review.md) are accepted. Live behavior when changing the limit or returning from naming still needs resolution; the preview recomputes illustrative sound states. Selecting an already-sounding pitch into capture strikes it again, including pitches held by Sustain or Drone; pre-existing retention remains intact. Capture has no eviction by default; optional eviction uses a separate allowance that cannot evict pre-existing performance notes. New capture drafts start empty; pre-existing notes are not automatically selected. Pre-existing notes, including Sustain and Drone notes, continue underneath capture; entering capture does not release them. Leaving collection for naming or cancellation immediately releases capture audition notes; that exit behavior is accepted. Capture auditioning sustains notes with no eviction by default. If capture eviction is enabled, only the oldest sounding capture notes above its separate Hold Number allowance are released; draft selections remain intact. Draft cancellation and selection restoration are accepted.
- Key sequences beyond the confirmed N → M handoff, including reversed release order and repeated switching. The accepted sequence is hold N, press M to switch to mode capture, release N while continuing collection, then release M to finish. Switching type preserves exact selected pitches and the fixed reference.
- Explicit review of visible-button capture entry. Revert reset behavior and turning Drone off on Open are accepted, along with the slot-editor layout, file-based workflow, and unsaved-change handling.
- Name limits, file format/versioning, browser save fallback, and complete preset reconstruction.

These remain explicit gaps in the [requirements](../../requirements.md). Reviewing this layout must not silently resolve them.

## Preview boundaries and verification

You can toggle exact pitches within a capture screen, change the naming slot, edit text, switch tabs, and follow the illustrated file flow. Each screen resets its fixture on entry; edits are not carried through to another screen. The slot editor illustrates slot 6. Copy, paste, cancel, and completion buttons explain their intended effect through preview messages. Keyboard performance bindings, MIDI input, actual auditioning, modal focus management, and engine integration are not part of this prototype.

The [renderer](render.mjs) generated twenty-two PNGs with installed Chrome 152.0.7977.76, using an isolated temporary profile under this directory. [Render manifest](render-manifest.json) records browser/version and dimensions; [layout QA](visual-qa.json) records the fixtures and viewport checks. All checked controls and text fit their viewport and no checked control text overflows. A clipped Cancel control in mode capture was corrected before the final renders; long pitch lists scroll while collection actions remain reachable. These checks establish fixture layout only, not live instrument behavior or accessibility conformance.

Reproduce from the repository root:

```sh
node --check docs/prototypes/authoring/authoring.js
node docs/prototypes/authoring/render.mjs
```

Editable sources are [index.html](index.html), [authoring.css](authoring.css), and [authoring.js](authoring.js), reusing the accepted [base CSS](../mockup.css) and [SVG fixture helpers](../mockup.js). No application source or accepted playing renders were changed for this design pass. Application tests and builds were not rerun; they would not validate these design choices.

Review capture/reference clarity first, then naming and slot replacement, then the document workflow. Implementation follows review and resolution of the relevant behavioral gaps.

## Acceptance record

| Area | Status |
| --- | --- |
| Chord capture selection panel and fixed reference after removing C4 | Accepted by Ethan, 2026-09-05: “yes” to whether the panel clearly shows C4 remaining the anchor after removal. |
| Naming and slot replacement | Approved by Ethan, 2026-09-05, after reviewing Name & slot: protected Solo slot, explicit replacement target, and captured-pitch summary before confirmation. |
| N → M keyboard handoff | Accepted by Ethan, 2026-09-05: “yes” to holding N, pressing M to switch to mode capture, releasing N without ending collection, then releasing M to finish. |
| Switching capture type | Accepted by Ethan, 2026-09-05: “yes” to carrying selected pitches and the fixed reference unchanged between Make Chord and Make Mode during capture. |
| New capture starts empty | Accepted by Ethan, 2026-09-05: “yes” to starting a new capture with an empty selection, without automatically adding notes already sounding. The first new selection establishes the reference. |
| Pre-existing notes during capture | Accepted by Ethan, 2026-09-05: “yes” to notes already sounding before capture, including Sustain and Drone notes, continuing underneath it. The subsequent empty-start decision confirms that these pitches are not automatically added to the capture draft. |
| Audition notes on collection exit | Accepted by Ethan, 2026-09-05: “yes” to immediately stopping capture audition notes when leaving collection for the naming dialog or cancellation. Pre-existing performance notes continuing underneath capture was accepted separately. |
| Capture attack on an already-sounding pitch | Accepted by Ethan, 2026-09-05: “yes” to striking an already-sounding pitch again when selected into capture for auditioning. Pre-existing retention remains intact. |
| Capture auditioning | Corrected by Ethan, 2026-09-05: “it should default to no eviction”, then explicitly “approved”. Selected notes sustain without default eviction. This supersedes the earlier default oldest-note eviction agreement. |
| Optional capture limit | Approved by Ethan after the default correction: eviction is optional and off by default, uses a separate capture Hold Number allowance, and never removes draft selections or evicts pre-existing performance notes. |
| Capture size versus Hold Number | Accepted by Ethan, 2026-09-05: “yes” to keeping every selected pitch in the draft even when the sounding-note limit is lower. Sounding-note eviction must not remove draft selections. |
| Capture cancellation | Accepted by Ethan, 2026-09-05: “yes” to Escape or Cancel discarding the capture draft, restoring the previous chord/mode selection, and leaving existing slots unchanged. Sound/retention interactions remain separate. |
| Ending an empty capture | Accepted by Ethan, 2026-09-05: “yes” to releasing N or M ending capture without creating or replacing anything, with a brief “No pitches selected” notice. |
| Reference after clearing and refilling capture | Accepted by Ethan, 2026-09-05: “yes” to keeping the original anchor/root within the same capture operation, including C4 → empty → E4 retaining reference C4. |
| Mode capture and octave folding | Accepted by Ethan, 2026-09-05: “ok yeah that is fine” after clarifying that C4 and C5 are distinct selected pitches but contribute one C tone to the finished mode. |
| Slot editing and copy/paste | Accepted by Ethan, 2026-09-05: “yes” to the layout for managing chord/mode slots, names, intervals, pitch editing, and copy/paste, with slot 1 protected. |
| File-based document workflow | Accepted by Ethan, 2026-09-05: “yes” to normal files with Open, Save, Save As, and Revert, preserving chords, modes, sound, and playing settings together. |
| Unsaved-change handling | Accepted by Ethan, 2026-09-05: “yes” to Cancel, Discard & open, or Save & open before replacing an instrument, with Cancel or a failed save preserving the current instrument. |
| Changes-list padding and scrolling | Accepted by Ethan, 2026-09-05: “good” after reviewing the expanded 40-entry scroll test with fixed action buttons. |
| Revert reset behavior | Accepted by Ethan, 2026-09-05: “yes” to restoring saved settings, immediately releasing current notes, and clearing live Sustain, Hold, Drone, and Repeat states. |
| Drone latch state when opening another document | Accepted by Ethan, 2026-09-05: “yes” to turning Drone off on Open, matching the other live controls and Revert. Releasing old Drone notes was already confirmed. |

Capture visual clarity, the fixed reference after emptying/refilling, ending an empty capture, and draft cancellation with selection restoration are accepted separately. The remaining implementation decisions listed above are still open.

## Changes-list revision — 2026-09-05

Ethan requested additional list padding after reviewing the unsaved-changes dialog and asked about longer lists. The bullet column now has a 36px left inset, with 20px right padding and 16px vertical padding. Entries have 8px separation; wrapped text aligns with the entry text. The list grows to a maximum of 220px (or 28% of viewport height, whichever is smaller), then scrolls independently. It is keyboard focusable. The explanation and action buttons stay outside the scrolling area.

A [40-change preview](index.html?scene=6&changes=many) includes a wrapping entry and a labeled final entry. Ethan requested the longer fixture specifically to exercise scrolling; the added entries are synthetic test content. Both the normal and long-list states were rendered and visually inspected at both review sizes. Renderer checks confirm that the final entry is reachable, footer position is unchanged by scrolling, and the dialog remains within the viewport. Updated captures and QA data are stored alongside this review. This revision does not approve or change the pending Revert/reset proposal.

Ethan accepted the padding and scrolling revision after reviewing the 40-entry test. Preserve this treatment when implementing the document dialog.

## Empty-capture decision — 2026-09-05

Releasing N or M with no selected pitches ends capture without creating or replacing a pattern and briefly shows “No pitches selected”. Ethan approved this behavior. The manual describes a beep and no naming dialog; the approved notice specifies the modern feedback. This original prototype disables its naming button when empty. The N/M release flow and empty-capture notice are now demonstrated in [design review 03](../capture-revision/design-review.md); the revised header placement and five-second duration are accepted.
