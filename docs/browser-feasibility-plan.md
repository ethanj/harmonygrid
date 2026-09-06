# Harmony Grid Browser Feasibility Implementation Plan

> **For agentic workers:** Ethan has authorized implementation and explicitly instructed not to use Superpowers. Follow the project requirements, accepted design, and experiment decisions. Track actual evidence and unfinished gates in the execution record; do not treat visual or software-test acceptance as physical performance acceptance.

**Goal:** Determine whether a browser can deliver Harmony Grid's complete core playing experience with sufficiently responsive rendering, sound, and MIDI to justify full implementation.

**Architecture:** A deterministic performance engine owns musical events and note lifetimes. An AudioWorklet runs the engine and simple synthesis against the audio timeline; a dedicated Canvas renderer presents committed musical state. Browser input and MIDI adapters remain small, explicitly measured parts of the performance path.

**Tech stack proposed for this experiment:** TypeScript, Vite, Vitest, Canvas 2D, an OffscreenCanvas rendering worker, AudioWorklet, and Web MIDI. Start with message-based communication; change transport or renderer only if measurements identify a bottleneck. No SoundFont dependency is required for the first timing experiment.

**Spec:** [Harmony Grid requirements](requirements.md), with [the original manual](harmonygrid.pdf) as supporting evidence.

**Status:** Playable foundation implemented, 2026-09-05. The accepted [design](prototypes/design-review.md) now has a live engine/audio/rendering implementation. Experiment defaults and targets were subsequently authorized; see [decisions](feasibility-decisions.md). Software checks and headless profiling are recorded in the [feasibility report](feasibility-report.md). Ethan has completed and accepted the hands-on playing checklist. Physical timing, MIDI loopback, and scored sustained sessions remain pending.

## Global constraints

- The delivery target remains complete Harmony Grid. This experiment covers the foundation, not full feature parity.
- Preserve mouse plus computer keyboard performance and the original screen arrangement.
- Render the whole chord, including filtered notes, plus notes retained from earlier events.
- With the metronome on, commit sound and chord visualization at ticks. Do not add a continuous chord preview by default.
- The latest mouse position wins; short clicks retain their separate one-tick play request.
- Preserve confirmed attack, Sustain, Hold, Drone, Repeat, MIDI priority, and cross-source note-release behavior.
- MIDI Thru is immediate. Generated MIDI chords and incoming MIDI visualization are tick-aligned when the metronome is on.
- Ordinary focus loss must not itself release notes. Continued hidden/minimized operation is optional.
- Automated correctness checks and Ethan's playing evaluation are both necessary.
- Render and review visual prototypes before implementing the corresponding application interface. Review the complete playing states, not only an idle-screen mockup.
- Store this plan, decisions, reports, raw measurements, screenshots, recordings, and other supporting artifacts under `docs/`. Future source-file paths below describe application code, not additional documents to create in this planning task.
- The earlier documentation-only restriction ended when Ethan requested implementation. Dependencies and source changes are now authorized. Preserve the supplied PDF, accepted renders, and unrelated work; do not commit, push, or publish without a corresponding request.

## Design gate before application implementation

The first execution deliverable is a rendered design prototype. It must show how the original playing technique and layout work on a modern display. Keep design artifacts under `docs/prototypes/`; do not scaffold the production application to obtain a mockup.

Create one coherent design grounded in the manual's arrangement. Use static HTML/CSS/SVG or another appropriate mockup tool, render it in a browser, and inspect the resulting screenshots. A small scripted animation may illustrate state transitions, but must be labeled as a simulation rather than measured live performance. No sound-engine or application implementation is needed for this design review.

| Prototype artifact | Required visible state |
| --- | --- |
| `docs/prototypes/01-playing-surface.png` | Chords above, modes/status left, grid center, clavier below; readable labels, root, scale, selected chord, and performance controls |
| `docs/prototypes/02-filtered-chord.png` | Entire generic chord, showing sounding and filtered members, with corresponding clavier feedback; include the missing-fifth-on-B witness |
| `docs/prototypes/03-retained-notes.png` | Current chord plus earlier Sustain/Drone notes, including notes outside a changed scale; sounding notes share one treatment, and control indicators identify active modes |
| `docs/prototypes/04-tick-transition.png` | A labeled before/between/after storyboard: pointer moves between ticks while the chord display waits, then sound-indicating state and full chord visualization change at the tick |
| `docs/prototypes/05-midi-and-controls.png` | Actual MIDI pitches and octave-equivalent highlights, simultaneous mouse melody/accompaniment, and active keyboard-control feedback |
| `docs/prototypes/design-review.md` | Source mockup file paths, display dimensions, visual legend, acceptance notes, revisions, and which design states Ethan has accepted |

