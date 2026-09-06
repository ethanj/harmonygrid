# Harmony Grid — design review 03: capture revisions

Created 2026-09-05. Status: design review 03 accepted by Ethan on 2026-09-05. Ethan approved the “Limit capture audition notes” checkbox and its corrected default, the empty-capture notice placement and duration, and the naming message. The selected-versus-sounding visual distinction is also accepted, completing this capture design review. The musical decisions in the [requirements](../../requirements.md) are accepted; application implementation has not started for these authoring interfaces.

Open [the revised prototype](index.html). The six footer links load illustrated starting states. Earlier accepted [authoring designs](../authoring/design-review.md) and their images are preserved. This revision has no audio, MIDI connection, file access, or instrument-engine integration. “Sounding” labels represent the intended sound state.

## Screens

| State | What to review | 1280 × 800 | 1600 × 1000 |
| --- | --- | --- | --- |
| No eviction | Default is off; all four selected pitches audition | [13](13-capture-no-eviction.png) | [Larger](1600x1000/13-capture-no-eviction.png) |
| Optional limit, on entry | Checkbox unchecked; all four selected pitches audition | [14](14-capture-optional-limit.png) | [Larger](1600x1000/14-capture-optional-limit.png) |
| Optional limit, after checking it | Four selected, two auditioning; earlier performance continues | [14b](14b-capture-limit-after-click.png) | [Larger](1600x1000/14b-capture-limit-after-click.png) |
| Empty start | Existing notes sound without being selected; reference is not set yet | [15](15-capture-empty-start.png) | [Larger](1600x1000/15-capture-empty-start.png) |
| Naming | Draft preserved, capture audition stopped, earlier notes continue | [16](16-capture-naming.png) | [Larger](1600x1000/16-capture-naming.png) |
| Empty finish | Previous playing selection restored; brief header notice | [17](17-capture-empty-finish.png) | [Larger](1600x1000/17-capture-empty-finish.png) |
| Mode capture | Six exact pitches remain selected; five mode tones result | [18](18-capture-mode.png) | [Larger](1600x1000/18-capture-mode.png) |

## Selection and sound

Grid outlines and small bars near the top of clavier keys identify draft selections. Mint circles and key fills retain the accepted meaning of sounding pitches. These marks can appear independently. Reference pitch classes retain double circles; a new empty capture has no reference until the first selection.

The earlier performance is fixed at Drone C3/G3 and Sustain E4 in these examples. The chord draft contains E4/G4/B4/C5 relative to a removed C4 anchor. With no eviction, all four audition. With the optional limit enabled and Hold Number set to 2, B4/C5 audition, G4 remains selected but silent, and E4 remains selected and sounding only from the earlier performance. The row labels distinguish “Auditioning”, “Audition + performance”, “Performance only”, and “Selected · silent”. Existing notes never count as automatically selected draft members.

The checkbox is labeled **Limit capture audition notes**, is off by default, and shows its separate Hold Number allowance when enabled. This behavior setting belongs to the instrument document. It does not change draft membership or the previous performance's allowance. Actual shared-pitch reattacks remain an audio implementation requirement and cannot be demonstrated by these still states.

## Exiting collection

Naming preserves the selected pitches and reference but removes capture audition sound immediately. The background indicators and the naming message show that C3/G3/E4 continue from the earlier performance. The naming dialog retains protected slot 1 and an explicit replacement target.

Finishing an empty collection restores the playing view with “No pitches selected” in the header. It disappears after five seconds or can be dismissed; the renderer freezes it for review. The notice originally overlaid the clavier during drafting and was moved into header space after visual inspection. It covers neither playing surface. Cancellation uses the same placement with “Capture canceled”. Ethan accepted the empty-capture notice's header placement and five-second duration on 2026-09-05.

## Trying the preview

Click pitches on the grid or clavier, or use the row removal buttons. Clearing and refilling a collection retains its reference. The Make chord/mode buttons switch type during collection without clearing its pitches. From the playing view, they start a new empty capture. Name & choose slot continues to naming; Escape or Cancel returns to the fixed prior playing selection without altering any slot.

