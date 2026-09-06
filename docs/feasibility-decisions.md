# Feasibility experiment decisions

2026-09-05. Ethan said “Proceed” after the two questions proposing experimental behavior defaults and the plan's performance targets. Use the proposed defaults and targets for this experiment. These are new implementation choices, not independently verified original behavior. Full-product configuration alternatives remain future design work.

| Decision | Experiment rule |
| --- | --- |
| Multiple short mouse clicks per tick | One full-tick play request at the latest pointer position, including movement after release. |
| Multiple short MIDI notes per tick | A currently held trigger wins; otherwise the most recent short note supplies one full-tick chord. |
| Control ordering | Preserve event order, break cross-source ties by monotonic receipt sequence, and apply pending controls/root/mode before deriving the tick chord. |
| Shared notes | Separate mouse, MIDI, Sustain, and Drone ownership per output channel/pitch. Release only when no owner remains; required attacks may restrike except under Drone protection. |
| Sustain limit | Count distinct Sustain-retained channel/pitch obligations; oldest first retention is evicted individually, without refreshing age on reuse. Other owners protect their sound. |
| Focus | No all-notes-off on ordinary blur. Provide deliberate All Notes Off; resynchronize observable physical input on return and report lost-release cases. |
| Initial platform | Desktop Chrome on Ethan's Mac; wired/internal audio. Other browsers and hidden continuation are not implied accepted. |
| Performance targets | Adopt the complete target table and scored workload definition in [the feasibility plan](browser-feasibility-plan.md), section 3. Do not change targets after a scored run. |

Ethan completed and accepted the hands-on playing checklist on 2026-09-05, including Smooth Clavier. Hardware response, external audiovisual skew, MIDI loopback timing, and scored sustained sessions remain unverified. Software automation is not a substitute for those measurements.

The accepted [design baseline](prototypes/design-review.md) governs the initial playing interface. This experiment uses simple synthesized sound and synthetic chord/mode fixtures. No SoundFont palette or recovered original document library is claimed.

Playing-review clarification: Ethan reaffirmed that Drone-held pitches do not reattack under Repeat, including pitches shared with the current chord. Keep the implemented default. A future document-level control for drone reattack is now explicitly requested; its enabled scope is not yet selected. See [configurable musical variations](requirements.md#configurable-musical-variations).