Preserve editable mockup source alongside the renders. Show both 2x1 and 4x3 grids across the prototype set and render at the initial 1280x800 CSS-pixel viewport plus the target Mac viewport once recorded. Avoid presenting alternative layout arrangements unless a concrete problem with the original arrangement requires discussion.

Review readability, cell targeting, chord-shape recognition, distinction between scale and sound, keyboard discoverability, and space allocated to the clavier. The tick storyboard must not introduce an unapproved chord preview. Do not distinguish sustained/drone pitches by colors that contradict the agreed common sounding-note appearance.

Ethan's review of the rendered states precedes implementing their application interface. Apply corrections to the editable prototype, re-render, and retain the accepted revision. If live testing later exposes a design problem, update and re-render the affected design before implementing that UI revision. Visual acceptance does not replace the subsequent real-time performance gate.

## 1. Scope of the experiment

Build one recognizable instrument screen with chord buttons above, mode buttons and performance status to the left, a labeled grid in the center, and clavier below. Include 2x1, 2x3, and 4x3 layouts; scale-root selection; Auto Button; normal and Smooth Clavier playing; shift/caps selection behavior; the original performance keys; and momentary/latching tempo controls.

Use synthetic, clearly labeled fixtures rather than claim recovery of original documents:

| Fixture | Content | Purpose |
| --- | --- | --- |
| Solo | Chord offsets `[0]`; Chromatic and Major modes | Direct responsiveness and scale filtering |
| Generic triad | Chord offsets `[0, 3, 4, 7]`; Major mode `[0, 2, 4, 5, 7, 9, 11]` | Full played/filtered shape, including missing fifth on degree 7 |
| Extended chord | Offsets `[0, 4, 7, 10, 14, 17, 21]`; Chromatic and Major modes | Larger shapes, octave spacing, multiple simultaneous voices |

Exercise all confirmed retention controls, default MIDI last-note priority and fallback, Sets Root, Mouse Solo, Thru, and shared-pitch source ownership. Include changing between fixture documents to witness immediate release and inactive Sustain/Hold/Repeat latches. Include raw pitch collection and fixed-reference behavior as engine tests; the polished authoring dialogs are outside this experiment.

Later full-product work still includes complete authoring/copy-paste UI, document persistence and migration, all configurable variations, MIDI multi-trigger mode, the curated sound palette, help, and example reconstruction. A pass here does not certify those features or the final SoundFont engine's performance. Re-run the relevant performance gates when the sound engine or workload changes materially.

## 2. Decisions to settle together before dependent implementation

Review the following experimental policies as one batch. They fill gaps only for this experiment and must be recorded as new decisions if accepted. Independent grid mathematics, manual-derived fixtures, and measurement scaffolding can proceed while a policy remains open; dependent behavior cannot silently assume approval.

| Gap | Proposed experiment policy |
| --- | --- |
| Several mouse clicks inside one interval | Coalesce to one play request; use the latest position at the tick, including movement after button release. Preserve one full tick of duration. |
| Several short MIDI notes inside one interval | In default single-trigger mode, an actually held note wins; otherwise the most recently pressed short note supplies one one-tick chord. No burst replay at the tick. |
| Simultaneous controls | Preserve timestamp/sequence order within each input source, use a monotonic receipt sequence to break cross-source ties, and apply pending control/root/mode changes before deriving that tick's chord. Do not collapse key transitions as if they were pointer moves. |
| Held-note accounting | Track current mouse, current MIDI, Sustain, and Drone obligations separately per output channel/pitch. A source release cannot cut another source's obligation; an explicitly required attack may retrigger the pitch. Drone prevents retrigger while it owns the pitch. |
| Sustain limit | For this experiment, apply Hold Number to distinct Sustain-retained pitches, evict by first retention time, and do not refresh age on reuse. Other live/Drone obligations protect the sounding pitch after its Sustain obligation is evicted. |
| Lost physical release after focus change | Never panic on ordinary blur. Provide a deliberate All Notes Off control and resynchronize observable input on return. Report any stuck momentary input; do not hide it by automatically releasing everything. Final recovery behavior requires an explicit decision. |
| Hardware scope | First evaluate desktop Chrome on Ethan's Mac with wired/internal audio. Record exact versions, display refresh, pointer/keyboard, output device, and MIDI setup. This does not establish Safari, mobile, or all-browser support. |

