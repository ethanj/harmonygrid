# Harmony Grid reimplementation requirements

Status: working requirements, 2026-09-05. The first playing-surface design is accepted and an initial playable foundation is implemented. Requirements discovery for complete parity is still in progress. This is not a claim that browser feasibility has been established. See [design acceptance](prototypes/design-review.md), [experiment decisions](feasibility-decisions.md), and [evaluation evidence](feasibility-report.md).

## Goal and evidence

Reimplement Harmony Grid as a complete, responsive, real-time musical instrument using modern technology. Full musical behavior, performance interaction, visualization, authoring, MIDI, and document functionality are the target. The previous attempt failed in interface quality, alignment with the original, and practical playability; a feature checklist alone is insufficient acceptance evidence.

Sources:

- [Original users' guide](harmonygrid.pdf). Page references below are the printed page numbers, not PDF page indices.
- Ethan's recollections and explicit decisions in the requirements discussion. Later corrections supersede earlier answers.
- Proposed modern adaptations are identified separately from recollected behavior.

No original application, source code, or instrument documents are available as reference evidence in this discussion. Do not describe reconstructed behavior or example documents as independently verified against the original program.

## Confirmed performance and interface requirements

### Playing surface

- Mouse plus computer keyboard is the primary performance interface. Preserve the original playing technique and use the original key bindings as the baseline.
- Preserve the original arrangement: chords across the top, modes on the left, grid in the center, clavier below, and performance status beside the grid.
- The dragged anchor is the manual's "lead pitch." It is distinct from the independently selected scale root and need not be the harmonic root of a chord.
- Render the entire current chord, including every filtered note. Each constituent note must visibly reflect whether it is played or filtered; filtering must not make its position in the chord shape disappear.
- Notes retained by Sustain or Drone remain visible on both grid and clavier alongside the current chord.
- All sounding notes use the same visual treatment, regardless of whether they belong to the current chord, Sustain, or Drone. Filtered notes remain visually distinct.
- Foreground responsiveness and actual playability are mandatory. No selected framework or renderer establishes acceptance by itself.
- Follow a design-driven workflow: render visual prototypes before implementing their corresponding application interface. Review representative playing states with Ethan and revise the prototypes before translating the accepted design into the instrument.

### Metronome and input sampling

- With the metronome enabled, the chord visualization and sound advance together on a tick. Do not preview intermediate chord positions between ticks by default.
- A tick uses the mouse's current position. Intermediate mouse positions are discarded, not queued for later playback.
- An unchanged pitch does not retrigger unless Repeat is active. Changing the selected chord triggers its replacement on the next tick even if the mouse stays stationary.
- Mode and scale-root changes take effect on the next tick, changing the relevant display and sound together.
- Ordinary mouse-button release waits until the next tick when Auto Button, Sustain, Hold, and Drone are off.
- Chosen short-click behavior: a press and release completed between ticks produces a chord on the next tick, lasting one full tick and releasing at the following tick, absent retaining controls. This is an explicit design choice, not a verified historical detail.
- The remembered short-click play request is distinct from discarded intermediate pointer positions. Exact behavior for several short clicks within one tick remains unresolved.
- With the metronome disabled, immediate playing follows the manual baseline. Physical input, audio buffering, and display presentation have finite latency; numerical acceptance limits remain to be established.

### Note attacks and lifetimes

- With Sustain, Hold, and Drone off, a new chord event releases the previous chord and strikes all unfiltered notes of the new chord again, including shared pitches.
- Sustain accumulates newly encountered pitches. Pitches already sounding under Sustain continue without another attack during ordinary chord changes.
- Releasing Sustain takes effect on the next tick when the metronome is enabled. If the mouse button remains held, preserve the current chord and release accumulated earlier notes that are no longer required.
- Exceeding the Sustain hold limit releases the oldest notes individually. The earlier decision to evict whole chords was corrected and is superseded.
- Hold retains the current chord after mouse-button release. A replacement chord strikes all its notes again, including shared pitches; Hold does not itself provide Sustain's shared-pitch continuity.
- Releasing Hold with the mouse button already up stops the held chord on the next tick when the metronome is enabled.
- Drone captures sounding notes while subsequent playing proceeds independently. A captured pitch continues without another attack when included in a later chord.
- Turning Drone off takes effect on the next tick when the metronome is enabled. Preserve pitches still required by the current chord or Sustain.
- Repeat forces an attack on each tick, including current-chord pitches already held by Sustain.
- Repeat does not restrike a Drone-held pitch, even when it is also in the current chord. Other pitches in the repeated chord are attacked normally. Ethan reaffirmed this default after the playing-review example; his earlier suggestion to reattack drone pitches is superseded.
- Notes retained by Sustain or Drone survive mode and scale-root changes, including when they fall outside the new scale.

### MIDI interaction

- Mouse-generated notes use fixed velocity by default. Its value is adjustable and saved in the instrument document.
- With Play Chords enabled, generated chord notes inherit the triggering MIDI note's velocity.
- MIDI-generated chord attacks and releases wait until the next tick when the metronome is enabled.
- A MIDI note that starts and ends between ticks generates a chord on the next tick for one full tick, matching the chosen short-click behavior.
- MIDI Thru forwards the original events immediately, including note-off, independently of generated-chord timing.
- Incoming MIDI visualization waits until the next tick when the metronome is enabled. The earlier answer that it updates immediately was corrected and is superseded. MIDI Thru remains immediate.
- Default MIDI chord generation uses one active trigger, with the newest held MIDI note taking priority and replacing the previous generated chord on the next tick.
- Releasing the newest MIDI note resumes the previously held note's chord on the next tick. For example, hold C, press E, release E: C chord, E chord, C chord.
- With Sets Root enabled, resuming the older held note also restores its scale root on that tick.
- Releasing the final MIDI note leaves the scale root at its last value.
- Multiple independent MIDI triggers and their generated chords are an optional configuration saved with the document. Detailed root arbitration in this mode remains unresolved.
- With Mouse Solo enabled, mouse melody and MIDI accompaniment sound simultaneously. Releasing either source preserves pitches still held by the other.
- With Sustain and Drone off, a mouse attack on a pitch already sounding from MIDI accompaniment strikes it again. Attack behavior and continuing responsibility for a note are separate concerns.

### Creating chords and modes

- Make Chord and Make Mode accept selections from both mouse and MIDI.
- Each new capture starts with an empty draft selection. Notes already sounding before capture are not automatically added; the first newly selected pitch establishes its anchor/root.
- Switching between Make Chord and Make Mode during the same capture preserves the exact selected pitches and fixed reference. Mode pitch-class folding occurs when creating the mode, not when switching capture type.
- Confirmed keyboard handoff: hold N for chord capture, press M to switch to mode capture, release N and continue collecting, then release M to finish mode collection. Releasing the earlier N must not finish collection or open the naming dialog.
- Collection uses raw selected pitches, bypassing Play Chords and scale filtering.
- Auto Button starts off for each new pitch capture, independently of the normal-playing setting. It can be enabled during collection; exiting capture restores the normal-playing setting. Ethan corrected this default after reviewing the live capture implementation.
- Capture visualization distinguishes selection from sound: grid outlines and clavier selection bars identify draft membership; mint fills identify sounding pitches. A selected pitch may be silent, or continue sounding only from the pre-existing performance. This treatment was accepted in design review 03.
- Hold Number does not limit the pitches stored in a capture draft. Keep every selected pitch until it is explicitly toggled off or the capture ends, even if the sounding-note limit is lower. This is an approved modern behavior choice; draft membership is separate from sounding-note retention.
- Notes already sounding before capture, including Sustain and Drone notes, continue sounding underneath it. Entering capture does not itself release them.
- During capture, selected notes sustain for auditioning with no note eviction by default. Exceeding Hold Number does not release capture notes in this default mode. This correction supersedes the earlier agreement to apply oldest-note eviction by default.
- Capture note eviction is configurable. If enabled, use a separate Hold Number allowance for capture auditioning and release the oldest sounding capture notes above that allowance without removing their draft selections. Capture auditioning must not evict notes from the pre-existing performance.
- Selecting a pitch into the capture draft strikes it again for auditioning even if that pitch is already sounding in the pre-existing performance, including under Sustain or Drone. This capture-specific attack does not remove the pre-existing reason for retaining the pitch.
- Leaving pitch collection, either to open the naming dialog or to cancel, immediately releases the capture audition notes without waiting for a metronome tick. This release applies to capture audition notes, not to notes still retained by the pre-existing performance.
- Releasing a MIDI key does not remove its selected pitch. Notes can be accumulated sequentially.
- Selecting the exact same pitch again toggles it off, for both mouse and MIDI selection.
- The first selected pitch establishes the chord anchor or mode root. Removing that pitch does not change this reference. The earlier proposal to promote the earliest remaining selection was corrected and is superseded.
- Removing every selected pitch and then adding pitches again within the same capture operation preserves the original anchor/root. For example, select C4, clear the collection, then select E4: the reference remains C4.
- Collection tracks exact pitches: C4 and C5 are separate selections, including during Make Mode. Selecting C5 after C4 does not toggle C4 off.
- Creating a mode combines octave-equivalent selected pitches into one pitch class. Chords preserve the selected octave spacing.
- The resulting structure can therefore retain a reference pitch that is not itself a member of the selected set.
- Escape or Cancel discards the capture draft and restores the previous chord/mode selection without changing existing slots.
- Releasing N or M with no pitches selected ends capture without creating or replacing a pattern and shows “No pitches selected” in the header for five seconds, clear of the grid and clavier. The notice behavior was approved during design review 02; its placement and duration were accepted in design review 03.

### Documents, focus, and background operation

- Behavior configurations belong to instrument documents. Loading a document restores its saved playing behavior and sound choice.
- Opening a different document immediately releases all notes from the previous document, including Sustain and Drone notes, regardless of metronome timing.
- Latched Sustain, Hold, Drone, and Repeat states are not saved or restored. All four controls start inactive in a newly opened document. Turning Drone off on Open was explicitly approved during design review 02. Saved behavior settings are distinct from live latch state.
- Confirming Revert restores the saved instrument settings, immediately releases current notes regardless of tick timing, and clears live Sustain, Hold, Drone, and Repeat states. This reset behavior was approved during design review 02.
- Ordinary focus loss does not itself release sounding notes or reset the performance.
- Continuing the metronome, Repeat, and active notes while hidden or minimized is preferred, but optional if implementation or reliability is prohibitive. It is not a browser acceptance blocker.
- If background continuation is not supported, define a clean pause/resume policy separately. Do not silently interpret this optional fallback as permission to release notes on every ordinary focus change.
- On return, show the current musical state without replaying missed visual frames.

## Manual feature inventory still required for complete fidelity

These features are in scope from the manual. Their presence in this inventory does not mean every interaction or edge case has been settled.

| Area | Manual baseline | Printed pages |
| --- | --- | --- |
| Musical transformation | Transpose the current interval set by the lead pitch, intersect with mode transposed by scale root, and play the result. Preserve separate pitch, pitch-class, and octave concepts. | 13-16 |
| Grid | Independently adjustable horizontal and vertical intervals, each 1-12 semitones; set/cancel axis changes; repeated occurrences of pitches; pitch and octave labels. | 14-18 |
| Auto Button | Movement alone plays; clicking sets scale root. Preserve its distinct interaction with Smooth Clavier. | 17-18, 27-28 |
| Chord/mode selection | Slots 0-9, radio controls, shift/caps XOR selection behavior, and visible active selection/control target. Slot 1 remains Solo/Chromatic. | 19-20, 23-26 |
| Root setting | Tab sets root from the played pitch; Auto Button and MIDI Sets Root provide other routes. | 21, 33 |
| Performance keys | Space Sustain; F sustain latch; G Hold; Y Drone; D Repeat; Command latches applicable momentary commands; visible control states. | 19, 21-23 |
| Creation and copy/paste | N Make Chord and M Make Mode, collection and cancellation, naming/slot assignment, protected slot 1, chord/mode copy-paste restrictions. Manual prose contains some inconsistent key descriptions; reconcile with its main creation section. | 23-26 |
| Clavier | Show/hide, linked pitch highlighting, configurable register, ordinary mouse playing, Smooth Clavier with equal spacing for the selected scale tones and hidden cursor during its drag. | 26-28, 31 |
| Metronome | On/off T; pulse indication continues when quantization is off; Q/W/E/R rate factors 1/2, 2, 2/3, 3/2; momentary and latched changes; tick-boundary transitions; A/S incremental rate changes. | 29-30 |
| Settings | Hold Number, MIDI maximum pitch, grid low octave, clavier low octave. Preserve musical purpose while explicitly deciding changes to historical limits. | 31 |
| MIDI | Actual-pitch and octave-equivalent pitch-class visualization, Play Chords, Mouse Solo, Sets Root, Thru, and separately selected mouse/generated MIDI routing channels as specified. | 32-34, 70 |
| Documents | Open, Save, Save As, Revert, settings restoration, and unsaved-change handling. Apply the confirmed exceptions for live latch states. | 34, 80 |
| Help and examples | Performance help, chord/mode reference shapes, and the supplied learning and instrument examples. | 1-12, 37-83 |

Example inventory includes Try Me and its internal-sound version, Blues, Minor Classic, Major and Minor modes, Minor modes, Church Modes and gray-code ordering, Unstable Modes, World Music modes, Generic Chords 4x3, Counterpoint, Harmonic Minor 4x3, Circle of 5ths 5x7, PitchClass x Octave 1x12, and 10th Voicings. The manual does not contain every original preset value. Reconstruct what is supported by evidence and mark missing values; do not claim recovery of the exact original library.

## Agreed modern direction

### Browser feasibility

- Browser delivery is preferred, conditional on foreground musical and visual performance being satisfactory.
- Proposed evaluation architecture: a dedicated Canvas grid/clavier renderer, potentially using OffscreenCanvas in a worker; AudioWorklet for musical processing; minimal input handlers.
- This is a proposed foundation, not a final library selection or a verified performance guarantee. Canvas 2D versus WebGL should be decided from measurements of the actual scene.
- Rendering must present the latest eligible musical state without a growing queue of obsolete frames. Metronome-on behavior must still wait for the committed tick state.
- Evaluate internal audio and external MIDI independently, including original keyboard combinations, sustained sessions, rapid dragging, events near tick boundaries, and simultaneous performance controls.
- A stable metronome alone does not establish responsive gesture handling or a playable interface. Acceptance includes Ethan playing the instrument.
- Rendered design prototypes establish layout and visual behavior, not audio latency or browser feasibility. Both design review and subsequent live performance evaluation are required.
- The subsequent implementation now provides an initial playable prototype and software/browser checks; see [the evaluation report](feasibility-report.md). This does not establish full-product parity or physical real-time performance.

### Built-in sound

- Provide a curated palette through a SoundFont engine and a simple synthesized tone available without waiting for an instrument bank to load.
- Include both naturally decaying and continuously sustained sounds.
- Proposed palette: electric piano, piano, organ, and a mallet/pluck sound. Actual banks, assets, default timbre, and distribution rights are not selected yet.
- Save the selected sound with each instrument document.
- Separate musical Hold Number from sound-engine voice capacity. Release tails and retriggered attacks may require additional sound-engine voices.
- Retaining a note does not imply a constant acoustic amplitude: a piano may decay while an organ continues.

### Configurable musical variations

Ethan explicitly wants many behavioral decisions exposed as configuration because alternatives can produce interesting musical results. Document settings must restore the chosen behavior. Defaults follow the clarified original behavior except where a new behavior was explicitly chosen.

Confirmed configurable items include mouse velocity, single versus multiple independent MIDI chord triggers, and capture note eviction (off by default, with a separate capture allowance when enabled). Additional candidates include shared-pitch retriggering, Repeat interaction with retention controls, held-note handling across scale changes, short-input handling, and hold-limit eviction. Exact alternatives and combinations remain to be designed; candidate status is not approval of every possible variation.

Ethan explicitly requested a future control for Repeat reattacking Drone-held pitches. The default remains no drone reattack. Save the chosen behavior with the instrument document. The enabled behavior's scope—only drone pitches in the current chord, or all captured drone pitches—remains to be designed; neither alternative was selected in the clarification. Render and review this control before implementing its interface.

## Acceptance witnesses to develop

These are required observable scenarios, not tests already implemented or passed. Use explicit document settings and controlled tick times.

| Scenario | Expected observation |
| --- | --- |
| Drag across several cells between ticks | Only the current position determines the tick's chord; complete played/filtered shape updates with the musical event. |
| Stationary pointer, unchanged chord | No retrigger without Repeat. |
| Stationary pointer, chord selection changes | New chord sounds and renders on the next tick. |
| Short mouse click or short MIDI trigger | Chord begins at the next tick and lasts one full tick absent retaining controls. |
| Ordinary chord change with shared pitches | Shared pitches receive new attacks when Sustain and Drone are off. |
| Sustain across overlapping chords | Shared pitches continue; new pitches accumulate; release preserves the active chord. |
| Sustain exceeds Hold Number | Oldest individual notes are released, not whole chord groups. |
| Hold across mouse release and replacement | Chord persists, then replacement strikes all its notes again. |
| Repeat with Sustain and Drone | Sustain-held current-chord pitches retrigger; Drone-held pitches continue. |
| Change scale while retaining notes | Sustain/Drone notes survive even outside the new scale. |
| MIDI Thru plus Play Chords | Original MIDI messages forward immediately; generated events and input visualization follow ticks. |
| MIDI C held, E pressed, E released | Default generated chord returns to C; Sets Root returns to C if enabled. Final release leaves root C. |
| Mouse/MIDI shared pitch | Mouse can retrigger it; release of one source preserves it while the other still requires it. |
| Capture C4 then C5 | Two exact selected pitches; mode creation folds them into one pitch class. |
| Remove first selected capture pitch | Reference remains at the removed pitch; no automatic promotion. |
| Clear and refill the same capture collection | Original anchor/root remains fixed, even across an empty selection. |
| Select an already-sounding pitch into capture | Strike it again for auditioning, including when held by Sustain or Drone; preserve its pre-existing retention. |
| Capture selection exceeds Hold Number, default configuration | All selected capture notes continue sustaining; no eviction and no loss of draft selections. |
| Optional capture eviction enabled | Release the oldest sounding capture notes above the separate capture allowance; retain draft selections and do not evict pre-existing performance notes. |
| Hold N → press M → release N → release M | Switch to mode capture on M; continue after N release; finish mode collection on M release. |
| Switch Make Chord ↔ Make Mode during capture | Preserve exact selected pitches and the fixed reference; do not fold away octave-separated selections on switching. |
| Enter a new capture while notes are sounding | Start with an empty draft; pre-existing notes, including Sustain and Drone notes, continue underneath capture without being automatically selected. |
| Leave pitch collection for naming or cancellation | Immediately release capture audition notes, without waiting for a tick. |
| Escape or Cancel during capture | Discard the draft, restore the previous chord/mode selection, and leave existing slots unchanged. |
| Release N or M with an empty collection | Capture ends; no pattern is created or replaced; show “No pitches selected” in the header for five seconds without covering the grid or clavier. |
| Open another document during Drone/Sustain | Old sound ends immediately; saved configuration loads; Sustain/Hold/Repeat latches start inactive. |
| Foreground playing under realistic load | Responsive input, steady rhythm, accurate visual state, no stuck notes, and acceptable measured latency and stalls. Thresholds remain open. |

The generic major/minor chord example is also a musical fidelity witness: in C major, its perfect fifth disappears on B. Do not replace filtering with automatic chord correction. See manual pages 71-72.

## Open requirements

Status clarification after slot-editor acceptance: the [feature-gap audit](feature-gap-audit.md) is the current implementation gap index. Multiple-short-input handling, event ordering, Sustain age/accounting, and numerical performance targets have adopted experiment policies in [feasibility decisions](feasibility-decisions.md); their entries below describe remaining full-product decisions or missing measurements, not an absence of any working policy.

- Measured latency, visual-alignment, frame-stall, MIDI-jitter, and session-duration acceptance thresholds; supported browser/hardware matrix.
- Multiple events inside a tick: several short clicks, successive short MIDI triggers, movement after a short click, and order of simultaneous control changes.
- Hold-limit accounting across live, Sustain, and Drone notes; whether reuse of a sustained pitch changes its eviction age; behavior when the limit is reduced while playing.
- Complete precedence rules for combined controls and for both mouse/MIDI sources. Preserve confirmed examples without extrapolating unconfirmed symmetry.
- MIDI multi-trigger mode root arbitration, repeated note-on handling, channel-sensitive trigger identity, and remaining controller-message behavior.
- Exact commitment timing for MIDI visualization relative to raw inputs versus generated output, including short inputs and multiple inputs within a tick. The confirmed requirement is tick-aligned, not immediate.
- Capture key sequences beyond the confirmed N → M handoff, including reversed release order and repeated switching. The confirmed capture draft, auditioning, retention, and cancellation decisions are recorded above; the revised controls and selected-versus-sounding visualization are accepted in design review 03.
- Behavior when loading documents while physical keys/buttons remain held; device disconnects; recovery from lost input releases without violating the no-release-on-ordinary-focus-loss requirement.
- Exact background pause/resume fallback if continued hidden playback is not reliable.
- Complete preset reconstruction and any changes to historical numeric limits, naming limits, file formats, and sound choices.

Do not silently fill these gaps during implementation. Resolve musically significant choices with Ethan, and distinguish new decisions from recollection.

## Slot editing and copy/paste implementation contract

The implemented editor is documented in [slot editing](slot-implementation.md). Manual section 4.10 (printed p26, PDF p30) confirms C/V with optional Command, current-slot source/destination, Shift XOR Caps Lock mode targeting, same-type-only paste, no paste before copy, and protected slot 1. Direct interval editing and staged Apply/Cancel are modern additions to the accepted authoring design. Chord intervals retain exact relative offsets; direct mode editing accepts only 0–11 and does not silently fold invalid values. Explicit selected-slot identity persists even when slots contain identical patterns.

Manual routing clarification from the audit: printed pp33–34 specifies that Thru Channel applies to both forwarded MIDI and MIDI-generated chords, while Mouse Channel controls other generated output. The current raw-byte Thru path differs; immediate Thru timing remains confirmed, but channel-remapping behavior needs an explicit decision before the routing slice.

## Grid and register acceptance — 2026-09-06

Ethan accepted the grid/register prototype, then confirmed: applying a layout waits for the next gesture before playing a newly mapped pitch; lowering the ceiling preserves already-retained notes; capture follows the configured layout and range; incoming MIDI and Thru remain unaffected by the ceiling. The [implementation report](grid-settings-implementation.md) records exact register values, migration, pointer/capture behavior, and verification. All independent 1–12 axis pairs are now implemented. Historical inventory/open-item entries above are not claims that these controls remain absent.


## Autonomous completion decisions — 2026-09-06

Ethan explicitly authorized implementing all remaining items without further check-ins, with review afterward. This supersedes the earlier instruction to pause for unresolved musical-policy answers and per-slice prototype approval. Render-before-implementation remained in force. The [review guide](review-guide.md) is the current implementation and policy index: performance values/routing, independent MIDI arbitration, Repeat/Drone alternatives, optional Sustain reattack/age/eviction/scale retention, short-input policy, separate capture allowance, sampled sounds, existing-slot recollection, help, examples, and recovery/telemetry are implemented. Older “future/unresolved” descriptions above retain the original evidence chronology; use the guide for the selected modern policies and remaining measurement/reference limits.
