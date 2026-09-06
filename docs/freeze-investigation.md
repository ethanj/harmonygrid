# Playing freeze investigation — 2026-09-05

Ethan reports that the instrument works for a few seconds, then both dragging and sound stop. An unexpected processor failure was subsequently captured in foreground Chrome: `Non-monotonic audio interval`, with `sample=3712` and `lastBlock=3712`. The browser requested the same audio block twice. The strict engine clock check threw, stopping synthesis and the snapshots used for dragging. This reproduces the shared sound/display failure. Ethan subsequently confirmed the updated build is “fixed”; that freeze is resolved in his session.

## Findings

The grid displays audio-committed snapshots. If audio processing stops, its played/filtered visualization also stops. The captured processor failure therefore stops both sound and the played/filtered grid display.

The prior error handler showed a reload instruction while leaving the Start button disabled and labeled “Sound running.” It did not record processor exceptions or detect a running AudioContext whose clock/processor had stalled. A module-loading failure also left a partially initialized context that a retry could incorrectly treat as ready.

Before the failure was captured, two foreground Chrome 152 runs at 1455×974, device scale 2, continued to process after repeated drags; one was observed at 88.49 seconds. Those successful runs alone did not establish physical audio latency or usability. One initial draw reported 2442 ms; subsequent processing continued. The earlier headless render results do not represent this startup stall.

## Changes

- Duplicate audio quanta replay the cached output without advancing the engine, emitting another snapshot, or reattacking notes. Inputs received during the duplicate remain queued for the next new block. True backward jumps still produce diagnostic faults. The health report counts duplicate blocks.

- Processor exceptions report their message, stack, current sample, and last completed block; the failing block outputs silence.
- A wall-clock watchdog detects a stopped audio clock or missing processor updates after 2.5 seconds. It does not schedule musical events. Heartbeats use audio time at every sample rate.
- Failure enables the existing button as **Restart sound**. Restart replaces the context and node, disconnects the old output, clears stale presentation messages and live note controls, and preserves selected settings. Suspended audio retains **Resume sound**.
- Audio state transitions and fault evidence are included in exported diagnostics. Startup failures can also retry with a clean context.

## Verification

- 54 tests across nine files passed; production build and TypeScript checking passed.
- Worklet tests exercise real synthesis and health reporting at 8 kHz and 48 kHz; an intentional backward interval verifies exception reporting and silent output. A regression test repeats the same quantum three times, verifies identical output and no duplicate events, then verifies the next pointer input commits on the next new block.
- Foreground Chrome fault injection sent an invalid document directly to the worklet, producing a real `this.settings.chord is not iterable` exception. The UI exposed **Restart sound**. Clicking it and dragging produced lead G3, played pitches 55/59/62, and filtered pitch 58 in a fresh audio session. This is an injected failure, not the user's reproduced trigger.

- Final-build Chrome verification: six fresh startups with 20 drags each all remained running and ended on lead G4 (67). Three runs encountered one duplicate block each and continued producing nonzero, finite samples. None reported an audio fault or queue/render overflow. Two runs clamped one late input each to the next block; no input was discarded. See [run evidence](feasibility-runs/freeze-fix-check.json).
- Disabling delivery of processor messages deliberately triggered the watchdog and exposed **Restart sound**. The subsequent restart is where the unexpected duplicate-block failure above was captured, before the duplicate-block fix.

The updated production build is served at <http://127.0.0.1:5174/>. Reload once to load it. The reproduced duplicate-block failure is fixed. If playing freezes again, export its trace and record the footer/browser so any remaining cause can be investigated. Physical latency and full playing acceptance remain unverified.
