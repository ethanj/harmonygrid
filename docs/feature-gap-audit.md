# Feature-gap audit after slot-editor acceptance

> Current status, 2026-09-06: the autonomous completion pass implemented the remaining software slices. See the [review guide](review-guide.md) for current behavior, evidence, and outstanding physical/legacy verification. This document's earlier status is historical.


Audit date: 2026-09-05, local project time. Ethan approved the live slot editor before requesting this audit. Recommendation: render **full grid-layout and register settings** next, then implement that bounded slice after review. The current instrument has an accepted playing, capture, editing, and file workflow; it does not yet provide the complete original instrument or the agreed modern sound/configuration features.

Update 2026-09-06: the recommended grid/register slice is now implemented following design and behavior acceptance. See [implementation and verification](grid-settings-implementation.md). The table below preserves the audit baseline before that work.

## Evidence and limits

This is a source and requirements audit, not a new playing test or an exhaustive original-application comparison. Sources are the [manual](harmonygrid.pdf), [recorded requirements](requirements.md), [experiment decisions](feasibility-decisions.md), implementation reports, source, and test definitions. The manual inventory already recorded in the requirements covers the broader guide. This audit additionally inspected the complete reference pages 17–18 and 31–34 directly from the PDF, particularly axis editing, numeric settings, MIDI channels, and document persistence. Printed page numbers are four less than PDF page numbers. Supporting renders are under `audit/reference/`.

The preceding implementation run recorded 111 passing tests, a successful production build, 30 slot browser checks, 29 document browser checks, and 37 capture browser checks. Their scope is recorded in [slot implementation](slot-implementation.md). Those checks were not rerun for this documentation audit. Historical feasibility measurements remain historical; new source inspection does not certify latency, endurance, physical MIDI, or full parity.

Later explicit user corrections govern over manual descriptions. In particular: Sustain evicts individual notes; capture starts with Auto Button off and no audition eviction; Drone-held notes do not reattack under Repeat by default; opening/reverting releases notes and clears live latches. Do not undo these decisions while pursuing manual coverage.

## Coverage map

“Implemented” means a production path exists for the stated scope, not that every combination or hardware condition has been verified.