The confirmed keyboard sequence works in the preview: hold N, press M, release N, then release M. Naming supports slot digits 2–0 followed by Tab to focus the name. Inputs accept text, and Escape cancels even from the name field. Returning with Edit pitches preserves the draft. Replace is an illustrative completion message; it does not save a pattern.

This is a visual state study, not a complete capture scheduler. The limit checkbox compares projected states using all selections or the latest two selections; changing the checkbox and editing a limited draft recompute that illustration. The preview does not decide live reactivation/backfill behavior when a limit changes or audition notes are removed. Returning from naming also redraws the audition illustration. Reverse key-release order, repeated switching, MIDI capture, attack timing, and other unconfirmed engine details are not established by the preview. Each footer navigation resets its starting fixture.

## Verification

Fourteen PNGs were rendered. The original six states and the corrected optional-limit entry and after-click states were visually inspected at the two declared sizes using installed Chrome. These are review sizes, not measurements of Ethan's display. [Render manifest](render-manifest.json) records the browser and image dimensions. [Visual QA](visual-qa.json) records selected, auditioning, performance, and sounding flags on both grid and clavier, plus viewport bounds. Independent explicit pitch sets in the renderer check every displayed pitch, including repeated grid appearances. All layout and pitch-set checks passed.

[Interaction QA](interaction-qa.json) records focused preview checks for empty entry, reference preservation through clearing/refilling, N-to-M handoff, audition exit, slot digit/Tab navigation, cancellation, empty completion, and unobstructed notice placement. These checks exercise the prototype only; no application tests, builds, physical audio measurements, or MIDI checks were run for this revision.

Sources: [index.html](index.html), [capture.css](capture.css), [capture.js](capture.js), reusing the earlier [base SVG helpers](../mockup.js), [base CSS](../mockup.css), and [authoring CSS](../authoring/authoring.css). No accepted source prototype or application code was changed.

Reproduce from the repository root:

```sh
node --check docs/prototypes/capture-revision/capture.js
node docs/prototypes/capture-revision/render.mjs
```

The [renderer](render.mjs) uses a temporary Chrome profile under this directory and removes it afterward. All generated artifacts stay under `docs/`.

The capture audition limit control, its corrected default, the empty-capture notice placement and duration, and the naming message are accepted. The selection/sound indicators are also accepted. Preserve these renders as the capture implementation reference; the prototype limitations and remaining behavioral questions above still apply.

## Acceptance record

| Area | Status |
| --- | --- |
| Limit capture audition notes checkbox | Approved by Ethan, 2026-09-05, after confirming that “Optional limit” refers to this checkbox: off by default; limits capture audition sound only, preserves all selected pitches, and leaves the earlier performance unaffected. |
| Default-off demo correction | Accepted by Ethan, 2026-09-05: “good” after the demo was fixed to start unchecked on every entry screen, including Optional limit, and enable the limit only through explicit checkbox interaction. |
| Selected versus sounding visual distinction | Accepted by Ethan, 2026-09-05: “yes” after enabling the optional limit and reviewing G4 remaining outlined but silent while E4 stays filled from the earlier performance. |
| Naming message and audition-stopped state | Accepted by Ethan, 2026-09-05: “yes” to the message clearly distinguishing stopped capture audition from the earlier performance continuing to sound. |
| Empty-capture notice in the header | Accepted by Ethan, 2026-09-05: “yes” to showing “No pitches selected” in the header for five seconds, clear of the grid and clavier. |

## Default-state correction — 2026-09-05

Ethan identified the initially checked checkbox on the Optional limit demo as an error. The demo now initializes the setting to off on every entry screen, including Optional limit; changing links is not the fix. Reviewers must check the control explicitly to enable it. The renderer verifies both the unchecked DOM control and disabled limit state immediately after every page load. The enabled-state render is captured only after clicking the checkbox, and its action is recorded in the manifest and QA data. The musical default remains no eviction.

Ethan accepted this correction after reviewing the fixed demo.