Also accept or revise the target table below before using it to judge results. Threshold changes must be recorded before the corresponding scored run, not retroactively to convert a failure into a pass.

## 3. Measurement and proposed acceptance criteria

### Distinguish the clocks and the evidence

Give each input and committed event an ID. Record input timestamp, handler receipt, engine receipt, assigned tick, target audio sample, renderer state receipt, and draw submission. Use preallocated bounded telemetry storage; count overflows and export after playing. Do not log each event to the console or build unbounded arrays in the audio path.

Use a rolling mapping between the audio and performance clocks. `getOutputTimestamp()` relates the audio output position to an estimated performance-clock time; it is useful for scheduling visual presentation, but is not a measurement of photons or an external instrument's sound. [Output timestamp documentation](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp)

Audio rendering occurs ahead of what the listener hears. Measure and report the cutoff: how close to an audible tick a gesture can arrive and still affect that tick. A precisely timed chord with stale input is a responsiveness failure. Never backdate a late-arriving event to pretend that it affected already-rendered audio.

Measure two evidence levels separately:

- **Software traces:** event routing, scheduling, late-input counts, render duration, draw intervals, queue depth, and logical correctness. These expose causes but do not establish physical input-to-sound or input-to-display latency.
- **External observation:** capture electrical/audio loopback for audible timing and use a high-speed recording or instrumented input/display setup for physical response and audiovisual alignment. Include measurement resolution and uncertainty. A screen recording alone does not measure physical input-to-photon latency. If equipment is unavailable, mark the affected gate unverified.

Compare against the same output device's baseline to attribute failures, but report absolute end-to-end latency too. Do not subtract an inconvenient baseline from the acceptance result. Bluetooth audio is outside the initial wired-audio target.

### Target table

These are proposed engineering budgets, not platform guarantees or claims about universal human perception. `F` is the measured active display frame period; for a 60 Hz display it is approximately 16.7 ms. Report p50, p95, p99, maximum, sample count, and missed/dropped events. Use at least 1,000 observations for each scored latency distribution; report smaller physical samples separately rather than claim a meaningful p99.

| Gate | Proposed acceptance target | Evidence |
| --- | --- | --- |
| Confirmed musical semantics | Every in-scope acceptance witness passes; no lost release, wrong source cutoff, or incorrect filtered membership | Deterministic event tests and live witnesses |
| Foreground drag rendering, metronome off | Physical input to changed pixels: p95 <= 2F, p99 <= 3F; no recurring visible stalls in Ethan's session | External capture plus correlated trace |
| Rendering headroom | p99 draw duration <= 4 ms; p99 active draw interval <= 2F; no foreground presentation freeze above 100 ms during normal-load scored runs | Software profiling; external capture for actual presentation |
| Free-playing audio response | Physical input to audible onset: p95 <= 20 ms, p99 <= 30 ms on the initial wired setup | Instrumented input/audio capture |
| Internal pulse accuracy | Engine onset at its intended sample within one sample; measured output interval error p99 <= 2 ms after removing only the fixed initial offset | Engine trace and audio capture |
| Gesture cutoff before audible tick | p95 required lead time <= 20 ms, p99 <= 30 ms; delivered-in-time inputs never disappear or skip an additional tick | Phase sweep, clock mapping, external verification |
| Chord visual/audio alignment | Absolute presentation skew p95 <= F, p99 <= 2F; no intentional early chord preview | External audiovisual capture |
| Generated MIDI scheduling | Delivery relative to the intended tick: absolute error p95 <= 5 ms, p99 <= 10 ms; actual external-instrument onset reported separately | Timestamped MIDI loopback plus device/audio measurements |
| MIDI Thru | No metronome quantization; added routing delay p95 <= 5 ms, p99 <= 10 ms against a direct route through the same setup | MIDI loopback comparison |
| Sustained playing | Three 20-minute foreground runs per scored workload; no stuck notes, audio dropouts, queue/telemetry overflow, or sustained memory growth after warm-up | Traces, recordings, and live session notes |
| Musical usability | Ethan can phrase, change chords and roots, manipulate tempo, and combine retention controls without fighting the interface | Ethan's explicit evaluation |

