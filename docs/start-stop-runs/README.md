# Start / Stop Sound — 2026-09-06

The sound button remains enabled during playing and reads **Stop Sound**. Clicking it disconnects and closes internal audio, silences MIDI output, clears live note/control ownership, and returns to **Start sound**. Grid motion and MIDI input cannot restart playback while stopped. Starting again retains instrument settings and creates a fresh audio session. Browser-driven suspension and processor faults retain their Resume/Restart recovery labels.

Validation: 158 tests pass; production build passes. `browser-check.json` records six production-Chromium checks covering the enabled Stop control, stopping a Drone performance, staying silent while dragging, preserving settings, restarting audible sample generation, and runtime exceptions. `playing.png` and `stopped.png` show the two states.

```sh
node docs/start-stop-runs/browser-check.mjs http://127.0.0.1:5174/
```