| Area | Current coverage and evidence | Remaining gap |
| --- | --- | --- |
| Chord transformation and full shape | `src/performance/harmony.ts`, `src/performance/engine.ts`, and `src/render/draw.ts` transpose/filter the chord and render played, filtered, sounding, and retained pitches. Core musical witnesses exist in `tests/performance/engine.test.ts`. | Broader combined-control and cross-source precedence still needs explicit coverage; no exact original-program comparison is available. |
| Tick-based playing | Engine implements latest pointer sampling, tick-aligned playing, ordinary release, one-full-tick short inputs, and stationary replacement. Pulse continues when quantization is off. | Physical gesture cutoff and audio/display skew are unverified. Some policy questions are settled for the experiment only, rather than absent implementation. |
| Sustain, Hold, Drone, Repeat | Implemented with individual Sustain eviction, shared ownership, and no default Drone reattack. Existing tests cover the main recorded examples. | Musical variations are not exposed. Reducing a limit while playing and exhaustive mixed-control transitions need requirements/acceptance work. |
| Normal and Smooth Clavier | Show/hide, normal input, equal scale-tone hit regions, hidden drag cursor, and linked highlighting exist; Ethan accepted the playing check. | Register is fixed. Capture has its own fixed grid range. Configurable registers must reach both rendering and hit testing, including fallback rendering. |
| Grid geometry | Only 4×3, 2×1, and 2×3 choices exist in `src/view.ts`; `src/document/model.ts` also rejects other axis pairs. | Manual p18 requires independent 1–12 semitone axes with Set/Cancel. 5×7 and 1×12 example layouts cannot currently be selected or loaded. |
| Grid/clavier register and maximum pitch | `src/app.ts` fixes normal grid base to MIDI 24, capture grid base to 36, and clavier endpoints to 48–84. | Manual p31's Grid Low Octave, Clavier Low Octave, and MIDI Max Pitch are absent from UI and document schema. MIDI Max Pitch is a playable-surface ceiling, not merely a MIDI input filter. |
| Hold Number and mouse velocity | Both exist in engine settings and saved files, with defaults 32 and 96. The capture panel displays Hold Number only when its limit is enabled. | Neither value has an ordinary editing control. An engine/file field is not a complete usable feature. |
| Capture and authoring | Mouse/MIDI capture, reference preservation, exact-pitch toggling, mode folding, naming, slot protection, and cancellation exist. Capture selection and audition are separate. | Existing saved slots cannot return directly to pitch collection; the slot editor edits intervals. New-capture naming does support returning to its own pitch draft. These are different capabilities. |
| Capture allowance | Default-off checkbox exists and persists. A separate audition pool uses the same numeric Hold Number value as the performance pool. | There is no independently adjustable capture allowance value. The recorded “separate allowance” guarantees separate accounting; whether it should also have its own number needs a decision, not an assumed defect. |
| Slot editing/copy-paste | Staged names/intervals, typed clipboard, original C/V modifier targeting, protected slot 1, and duplicate-slot identity are implemented and user-approved. | Original-shaped pitch recollection for existing slots remains a modern authoring enhancement. Pattern clipboard persistence is session-local, as documented. |
| Keyboard target feedback | Shift XOR Caps Lock governs digit selection and playing C/V. | `selection-target` in `src/view.ts` is static hint text; no live Chord/Mode target indicator updates when modifiers change. The manual help diagram explicitly shows target highlighting. |
| MIDI generation | Last-held priority/fallback, velocity inheritance, Sets Root, Mouse Solo, separate note ownership, and generated output exist. | Optional multi-trigger chords are absent. Root arbitration and shared-note attacks for that mode remain undecided. |
| MIDI visualization | Actual-pitch and pitch-class grid marks, clavier input marks, and committed snapshots exist. | Precise visualization of short notes ending between ticks remains a requirements edge case: held-input snapshots and the remembered generated trigger are separate. Do not assume their visible lifetimes are identical. |
| MIDI routing | Port selection, immediate Thru, and internal/generated output paths exist. Mouse/generated channels are serialized. | No channel-editing UI; raw Thru does not follow the manual's selected Thru Channel. See the routing finding below. Physical ports and loopback timing are still unverified. |
| Documents | Open/Save/Save As/Revert/New, validation, changes list, failure handling, duplicate selection, and reset semantics exist and are accepted. | Future settings need migration/defaults. Legacy binary import is absent; supporting modern files does not recover the original document library. |
| Sound | `src/audio/voices.ts` provides Organ/Pluck oscillator tones with 128 synthesis voices. | Curated SoundFont engine, piano/electric piano/banks, loading/failure experience, assets and distribution rights remain unimplemented. Logical no-eviction does not guarantee unlimited synthesis capacity. |
| Output choice | Internal audio starts before MIDI connection; both can sound. | No explicit external-MIDI-only/internal mute selector; original internal/MIDI choices and the intended modern combination should be designed deliberately. |
| Help and examples | Controls have short inline hints; synthetic chord/mode fixtures exist. | No in-app performance help, guided examples, original reference-shape library, or supported reconstruction catalog. `src/fixtures/instruments.ts` is not the original supplied document collection. |
| Focus/recovery/background | Ordinary blur does not panic; deliberate panic, audio-fault restart, pointer resynchronization, and some device-disconnect handling exist. | Missed keyboard releases, physical held inputs across document changes, hidden/resume behavior, and broader device transitions need targeted review. Hidden continuation is optional; foreground responsiveness is mandatory. |
| Real-time acceptance | Worklet processing, bounded renderer presentation, finite audio checks, headless profiles, and accepted hands-on playing are established for their recorded scope. | Three scored 20-minute workloads, physical input/audio/display measurements, and external MIDI remain outstanding. The trace currently stops recording at 20,000 rows (`src/diagnostics/trace.ts`), so endurance evidence needs appropriate collection first. |

## Substantive routing discrepancy

Manual pp33–34 defines a **Mouse Channel** and a **Thru Channel**, displayed as channels 1–16. The Thru Channel applies both to ordinary forwarded MIDI and to chords generated from MIDI input. Mouse Channel applies to the other generated output.

The current implementation has zero-based `mouseChannel` and `midiChannel` settings for generated notes, but `MidiRouter.receive()` in `src/input/midi.ts` sends original bytes directly when Thru is enabled. Changing `midiChannel` therefore changes generated chords without changing forwarded messages. The current MIDI tests deliberately verify raw-byte preservation. This is a genuine difference from the manual baseline, not just a missing dropdown.

The confirmed decision that Thru is **immediate** does not by itself choose whether channel numbers are preserved. Keep that timing decision. Before changing routing, explicitly choose the default and document migration: manual-style shared Thru/generated channel, incoming-channel preservation as an optional variation, or separately configurable modern routes. Handle channel-voice messages consistently; system messages have no channel nibble to remap. Do not infer controller/program-change processing for generated notes from raw forwarding.

## Recommended sequence

