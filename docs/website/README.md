# Harmony Grid public website

Live introduction: https://cedar-huckle-g5zg.here.now/

Instrument: https://cedar-huckle-g5zg.here.now/play/

Published September 6, 2026 to the user's here.now account. The publish API confirmed authenticated, permanent hosting with no expiry. Uses the free service tier.

## Build and update

From the repository root:

```sh
node docs/website/build.mjs
/Users/ethan/.agents/skills/here-now/scripts/publish.sh docs/site --slug cedar-huckle-g5zg --client codex
```

The curated publish directory contains only the introduction, instrument production build, screenshot, credits and licenses. The original manual is included and linked from About. Private review artifacts and credentials are not included. Hosting credentials live outside the repository; local publishing state is ignored.

`index.html` is the responsive introduction design. Desktop and mobile renders are saved alongside it. The production instrument is built with `/play/` as its asset base, including the renderer worker, AudioWorklet and sampled palette. Normal local development remains at the root route.

Validation: TypeScript and Vite build; desktop/mobile overflow and runtime checks; real Chromium startup and grid movement against the public instrument. Audible quality, physical MIDI and device latency still require hands-on review.