Engine sample accuracy is not evidence of low end-to-end latency. Draw submission is not evidence that a frame reached the screen. A negative result caused by a slow device is still a failure for that hardware target, even if browser overhead is small.

### Scored workloads and diagnostic overload

Run both a normal scene (16x12 grid, clavier, all labels and status) and an expanded scene (24x16). Show out-of-range cells consistently without generating invalid MIDI pitches. Exercise 32 concurrently sounding distinct pitches, plus release/retrigger tails; this is an experiment workload, not a final product polyphony cap. Use 120, 240, and 480 ticks/minute with half/double/dotted/triplet changes. Test at 60 Hz and the Mac display's higher native refresh if available; only claim configurations actually measured.

For each scene, run rapid real pointer movement, repeated chord/mode changes, and overlapping controls. One run uses the instrument alone; one adds a fixed, recorded moderate background workload; one is Ethan's playing session. Sweep input arrival through tick boundaries in 1 ms increments across a 50 ms window. Synthetic events test scheduling; real devices separately test the input path.

Inject controlled 20 ms and 50 ms main-thread stalls as diagnostic overload runs. Report audio continuity, input age, late events, and renderer behavior. These runs explain failure modes and are not silently mixed into normal-load statistics or used to claim impossible immunity to arbitrary stalls. Hidden-tab continuation is a separate optional experiment.

## 4. Engine, rendering, and MIDI boundaries

| Future source area | Responsibility |
| --- | --- |
| `src/performance/model.ts`, `harmony.ts`, `engine.ts`, `capture.ts` | Typed input/output records, interval filtering, tick decisions, source ownership, and exact-pitch collection; no DOM or audio device access |
| `src/audio/instrument.worklet.ts`, `voices.ts`, `clock.ts` | Sample timeline, bounded voice processing, simple sustained/plucked tone, and audio/performance clock mapping |
| `src/input/pointer.ts`, `keyboard.ts`, `midi.ts` | Small event handlers, original control mapping, input identity, and immediate Thru |
| `src/render/grid.ts`, `clavier.ts`, `renderer.worker.ts` | Cached geometry/labels, dynamic complete chord and held-note overlays, committed-state presentation |
| `src/app.ts`, `src/style.css`, `index.html` | Original screen arrangement, audio start/device controls, fixture selection, explicit All Notes Off |
| `src/diagnostics/trace.ts`, `src/fixtures/instruments.ts` | Bounded measurements and synthetic fixture definitions |
| `tests/performance/*.test.ts`, `tests/render/*.test.ts` | Independent expected event sequences, pitch memberships, control behavior, and visual-state tests |
| `docs/feasibility-decisions.md`, `docs/feasibility-report.md`, `docs/feasibility-runs/` | Accepted experiment decisions, verdict, raw data, captures, environment records, and reproduction instructions |
| `docs/prototypes/` | Editable design mockups, rendered playing-state prototypes, and review record |

The future engine interface should accept typed events with source, sequence, and musical payload, advance through an explicitly supplied sample interval, and emit note actions plus a committed visual snapshot carrying the same event ID and target sample. Tests supply the clock directly. Do not invent browser-dependent behavior inside the harmony functions.

The worklet must not allocate per sample, block on locks, perform DOM work, or rely on an ordinary interface timer for musical time. Support the actual buffer length passed to processing. AudioWorklet processing is called for render blocks; do not equate a block callback with an audible event at the user's current wall-clock time. [AudioWorklet processing](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process)

