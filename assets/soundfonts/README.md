# Harmony Grid sound palette

Source: S. Christian Collins, **GeneralUser GS 2.0.3**, from the [author's repository](https://github.com/mrbumpy409/GeneralUser-GS) and [GeneralUser page](https://schristiancollins.com/generaluser.php). The complete original bank is retained as `GeneralUser-GS.sf2`. The original [license](LICENSE.txt) applies to the reduced bank as well; it includes the author's sample-provenance statement.

`harmony-palette.sf2` is a 2,704,176-byte derivative containing bank 0 programs 0 (Grand Piano), 4 (Tine Electric Piano), 11 (Vibraphone), and 16 (Tonewheel Organ). Unused presets, instruments, and samples were removed without editing the retained sounds. Source and derivative SHA-256 values are in [manifest.json](manifest.json).

Reproduce after `npm ci`:

```sh
node assets/soundfonts/build-palette.mjs
```

Runtime and extraction use [SpessaSynth Core](https://github.com/spessasus/spessasynth_core), pinned to 4.3.22, Apache-2.0. Its license is distributed alongside these assets. The production build embeds the four-preset derivative locally; no third-party service is contacted during playing. Vite bundles the processor into the AudioWorklet.

The bank downloads in advance. If it has not arrived when Start sound is pressed, the instant oscillator remains available and Retry palette is shown. Retry explicitly releases notes and restarts sound. A ready bank is initialized before sending performance inputs, never swapped into an ongoing performance. Each engine has a fixed 256-voice budget; this is separate from musical Sustain/capture limits. Program changes affect new attacks, while previous voices follow their release envelopes. MIDI channel ten is explicitly melodic.
