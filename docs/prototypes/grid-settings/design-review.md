# Grid & register design review

Status: Ethan accepted the visual design and subsequently confirmed the four summarized musical defaults. This is an interactive design prototype, not the live instrument. No audio, MIDI access, live settings, or file persistence is connected. Follows the [feature-gap audit](../../feature-gap-audit.md) and accepted visual language. No Superpowers used.

## Review the design

Open [the interactive prototype](index.html). Independent horizontal/vertical inputs accept whole numbers 1–12; shortcut buttons select 4×3, 5×7, or 1×12. Register selectors show both note names and MIDI numbers to avoid historical octave-label ambiguity. Highest playable pitch uses a MIDI number with its note name displayed below.

The right-hand panel previews the draft geometry and conventional clavier. It shows scale membership, not sounding notes: this is a settings preview, not between-tick performance feedback. The live playing surface remains unchanged until Apply in the proposed workflow. Here, Apply changes only the prototype's local baseline. Cancel restores that baseline; neither action opens/closes a real application panel. A last-valid preview remains visible during invalid entry, with explicit validation feedback and Apply disabled.

The diagram uses 12 columns and 6 rows to keep pitch labels legible within the settings panel. It illustrates geometry rather than promising the live instrument will adopt those dimensions. Clavier spans three octaves plus its upper C, matching the current playing range width.

| State | 1280 × 800 | 1600 × 1000 |
| --- | --- | --- |
| Current 4×3 layout | [Render](default-1280.png) | [Render](default-1600.png) |
| Draft 5×7 layout | [Render](fifths-1280.png) | [Render](fifths-1600.png) |
| Draft 1×12 layout | [Render](octaves-1280.png) | [Render](octaves-1600.png) |
| Ceiling at C5 / MIDI 72 | [Render](ceiling-1280.png) | [Render](ceiling-1600.png) |
| Higher grid/clavier registers | [Render](register-1280.png) | [Render](register-1600.png) |
| Invalid interval | [Render](invalid-1280.png) | [Render](invalid-1600.png) |

## Behavior proposals still requiring a decision

Visual approval must not silently resolve the audit's open musical questions. These are proposed implementation defaults, not recovered original behavior:

- Preserve old-file defaults: grid MIDI 24, clavier MIDI 48–84, maximum MIDI 127, and the saved axes. Label registers by note and MIDI number instead of ambiguous octave numbers.
- Prototype choices currently expose lower C values MIDI 0–108 for the grid and 0–72 for the clavier. These are review ranges, not an approved replacement of the manual's historical octave ranges. The ceiling cannot sit below either surface's lowest C in this prototype; confirm this validation policy before implementing it.
- Proposed maximum-pitch policy: suppress newly generated mouse/clavier pitches and chord members above the ceiling; visually distinguish those unavailable pitches from mode filtering. Preserve already-retained notes until their existing owners release them. Do not filter incoming MIDI or raw Thru by this setting. Capture's exact handling still needs agreement.
- Proposed geometry-apply policy: change both displayed mapping and hit testing together, without synthesizing a fresh attack merely because a stationary pointer is now over a different pitch. Require a new gesture before playing on the new layout. Confirm how this fits metronome timing and held controls before implementation.
- Proposed capture register policy: collection follows the configured registers and axes rather than silently reverting to the current hard-coded capture base. Confirm how the maximum pitch applies to collection/auditioning, including notes supplied by MIDI.

These proposals are intentionally documented outside the product UI: the player-facing panel explains controls and pending changes, not implementation mechanisms. A follow-up implementation must cover worker and fallback rendering, hit testing, Smooth Clavier, persistence/migration, retained-note behavior, and capture consistently.

## Verification

[Renderer and interaction harness](render.mjs) uses an isolated headless Chrome profile and writes all captures under this directory. [Results](browser-check.json): 24 viewport checks across twelve renders plus five interaction checks, covering draft versus applied state, Cancel, Apply, invalid interval rejection, and ceiling shading. No runtime application code changed; application builds/tests were not run. This evidence establishes prototype behavior and layout, not live musical behavior or latency.

## Implementation follow-through

The [live implementation](../../grid-settings-implementation.md) now records the exact behavior and checks. Its confirmed decisions supersede corresponding proposal wording above; the original proposal section is retained as design history.
