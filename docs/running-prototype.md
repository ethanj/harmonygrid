# Running the playable foundation

This is the first playable implementation of the accepted design. It is not complete Harmony Grid or an accepted browser-feasibility result. The current evaluation is [provisional](feasibility-report.md).

From the repository root:

```sh
npm ci --ignore-scripts
npm run dev
```

Open the local URL printed by Vite, then click **Start sound**. The browser requires this gesture before starting audio. The current development server uses [http://127.0.0.1:5173/](http://127.0.0.1:5173/); the production build used for browser verification is also running at [http://127.0.0.1:5174/](http://127.0.0.1:5174/).

For the next evaluation, follow the [short playing checklist](playing-review.md#ethans-short-playing-check). The earlier freeze is confirmed resolved; the later Smooth Clavier/Auto grid release fix requires a reload to load the current build.

## Playing

Auto Button starts on: moving over the grid or ordinary clavier plays. Clicking sets the scale root. Turn Auto Button off to play by pressing and dragging. **Tab** sets the root from the lead pitch.

| Control | Action |
| --- | --- |
| 0–9 | Select a chord slot |
| Shift or Caps Lock + 0–9 | Select a mode; Shift plus Caps Lock selects chords again |
| Space | Momentary Sustain |
| F | Toggle Sustain latch |
| G | Momentary Hold; Command-G toggles its latch |
| Y | Toggle Drone |
| D | Repeat on ticks; Command-D toggles its latch |
| T | Toggle metronome quantization |
| Q / W / E / R | Temporary tempo factors ½ / 2 / ⅔ / 3⁄2; Command makes the change permanent |
| A / S | Decrease/increase the base tempo by one |
| Escape / All Notes Off | Clear playing notes and live retaining controls |

Buttons also select chords/modes and toggle retaining controls. Tempo buttons are momentary unless Command-clicked. Normal browser shortcuts may still intercept some combinations on some platforms; the Mac keyboard combinations need hands-on verification.

With quantization on, sound and the complete chord display wait for a tick. Filled mint marks indicate sounding notes, amber hatching indicates filtered chord members, and scale-root rings remain distinct. Sustain/Drone pitches use the same sounding appearance. The grid and clavier share committed state.

Smooth Clavier requires pressing and dragging even with Auto Button enabled. It spaces the selected scale tones equally across the playing region and hides the cursor during its drag. The visual clavier stays conventional. Exact feel at register edges still needs evaluation against Ethan's recollection.

**Reset document** immediately releases the old notes and restores the initial synthetic fixture. Full Open/Save/Save As, authoring dialogs, and document persistence are not implemented yet. Raw pitch capture and fixed-reference construction are presently engine-level checks.

## Sound and MIDI

The initial sound choices are a sustained synthesized organ-like tone and a decaying pluck. These are simple timing/playing sounds, not the planned SoundFont palette.

Click **Connect MIDI**, permit access, and select an input and output. Play Chords generates the selected chord from the most recent held input; releasing it resumes the previous held trigger. Mouse Solo enables independent mouse melody. Sets Root follows MIDI trigger changes. Thru forwards raw incoming messages immediately, independently of quantization. Actual external MIDI timing is unverified; read the report before interpreting the software tests as hardware evidence.

Ordinary focus loss does not issue All Notes Off. Returning pointer motion can resynchronize a missing button release. If a keyboard release was lost while another app had focus, release/repress the control or use All Notes Off. Hidden/minimized continuation and complete recovery behavior remain to be evaluated.

## Diagnostics and checks

If playing freezes, check the footer. Audio suspension offers **Resume sound**. A processor failure, stopped clock, or missing processor messages offers **Restart sound**. Restart creates a new audio session, preserves chord/mode settings, and clears live held/retained notes. Export a trace before reloading: it now includes audio state changes, the most recent fault, and processor exception/clock details when available. A reproduced freeze caused by duplicate browser audio blocks has been fixed and verified through six fresh Chrome startups, including three duplicate-block cases. If another freeze occurs, the trace will help identify it.

**Export trace** downloads JSON. Save review captures and traces under `docs/feasibility-runs/`. The trace is bounded to 20,000 records and reports dropped entries; stop/export before filling it for useful short sessions. This capacity is not sufficient evidence for the planned long-run telemetry gate.

```sh
npm test
npm run typecheck
npm run build
```

Build output is written to `docs/build/`. To reproduce the browser check against that build, run the following in separate terminals:

```sh
python3 -m http.server 5174 --bind 127.0.0.1 --directory docs/build
node docs/feasibility-runs/browser-check.mjs http://127.0.0.1:5174/
```

Add `--stress` to profile the plan's 16×12 and 24×16 scenes with synthetic movement, extended chords, and Sustain. Do not rebuild or replace the served assets while the check is running. The renderer uses installed Chrome in a separate temporary profile; the check mutes audio and is not a physical latency measurement. Diagnostic scene URLs are `/?scene=normal` and `/?scene=expanded`.

All code remains local on `feat/playable-foundation`. No commit, push, deployment, or publication has been performed. Ethan's instruction is to continue without Superpowers.
