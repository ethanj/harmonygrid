# Playing review — 2026-09-05

Ethan confirmed the earlier audio/grid freeze is fixed. This review exercised the combined controls before proceeding to instrument-authoring designs. Ethan subsequently confirmed Smooth Clavier worked and stated “all check complete.” The hands-on playing checklist is accepted.

Feedback on checklist item 3: after discussing an example, Ethan reaffirmed that drone pitches should not reattack, including those in the current chord. He requested reattack as a future control. The current behavior remains correct; this supersedes his initial suggestion to change it. The alternative control's scope remains open in the [requirements](requirements.md#configurable-musical-variations).

## Result

A foreground Chrome session ran for 340.432 seconds with 300 automated drags plus targeted pointer, keyboard, and button actions. Audio remained running, handled two duplicate audio blocks, and reported no processor faults, non-finite samples, voice stealing, engine queue overflow, or renderer snapshot overflow. The session included stationary periods, inspection, and diagnostics; it was not 340 seconds of continuous human playing. See the [recorded summary](feasibility-runs/playing-review.json).

Seventeen targeted checks passed before a release-behavior failure was found. Smooth Clavier being enabled caused releasing a main-grid drag to stop its notes even when Auto Button was on. The global `smooth` flag was incorrectly used for every pointer release.

The fix remembers whether the last valid playing position requires a pressed button. Grid Auto playing now continues after release; Smooth Clavier still releases, including when the pointer leaves its bounds. No layout or visual design was changed. Eight follow-up browser witnesses passed, including repeating the 150-drag failing workload. The reusable browser smoke script now includes grid/Smooth Clavier release regression cases. Those cases were exercised through CUA in this run; the standalone smoke script was updated but not executed here.

`npm test`: 54 tests passed. `npm run build`: passed, including TypeScript checking. The new pointer-release regression is covered by the real-browser witnesses, not claimed as one of those unit tests.

## Observed behavior

| Check | Result |
| --- | --- |
| C chord and B's filtered fifth | Correct played and filtered pitch sets |
| Sustain accumulation and release | Earlier individual pitches remain; release preserves current chord |
| Drone + Sustain + Repeat | D chord restruck each tick; captured C pitches did not restrike |
| Mode change while retaining sound | Earlier off-scale E and A remained sounding |
| Hold after pointer release | Chord remains until Hold releases |
| Short click with metronome on | Starts at the next tick; stops at the following tick |
| Momentary tempo control | Half tempo applies at a tick and returns to base on release |
| Command-G, F, Shift-3 | Hold latch, Sustain toggle, and mode selection reached the correct state |
| Smooth Clavier | Hover silent; press plays; release stops |
| Auto grid with Smooth Clavier enabled | Failed before the fix; passed afterward in immediate and tick modes |
| Smooth Clavier release outside bounds | Passed after the fix |
| Auto Button off on grid | Release stops the chord |
| Reset during retaining controls | Sound and live latches clear; subsequent playing works |

## Limits and remaining observations

The first draw took 1250.8 ms before audio startup. Subsequent draws had a maximum of 11.7 ms; the full-session p95 and p99 were about 0.4 ms. This startup stall remains a separate observation to investigate; the session does not prove a platform rendering guarantee. These are software draw durations, not input-to-photon or physical sound measurements.

The trace contained 13,447 records with no dropped records. Its compact diagnostic summary was saved through browser inspection. Automated download capture did not return the full trace, so this is not a complete archived raw trace or one of the three 20-minute scored workloads. External MIDI and physical timing remain unverified.

## Ethan's short playing check

Reload [the local instrument](http://127.0.0.1:5174/) and start sound. Allow roughly five minutes, extending any part that feels uncertain.

1. **Free movement:** leave Auto Button on and move slowly, then quickly. Judge whether the notes and chord shapes feel attached to your hand, and whether small cells are easy to target.
2. **Tick phrasing:** press T. Move between ticks and change chord slots while stationary. The sound and full chord shape should change together on the tick. Judge whether you can reliably place a change where intended.
3. **Retention:** press F, move through overlapping chords, then press F again. Try Y to capture a drone and move over it. Hold D to repeat the current chord; drone pitches should continue without reattacking.
4. **Hold and tempo:** turn Auto Button off. Hold G, press/drag/release the mouse, then release G. Try Q/W/E/R while holding them and listen for the return to base tempo when released.
5. **Clavier and recovery:** enable Smooth Clavier and restore Auto Button. The clavier requires pressing; the main grid still plays with movement. Use Escape to clear sound and immediately play again.

Checklist completed and accepted by Ethan on 2026-09-05, including Smooth Clavier. This acceptance covers the reviewed playing experience; physical latency, external MIDI timing, and the full scored endurance workloads remain unmeasured. The next design deliverable is rendered chord/mode editors and document controls.
