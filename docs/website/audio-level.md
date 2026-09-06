# Audio output and automatic startup — September 6, 2026

The previous 8x gain and tanh saturation audibly distorted. Replaced both the synth-bank and final-output saturation with a stereo-linked peak gain controller. Gain is now 4x the original (12 dB), with a 0.9 ceiling, immediate gain reduction and 100 ms release. No lookahead or additional scheduling delay. Ordinary signals below the ceiling retain their waveform. Heavy overload can still produce gain modulation; listening review remains necessary.

17 audio tests passed, including unchanged sub-ceiling waveforms, stereo-linked overload bounds, gradual release and worklet output level. Production build passed.

Audio prepares automatically on page load. It runs immediately where browser autoplay permits; otherwise the first pointer/key gesture resumes the prepared context. Explicit Stop disables automatic restart for the visit. Browser verification covers first-grid-gesture playback and Stop remaining off.