| Order | Bounded slice | Why and completion criterion |
| --- | --- | --- |
| 1 | Full grid layout and register settings | Unlocks the original instrument's pitch organization and named 5×7/1×12 layouts. Render independent axes, register/ceiling controls, and Apply/Cancel before code. Finish when saved geometry, displayed notes, hit testing, and audio agree at normal and extreme settings. |
| 2 | Performance values and routing | Expose Hold Number and mouse velocity, resolve Mouse/Thru channel semantics, provide channel controls and clear output choice. Preserve note ownership when routes change and save all chosen behavior. |
| 3 | Sound palette | Add the agreed curated sounds and immediate fallback with real-time loading/voice-budget checks. This is a major part of being a satisfying instrument, not a cosmetic replacement of the current tone labels. |
| 4 | Musical variations | Begin with the explicitly requested Repeat/Drone option and multi-trigger MIDI; settle the few dependent musical choices first. Keep confirmed defaults unchanged. Other candidate variations are not blanket-approved specifications. |
| 5 | Help, examples, and authoring extensions | Add contextual key help and target feedback, evidence-backed example instruments, and existing-slot pitch recollection if retained in scope. Label reconstructed versus unknown original values. |

Real-time acceptance runs alongside these slices: short regression playing after each change; physical MIDI checks when routing changes; new audio/endurance measurements when the sound engine changes. It must not become a final cosmetic checklist after all features are added. Optional hidden continuation and legacy import should not delay resolving foreground playability.

## Next slice: design brief, not an implementation authorization

Render one coherent **Grid & register** settings surface using the accepted visual language, with independently editable horizontal/vertical intervals, Grid Low Octave, Clavier Low Octave, MIDI Max Pitch, and explicit Apply/Cancel. Preserve current defaults when opening existing version 1 files. Show the familiar 4×3 configuration and the newly supported 5×7 and 1×12 layouts in the design review.

Resolve these behavior details with the design, before dependent code:

- **Register labels:** the current code names MIDI 24 as C1 and MIDI 48 as C3. The manual calls its grid reference a MIDI octave number and shows 2. Do not silently equate historical octave numbers with today's labels. Show an explicit note/MIDI value or otherwise remove ambiguity. The manual's stated ranges are grid 0–9 and clavier 0–4; retaining or extending those ranges is a deliberate choice.
- **Maximum pitch:** p31 describes the highest pitch playable on grid/clavier. Settle treatment of chord members above it, capture selections, and any previously retained notes when the ceiling is lowered. Incoming MIDI and Thru must not accidentally acquire an unapproved ceiling.
- **Applying geometry during playing:** define when the mapping changes, what happens with a physically held pointer, and how metronome-on presentation stays coherent. The manual confirms Set/Cancel, but does not settle every modern modal/gesture boundary.
- **Capture mapping:** decide whether collection uses the configured register or preserves a separate capture register. Current fixed capture base must not silently override an apparently global control.

Required witnesses for that slice:

1. All 144 axis combinations are representable; 5×7 and 1×12 save/reload correctly. Cancel leaves geometry and sound unchanged.
2. For both renderer paths, clicking each displayed pitch uses the same register/axis mapping. Smooth Clavier uses the selected register and mode.
3. Repeated occurrences of a pitch agree visually; out-of-range cells are visibly unavailable and cannot emit invalid notes.
4. Applying, canceling, opening, and reverting settings follow the chosen retained-note and held-pointer policy without stuck notes.
5. Old files retain their prior layout; new settings round-trip and appear in unsaved-change summaries.
6. Small/large viewport renders retain usable targets; representative rapid dragging and tick-aligned playing remain responsive.

## Requirements reconciliation

Several older documents mix historical scope with current status. This audit is the current planning index after slot acceptance; previous reports remain evidence for their own builds.

- Multiple short inputs, event ordering, and Sustain age/accounting already have documented **experiment policies** in `feasibility-decisions.md`; do not ask Ethan to restate them as though no decision exists. Full-product alternatives remain separate.
- Numerical performance targets were adopted for the experiment. Missing measurements must not be described as missing targets; final supported hardware/browser scope still needs evidence.
- Capture, document workflow, and the slot editor have now been accepted by Ethan. Automated native-picker coverage and physical audio/MIDI measurements remain distinct from that acceptance.
- Neither a passed feature test nor a reviewed interface establishes complete original-instrument parity. Keep manual gaps, intentional modern differences, and unverified performance evidence separate.

## Audit verification

Only documentation and manual reference renders changed. Verified local links, source references, recorded report counts, and repository status. No code, dependencies, or executable configuration changed; no code tests, build, lint, or typecheck were run for this audit. The checkout remains on `feat/playable-foundation` with the pre-existing untracked project files preserved; no commit or push was made.
