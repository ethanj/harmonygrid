# Visual Help keyboard map — 2026-09-06

Help now opens with a vector keyboard map grounded in the supplied manual help image. Its relative key arrangement groups Q/W/E/R/T and A/S for tempo, D/F/G for retention, C/V/N/M for copy and creation, and Space underneath. Tab/root, Y/Drone, Command latch markers, Shift/Caps target relationships, and the on-screen grid-axis controls are included. This is a relational performance map, not an exact physical keyboard layout.

The SVG has an accessible title and description; the detailed text reference remains below it. The map is a reference, not an interactive instrument inside Help. Original key behavior is unchanged. The arrow diagram is explicitly labeled as on-screen controls, avoiding a claim that keyboard arrows currently edit grid axes.

Design was rendered before implementation under `docs/prototypes/keyboard-map`. Production screenshots are `help-1280.png` and `help-1600.png`. The build and eight browser checks pass, including map fit, keyboard isolation, examples, and closing Help. No new unit tests were added for this visual-only change.
