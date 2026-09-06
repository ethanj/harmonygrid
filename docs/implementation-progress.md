# Playable foundation execution

> Current status, 2026-09-06: the autonomous completion pass implemented the remaining software slices. See the [review guide](review-guide.md) for current behavior, evidence, and outstanding physical/legacy verification. This document's earlier status is historical.


Started 2026-09-05 on `feat/playable-foundation`, in the existing project directory. The supplied manual and accepted design artifacts remain in place. No commits, pushes, or publication are part of this run.

## Contract

- Ethan instructed: do not use Superpowers. Continue with the project requirements and ordinary engineering judgment; no Superpowers workflows, agents, or approval gates apply.
- [Requirements](requirements.md) govern musical behavior; [design review 01](prototypes/design-review.md) is the accepted visual baseline.
- [Feasibility plan](browser-feasibility-plan.md) defines the experiment. Its documentation-only restriction described the earlier planning task; Ethan has now explicitly requested implementation.
- Performance results, review notes, captures, and build output belong under `docs/`. Source, tests, package metadata, and installed dependencies occupy normal project locations.
- Policy choices and performance targets were submitted together for clarification. Ethan subsequently said “Proceed”; the experiment defaults and targets are recorded in [feasibility decisions](feasibility-decisions.md).
- The existing checkout is used on a new feature branch, preserving the untracked `docs/` artifacts. No second worktree is created.

## Progress