The renderer uses the newest committed snapshot eligible for presentation at the estimated audible time. Pending future snapshots must not overwrite the currently presentable state. Once late, skip obsolete visual snapshots rather than animate a backlog. Start with OffscreenCanvas transferred to a worker and measure the added communication cost. If unsupported or slower on the target, compare a tightly bounded main-thread Canvas renderer before adding WebGL. [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

Web MIDI is exposed to the window, not directly inside AudioWorklet. Generated output therefore needs an explicitly measured bridge to timestamped `MIDIOutput.send()`. Do not discover a tick only after it has sounded internally and then label an immediate send synchronized MIDI. Determine and measure the minimum scheduling lead for the bridge; score its effect on last-moment input acceptance. Keep immediate Thru separate. Test MIDI-only use while an audio context supplies the clock, even if internal sound is silent. [Web MIDI specification](https://www.w3.org/TR/webmidi/)

## 5. Execution tasks

### Task 0: Render and review the playing interface

**Deliverable:** The five rendered states and editable source specified in the design gate, accepted for translation into the live prototype.

- [x] Reinspect the manual's interface diagrams and the corrected requirements. Annotate the root, scale, current chord, filtered notes, retained sound, and MIDI representations before drawing.
- [x] Create the editable mockup under `docs/prototypes/` with the original spatial arrangement and original performance bindings. Use synthetic fixture pitches from section 1 so the pictures can be checked musically.
- [x] Render all five named states at the declared viewport sizes. Inspect the actual images for clipped labels, unreadable symbols, inconsistent pitch membership, and misleading between-tick changes. Initial renders cover 1280×800 and a 1600×1000 comparison; the actual target Mac viewport remains to be recorded. See [design review 01](prototypes/design-review.md).
- [x] Present the rendered states to Ethan with concise explanations of the behavior each demonstrates. Record requested changes in `docs/prototypes/design-review.md`. All five states reviewed; no visual revisions requested.
- [x] Revise and re-render until the design is accepted. Start application implementation only after this gate; then use the accepted images as Task 3's visual references. Ethan accepted the overall surface as the first playable prototype's baseline on 2026-09-05.

### Task 1: Establish the experiment contract and deterministic witnesses

**Deliverable:** Accepted policy/budget record and failing behavioral witnesses that an implementation can satisfy without browser assumptions.

- [x] Record acceptance or amendments to sections 2-3 in `docs/feasibility-decisions.md`. Preserve the established requirements; label new experimental choices.
- [x] After Task 0's design gate, add the TypeScript/Vite/Vitest scaffolding with exact dependency versions selected and locked at execution time. Define `dev`, `build`, `typecheck`, and `test` scripts; inspect any then-current repository instructions before editing.
- [x] Create model, harmony, and engine test files. Start with explicit expected memberships: generic triad at C in C major plays `[60,64,67]` and filters `[63]`; at B plays `[71,74]` and filters `[75,78]`.
- [x] Express timing witnesses as event tables: at 48 kHz and 120 ticks/minute, boundaries are 24,000 samples apart; a click at sample 1,000 released at 2,000 sounds at 24,000 and releases at 48,000. Movement changes the pending position without adding a queued chord.
- [ ] Add tests for every confirmed in-scope witness from `requirements.md`, including corrections, all source release obligations, and raw capture. Derive expected outputs independently from the manual/conversation; do not use production helpers to construct expected answers.
- [ ] Run `npm test -- --run tests/performance`; require meaningful initial failures, implement the pure engine, and require the exact expected outputs to pass. Review the engine before adding device/UI behavior.

### Task 2: Prove the audio timeline and collect bounded diagnostics

**Deliverable:** An instrument that sounds from its worklet timeline, with traceable event IDs and independently checked onset samples.

- [ ] Implement the worklet, voices, clock adapter, and trace storage using Task 1's engine. Give the tone a short click-free attack and release, with clear onset measurement; provide a separate diagnostic impulse signal for clock tests.
- [ ] Add exact sample-offset tests at several block sizes, including tick boundaries inside blocks; test changing rate without resetting the underlying pulse incorrectly.
- [ ] Add a trace export command that writes downloadable JSON/CSV evidence intended for `docs/feasibility-runs/`. Record drop/overflow counters, browser/hardware metadata, sample rate, buffer characteristics, and clock estimates.
- [ ] Run the engine/audio checks, then inspect a captured live pulse train. Keep software output assertions and measured physical output results separate.

### Task 3: Make the actual grid playable

**Deliverable:** The representative playing surface with complete chord feedback, original control layout, and internal sound.

- [ ] Implement pointer and keyboard adapters, including original command combinations and simultaneous key holds. Use pointer capture where appropriate; verify actual keyboard/browser behavior instead of assuming all shortcuts can be intercepted.
- [ ] Implement normal clavier, Smooth Clavier, and Auto Button according to the manual. Test the original special case that Smooth Clavier requires a click; verify musical distances rather than just visual movement.
- [ ] Implement cached grid/clavier drawing and held/filtered overlays from committed state using the accepted Task 0 renders. All occurrences of the same pitch must agree; distinguish exact-pitch repetition from octave-equivalent MIDI highlighting.
- [ ] Add visual fixtures for generic triad, filtered fifth on B, retained off-scale notes, and actual versus octave-equivalent MIDI pitches. Check screenshots as well as model outputs.
- [ ] Run `npm run typecheck`, `npm test -- --run`, and `npm run build`, then exercise both metronome modes in the real browser using the production build.
- [ ] Measure rendering and input response before extending visual polish. Ethan performs an early playing session; record concrete friction in `docs/feasibility-runs/`, including missed combinations or misleading displays.

### Task 4: Add MIDI to the same musical timeline

**Deliverable:** Real MIDI input/output with measured timing and independently managed mouse/MIDI note ownership.

- [ ] Implement immediate Thru separately from generated chord routing; add tests showing that enabling metronome quantization never delays Thru.
- [x] Implement inherited velocity, default last-note priority, fallback to older held notes, Sets Root restoration, and one-tick short-note behavior. Keep MIDI port/channel identity explicit.
- [x] Test mouse/MIDI shared pitches: a mouse attack can restrike the note, and either source's release cannot terminate the other's obligation. Exercise Sustain and Drone exceptions.
- [ ] Capture actual MIDI loopback while repeating chords, sweeping inputs near ticks, and applying normal UI load. Measure generated output, Thru, and internal/external alignment separately.
- [ ] Mark any unavailable hardware or unmeasured path explicitly unverified. Do not substitute mocked MIDI events for the real output gate.

### Task 5: Run the scored evaluation and make the platform decision

**Deliverable:** A reproducible feasibility report with a limited, evidence-backed verdict.

- [ ] Execute the workload matrix from section 3, save all artifacts under `docs/feasibility-runs/<run-id>/`, and record the exact commit, browser version, hardware, settings, audio route, and workload for every run.
- [ ] Include `environment.json`, `events.csv`, `metrics.json`, captures, and `notes.md` for each run. Add measurement calibration and uncertainty; count errors and dropped measurements rather than deleting them.
- [ ] Populate `docs/feasibility-report.md` with the target/result/evidence for every gate, plus Ethan's assessment, scope exclusions, and current code revision.
- [ ] If a gate fails, identify the measured cause and make one focused remediation round. Re-run affected measurements and a short combined regression session. Further experiments require an explicit reason in the report; do not indefinitely optimize a weak platform fit.
- [ ] Apply the verdict rules below. Leave full-product work queued until the foundation is accepted.

## 6. Verdict and subsequent work

- **BROWSER FOUNDATION ACCEPTABLE:** All mandatory in-scope gates pass on the recorded setup and Ethan accepts the playing experience. Author the full implementation plan and preserve these witnesses as regression checks. Repeat performance validation after integrating the SoundFont engine and other material changes.
- **PROVISIONAL / EVIDENCE INCOMPLETE:** A required hardware measurement or Ethan's evaluation is missing. State exactly what is demonstrated and what remains unverified. This is not full browser approval; missing MIDI equipment alone is not proof that the browser failed.
- **BROWSER FOUNDATION REJECTED:** A mandatory gate remains unsatisfactory after the focused remediation round, or Ethan still finds the instrument difficult to play. Use the same fixtures and measurement criteria for a native feasibility comparison. Do not assume a native rewrite automatically fixes an engine or interface design defect.

Background continuation may be reported supported, unsupported, or unverified without preventing an otherwise valid pass. Limit every verdict to the tested browser/hardware setup and this prototype scope. None of these verdicts means complete Harmony Grid has shipped.

## Planning-task verification

For changes to this plan and the requirements only, inspect the Markdown diff, relative links, terminology, corrections, and repository status. Do not run builds, type-checks, linters, or test suites. The execution commands above apply only when the prototype's code is actually being implemented.
