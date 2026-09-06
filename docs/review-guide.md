# Harmony Grid — review guide for 2026-09-06

The remaining software slices from the feature-gap audit are implemented. Ethan authorized completing them autonomously and reviewing afterward. New interfaces were rendered before implementation. This report supersedes the audit's implementation-status column; previous acceptance reports remain historical evidence.

Open the built instrument at **http://127.0.0.1:5174/**. Development preview: http://127.0.0.1:5173/. Click **Start sound**. While playing, it becomes **Stop Sound**; clicking again silences playback and clears live notes. See [the toggle verification](start-stop-runs/README.md). No commit, push, or deployment was made.

## What to try

1. **Performance & MIDI…** — change velocity, Hold Number, capture allowance, output choice, channels, and musical variations. Scroll the left panel; Apply/Cancel stay visible. The right panel previews the routes.
2. **Sound selector** — Grand piano, Tine electric piano, Vibraphone, Tonewheel organ, plus the instant Organ and Pluck. Sound choices save with the document. Piano naturally decays; organ sustains.
3. **Edit… → Edit pitches on grid…** — reopen the selected saved slot as an auditioned pitch collection. Its reference stays fixed, even when absent from the chord. Cancel leaves the slot intact. Apply/cancel other editor drafts before entering collection.
4. **Help → Examples** — six new studies with explicit patterns, including 5 × 7 and 1 × 12 layouts. Opening uses the usual save/discard flow. These are modern reconstructions, not recovered original preset files.
5. **Shift / Caps Lock** — the Modes heading now reports the live digit target. Shift XOR Caps selects modes; both together select chords.
6. **Files** — save/reopen the selected sound and new performance settings alongside the previously accepted grid, capture, and slot features.

## Chosen defaults and variations

The established playing behavior stays the default. The autonomous pass resolved the previously open alternatives as follows:

| Setting | Default | Available variation |
| --- | --- | --- |
| MIDI-triggered chords | Latest held trigger, with older-held fallback | Independent chord per held MIDI trigger |
| Sets Root with independent MIDI | Most recently pressed held trigger controls the single global root; fallback on release | Same arbitration in both trigger modes |
| Multiple short MIDI inputs | Held triggers win; otherwise the latest short trigger supplies one full tick | Ignore inputs entirely between ticks |
| Short mouse clicks | Latest pointer position plays one full tick | Ignore inputs entirely between ticks |
| Repeat and Drone | No reattack of Drone-owned notes | Reattack current-chord Drone notes, or all captured Drone notes |
| Sustain shared pitches | Do not reattack retained pitches on ordinary replacement | Reattack on replacement; Repeat still attacks on ticks |
| Retained notes across root/mode changes | Continue | Clear retained Sustain/Drone obligations when the scale changes; current owners still play |
| Sustain limit | Hold Number, oldest individual first-retained note | Disable musical eviction |
| Sustain age | Reuse does not refresh age | Refresh reused pitches to newest |
| Capture audition limit | **Off** | Independent allowance, 0–128; selected pitches remain even after audition eviction |
| Capture Auto Button | **Off on entering collection** | Toggle during the collection |
| New-document Thru routing | Selected Thru/generated channel | Preserve incoming Thru channels |
| Older files without output settings | Preserve their prior incoming-channel Thru behavior | Editable and saved thereafter |
| Outputs | Internal sound and generated MIDI enabled; Thru off | Independent internal/generated output controls; separate Thru toggle |

Mouse and Thru/generated channels are displayed as 1–16 and stored as 0–15. New mouse/clavier attacks use the configured velocity; MIDI-generated attacks use incoming velocity. Changing a route preserves the release obligation on the old channel. Repeated incoming note-ons replace one trigger obligation. Thru remains immediate; generated output remains timestamped. Incoming All Notes Off/All Sound Off releases the matching input's notes instead of cutting unrelated generated owners on a shared output channel. Other Thru channel-voice messages follow the selected routing; system messages are not channel-remapped.

Enabling generated output or choosing a new device starts sending subsequent attacks; it does not automatically restrike the entire existing performance. Internal mute is a short gain ramp and preserves musical owners. Existing retained notes keep their original channels until released.

## Sound loading and limits

The locally bundled sampled palette is 2.7 MB. It downloads ahead of Start sound. If unavailable or still loading, the synthesized fallback remains playable; **Retry palette** releases notes and restarts sound before installing the bank. Selecting an unavailable sampled sound explicitly reports the Organ fallback. Bank parsing does not run while performance inputs are active.