- Task 0: complete. Five design states and overall surface accepted.
- Task 1: implemented initial engine and deterministic witnesses. Exact dependency versions are locked. Remaining combined-control and recovery cases stay visible in the requirements; do not claim exhaustive original parity.
- Task 2: AudioWorklet and bounded oscillator bank implemented; browser checks confirm nonzero, finite samples. Physical output timing and sustained captured pulse train remain unverified.
- Task 3: playable grid/clavier, original performance keys, tempo controls, Auto Button, Smooth Clavier, and OffscreenCanvas presentation implemented. Production browser checks and headless profiling completed; Ethan has completed and accepted the hands-on playing checklist.
- Task 4: MIDI input/output adapters, immediate Thru, priority/fallback, and shared-note ownership implemented. Adapter and engine checks run without external equipment; physical MIDI ports/loopback remain unverified.
- Capture slice: raw mouse/MIDI collection, independent audition ownership, default-off audition limit, fixed reference, naming, protected slot replacement, and capture cancellation implemented. See [capture implementation](capture-implementation.md). Ethan accepted the capture slice, including Auto Button off by default.
- Document slice: versioned instrument files, validation, native file access with explicit download fallback, unsaved-change handling, saved-snapshot Revert, and guarded New implemented. 97 tests and the build pass; [document browser evidence](document-implementation.md#design-and-verification) records persistence and failure cases.
- Slot slice: staged name/interval editing, protected slots, typed copy/paste, original C/V modifiers, and persisted duplicate-slot identity implemented. Ethan approved this slice. See [slot implementation](slot-implementation.md).
- Task 5: software smoke checks pass; 16×12 and 24×16 headless profiling completed. [The report](feasibility-report.md) preserves exact scope, evidence, and remaining gates. This remains provisional, not browser-feasibility acceptance.

## Latest playing review

The [combined-control review](playing-review.md) ran for 5 minutes 40 seconds without an audio fault, found and fixed a Smooth Clavier/Auto Button grid-release bug, and verified eight follow-up browser cases. 54 tests and the build pass. Ethan completed and accepted the short hands-on checklist, including Smooth Clavier. [Design review 02](prototypes/authoring/design-review.md) now provides rendered chord/mode authoring and document flows: eleven states at two review sizes, including a scrollable long changes list. Capture, naming, slot editing, the file-based workflow, and unsaved-change handling are accepted; Revert reset behavior and turning Drone off on Open are also accepted. [Design review 03](prototypes/capture-revision/design-review.md) now renders those capture revisions in six entry states plus an explicitly enabled limit state at two sizes, with default-off and pitch-marker checks and nine preview interaction checks passing. Ethan has accepted design review 03, including the corrected unchecked default, selected/sounding distinction, naming message, and five-second header notice. Live chord/mode capture and naming are now implemented from that accepted design. The [capture implementation report](capture-implementation.md) records 68 passing tests, production-browser evidence, provisional transition choices, and the next hands-on checklist. File Open/Save/Save As/Revert and guarded New are now implemented; see the [document implementation report](document-implementation.md). Captured slots, sound, and implemented settings now persist in instrument files. Ethan approved the document workflow. The slot editor and original copy/paste are now implemented; see [slot implementation](slot-implementation.md) for verification; Ethan has now approved the slot editor. Native chooser prompts are not covered by automation.

## Implementation notes

- Ethan's first live evaluation reported both dragging and sound stopping after a few seconds. A duplicate audio quantum was reproduced and fixed; six fresh Chrome runs passed, including three duplicate-block cases. Ethan confirmed that freeze is fixed. Ethan later completed and accepted the hands-on playing review. Physical timing and external MIDI measurements remain outstanding. [Investigation and recovery verification](freeze-investigation.md) records the follow-up.

- The startup/MIDI strip was rendered and inspected in [design 06](prototypes/06-live-controls.png) before implementation. It replaces the prototype navigation footer. This operational addition is not claimed separately accepted by Ethan.
- Engine fixes include: no reattack when releasing an older MIDI key; distinct repeated presses of the same MIDI key; Sustain eviction ages that do not refresh on stationary ticks; separate synthesis voices per output channel; Play Chords off produces MIDI visualization without generated notes; an unchanged held MIDI trigger does not continually override a manually changed root.
- Source changes are on a feature branch in the existing checkout. No Superpowers workflow is in use.

## Plan review

| Boundary | Review |
| --- | --- |
| Task 0 → 3 | Accepted static fixtures provide visual references, not live performance evidence. |
| Task 1 → 2 | Engine must accept an explicit sample clock and produce timestamped note actions; no DOM dependencies. |
| Task 1 → 3/4 | One committed snapshot must drive grid, clavier, and source ownership consistently. |
| Task 2 → 3 | Visual presentation must account for output time, not simply draw future audio state on receipt. |
| Task 2 → 4 | Window-only Web MIDI requires a measured scheduling bridge; late receipt cannot be presented as synchronized output. |
| Task 3/4 → 5 | Browser automation and software traces cannot establish physical latency or musical usability. |
| Plan scope | Feasibility foundation includes core controls and capture tests; full document/authoring UI and SoundFonts remain later work. |

## Technical references checked

- [Vite setup](https://vite.dev/guide/) and exact npm package metadata checked before installation.
- [AudioWorklet processing](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process): actual render block length must be respected.
- [AudioWorklet communication](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/port): message bridge across the audio boundary.

## Next work after slot-editor acceptance

The [feature-gap audit](feature-gap-audit.md) compares the current implementation with the manual and recorded decisions. Recommended next slice: render full grid-layout and register settings, then implement after design review. It also records the manual/current MIDI Thru channel discrepancy, inaccessible performance settings, sound-palette work, musical variations, and outstanding real-time evidence.

The [Grid & register prototype](prototypes/grid-settings/design-review.md) now provides six states at two sizes and working draft/Apply/Cancel interactions. It is awaiting design review; runtime settings remain unchanged. Musical policy proposals are listed separately and are not automatically settled by layout approval.

## Grid/register slice — 2026-09-06

Ethan accepted the prototype and confirmed its musical defaults. Full 1–12 axes, grid/clavier registers, highest pointer pitch, shared capture mapping, saved settings and older-file defaults are now implemented. See [grid/register implementation](grid-settings-implementation.md): 128 unit tests, a passing build, 21 worker and 21 fallback browser checks, plus capture/document/slot regressions. Live hands-on acceptance of this implementation is next.
