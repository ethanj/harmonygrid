# Playable foundation evaluation

**Verdict: PROVISIONAL / EVIDENCE INCOMPLETE.** The first playable foundation runs locally and passes its current automated checks. Ethan has accepted the hands-on playing checklist. Physical latency, audiovisual alignment, external MIDI timing, and the scored long-session workloads are not yet established. This is not full Harmony Grid parity or a final browser-platform approval.

**Playing failure reported:** Ethan reports that dragging and sound both stop after a few seconds. This overrides any impression of playing readiness from the earlier automated runs. A duplicate audio-block callback was caught killing the processor and has been fixed. Six fresh Chrome runs passed, including three that encountered the duplicate. Recovery and fault diagnostics were also added; see the [freeze investigation](freeze-investigation.md). The earlier manifests and profiling below describe the pre-recovery build.

Date: 2026-09-05. Branch: `feat/playable-foundation`; changes are uncommitted. [Source/build manifests](feasibility-runs/final-source-manifest.json) identify the final files. [Run instructions](running-prototype.md) describe the controls and reproduction commands.

## Latest playing review

Ethan confirmed the original freeze is fixed. A [5-minute-40-second combined-control session](playing-review.md) then found a separate Smooth Clavier/Auto Button release bug, now fixed and checked in the browser. Current unit tests: 54 passed; current build/typecheck: passed. [Latest source/build hashes](feasibility-runs/playing-review-manifest.json). Ethan subsequently completed and accepted the playing checklist, including Smooth Clavier. This establishes hands-on acceptance of the reviewed experience; outstanding hardware and endurance measurements remain separate.

## Delivered

- Accepted playing surface translated into a live Canvas grid and clavier, with an OffscreenCanvas worker on supported browsers.
- Complete current chord visualization, including filtered members, repeated exact-pitch consistency, and common sounding treatment for retained pitches.
- A deterministic sample-clock engine for immediate/tick playing, short-input duration, root/mode/chord changes, individual-note Sustain retention/eviction, Hold, Drone, Repeat, and separate mouse/MIDI ownership.
- AudioWorklet synthesis with sustained and decaying tones, bounded voices, sample-timed actions, and non-finite/overflow diagnostics.
- Auto Button, normal and Smooth Clavier input, three axis layouts, chord/mode slots, original performance and tempo keys, and deliberate All Notes Off.
- MIDI adapters for input priority/fallback, velocity, Sets Root, Mouse Solo, generated output, and immediate raw Thru. Port/channel/pitch identity is preserved. Output-device errors are isolated so internal processing and panic remain available.
- Synthetic fixtures, a document-reset witness, raw exact-pitch capture/construction checks, and bounded trace export.

## Verification

`npm test`: **48 tests passed across seven files**. `npm run build`: **passed**, including TypeScript checking. Tests cover explicit musical pitch sets and note-action sequences, shared ownership, tick boundaries inside audio blocks, short MIDI/mouse events, raw capture reference behavior, clavier hit testing, synthesis, tempo combinations, and MIDI routing boundaries.

The production build was exercised in headless Chrome 152.0.7977.76 at 1280×800 and 1600×1000. The final [browser check](feasibility-runs/browser-check.json) verifies real input adapters, AudioWorklet, and worker rendering: free playing, filtered membership, no between-tick preview, tick commitment, Sustain/Drone, All Notes Off, physical digit-key mode selection, layout fit, nonzero finite audio samples, and no observed queue/render overflow. Captures: [playing](feasibility-runs/01-live-playing.png), [after dragging](feasibility-runs/02-live-after-drag.png), [larger viewport](feasibility-runs/03-live-wide.png). [Raw smoke trace](feasibility-runs/browser-trace.json).

Audio was muted by the browser test harness. A running AudioContext and nonzero worklet samples demonstrate software processing, not measured audible output or sound quality.

## Larger-scene draw profiling

Both scenes used 2,000 synthetic pointer moves, an extended chord, Chromatic mode, and Sustain at 1600×1000 CSS pixels with device scale 1. Each scene ran for approximately 34–35 seconds. The audio context reported 48 kHz, base latency about 5.3 ms, and output latency 16 ms; those API estimates are not physical latency measurements.

| Scene | Draw observations | Median draw | p95 draw | p99 draw | Maximum draw |
| --- | ---: | ---: | ---: | ---: | ---: |
| 16×12 | 1,716 | 0.4 ms | 0.9 ms | 1.0 ms | 11.5 ms |
| 24×16 | 1,705 | 0.5 ms | 1.2 ms | 1.4 ms | 2.3 ms |

Neither captured run reported engine queue overflow, renderer snapshot overflow, telemetry loss, voice stealing, or non-finite audio samples. Both observed p99 draw durations are below the experiment's proposed 4 ms draw budget. This is supporting headless software evidence only: it does not measure photons, physical input, missed audible samples, or musical usability, and the broader rendering gate is still incomplete.

Evidence: [profile report](feasibility-runs/scene-profile.json), [normal trace](feasibility-runs/normal-trace.json), [expanded trace](feasibility-runs/expanded-trace.json), [normal scene](feasibility-runs/normal-scene.png), [expanded scene](feasibility-runs/expanded-scene.png), and [profiled build hashes](feasibility-runs/profile-build.json).

The scene profiling preceded the final Hold-after-release selection and Mouse Solo isolation fixes. Those fixes were covered by the final unit/build/browser checks. The renderer asset is unchanged between profiled and final builds. Treat the draw measurements as evidence for that renderer and these workloads, not an exact-final-build audio timing certification.

Earlier attempts had harness timeouts during startup or transfer of large trace strings. The harness now uses actual pointer clicks for startup and transfers large traces in chunks. The reported larger-scene runs completed; failed/incomplete attempts are not counted as successful scored sessions. The cause of the earlier intermittent startup timeout was not independently established, so repeated visible-browser startup remains part of hands-on evaluation.

## Remaining gates and scope

| Area | Status / next evidence |
| --- | --- |
| Physical input-to-sound and input-to-display | Unverified; instrumented input/output or high-speed capture on the actual playing setup |
| Gesture cutoff before audible ticks | Unverified; phase sweeps and physical output correlation |
| Visual/audio presentation skew | Unverified; external audiovisual measurement |
| External MIDI output and Thru timing | Unverified; real ports, loopback, and optional external-instrument audio |
| Sustained playing | No three 20-minute scored workloads yet; trace capacity is 20,000 records and must be improved or managed for long-run capture |
| Background operation and lost-key recovery | No panic on ordinary blur; full hidden/resume and missed keyboard-release behavior still need evaluation |
| Musical feel | Ethan completed and accepted the hands-on playing checklist, including Smooth Clavier, on 2026-09-05 |
| Complete original parity | Authoring UI, Open/Save/Revert/persistence, all axis/settings ranges, configurable variations, SoundFonts, complete help/examples, and optional multi-trigger MIDI remain later work |

Current grid drawing redraws the visible scene when committed state changes. The worker keeps presentation bounded and discards obsolete eligible frames. Additional static-layer/label caching is a possible improvement if measured workloads warrant it; the planned caching work is not claimed complete. Smooth Clavier's register-edge behavior and macOS Command-key delivery require a real playing review.

The hands-on checklist is now accepted. Next, render chord/mode editor and document-control prototypes for review before implementing those interfaces.