New attacks use the selected sound. Existing release tails continue. Synthesis capacity is 256 voices per engine, separate from musical note retention and capture limits. Disabling musical eviction cannot make CPU or synthesis capacity unlimited. Source, exact derivative hashes, reproducible extraction, and licenses are in [the sound asset directory](assets/soundfonts/README.md).

Existing-slot recollection supports any pattern and fixed reference that fit within MIDI 0–127. Wider relative patterns remain editable as intervals, with an explanatory disabled collection button. The original slot is not modified until capture replacement is saved.

## Verification

- Unit/engine suite: **157 tests across 20 files** pass, including routing ownership, all variations, file migration, sound-bank rendering, seeded capture, and rolling trace storage.
- `npm run build` passes TypeScript checking and produces the review build under `docs/build`.
- [Completion browser checks](completion-runs/browser-check.json) cover the production AudioWorklet, every timbre, new settings, capture recollection, examples, and saving. The [fallback renderer run](completion-runs/fallback/browser-check.json) exercises the same flow without OffscreenCanvas transfer.
- Regression browser checks also pass: [capture](capture-runs/browser-check.json) 37, [documents](document-runs/browser-check.json) 29, and [slot editing](slot-runs/browser-check.json) 30. The slot editor keeps Apply/Cancel visible while its content scrolls at compact sizes.
- [Recovery checks](completion-runs/recovery/browser-check.json) block the actual bank request, retry successfully, suspend/resume the real AudioContext, preserve Drone through synthetic blur, test synthetic visibility transitions, and release notes with Panic. Synthetic focus/visibility tests do not certify actual OS sleep or hidden-tab scheduling.
- [Accelerated endurance](completion-runs/simulated-endurance.json) covers three 20-minute logical timelines, including quantization and independent MIDI plus retention. This is simulated musical time, not sixty minutes of wall-clock audio.
- [Browser endurance](completion-runs/endurance/browser-check.json) covers three separate **60-second** real Chromium runs with sampled piano: normal grid, expanded grid, and retained notes with Repeat. All continued playing/drawing, reported finite audio and no queue overflows, and released every logical note on Panic. Diagnostic draw p99 was 1.1 ms, 1.4 ms, and 1.7 ms respectively; sample counts were 2,961, 3,049, and 241. The retained run is too small for a scored p99 distribution. Startup-inclusive maximum draw duration was 28.8 ms in the normal run.

These are software checks, not guarantees of physical input-to-sound latency, photons, audible dropout absence, or external MIDI delivery. The originally adopted three 20-minute foreground runs **per scored workload**, hardware loopback/recordings, higher-refresh display measurements, and Ethan's evaluation of this new sound engine remain outstanding. The browser harness accepts `HARMONY_RUN_SECONDS=1200` for longer runs; its synthetic input and headless display still do not replace those physical measurements.

Trace export now retains the most recent 20,000 events in chronological order and reports how many older events were replaced. It does not freeze permanently after filling. Hidden presentation coalesces to the latest state; background audio itself remains subject to browser/device policy. Ordinary blur never triggers an automatic panic. Help explains deliberate recovery from a missed keyboard release.

## Historical fidelity still unavailable

No exact original preset documents or legacy binary-format specification have been provided. The original manual and recorded decisions ground the implementation, but full bit-for-bit preset reconstruction or original-application parity cannot be certified from them. No invented legacy parser or falsely attributed preset values were added.

## Files and reproducibility

- [Performance design renders](prototypes/performance-settings/index.html)
- [Finishing-controls design render](prototypes/finishing-controls/controls-1280.png)
- [Production screenshots and checks](completion-runs/browser-check.json)
- [Current work checklist](remaining-work.md)

```sh
npm ci
npm test
npm run build
npm run dev
# Production preview, in a separate terminal:
python3 -m http.server 5174 --bind 127.0.0.1 --directory docs/build
# Browser checks, with desktop Chrome installed:
node docs/completion-runs/browser-check.mjs http://127.0.0.1:5174/
node docs/completion-runs/fallback/browser-check.mjs http://127.0.0.1:5174/ --fallback
node docs/completion-runs/recovery/browser-check.mjs http://127.0.0.1:5174/
node docs/completion-runs/endurance/browser-check.mjs http://127.0.0.1:5174/
```


## Manual status-block correction

The original inline grid-axis interaction was missing despite the Grid & register dialog. It is now restored below the performance controls: live scale, Mode/Chord target highlighting, and 1–12 semitone arrows with Set/Cancel. See [the correction report](status-controls/README.md).


## Visual Help correction

Help now begins with a spatial keyboard map matching the manual’s relational presentation. The detailed text reference remains beneath it. See [the map and verification](keyboard-map-runs/README.md).
