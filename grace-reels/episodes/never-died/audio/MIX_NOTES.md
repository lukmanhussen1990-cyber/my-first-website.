# Mix notes: They Never Died

Built by `npm run audio` (tools/synth/build_audio.mjs). It is deterministic: seeded noise and no
timers, so the same inputs always give the same file. Every hit comes from `src/beats.mjs`, so re-run
after changing beats or the timeline.

## Stems (48 kHz stereo, 32-bit float, at mix level before ducking)

- `audio/stems/music.wav`: the score. It has pads, felt piano, a low D drone, strings (tremolo in S4),
  a formant choir, a brass-like stab, sub hits, cymbal swells and a 4.4 s hall reverb.
  - It is in D minor until **57.72 s** ("And Jesus made a promise"), then D major.
  - S4 drives with an ostinato and taiko-like hits into a hard stop at the freeze (28.24 s).
  - The S5 freeze has a filtered drone and a reverse swell into the rewind (32.80 s).
  - S6 is a slow replay, then a crescendo that peaks in F major on "heaven" (40.26 s).
  - S7 is near silence while the cloak falls. S8 is a bright choir on D (sus2 / G-over-D, a hint of F#).
  - S9 is a full D-major swell on "never die". S11 resolves on D major.
- `audio/stems/sfx.wav`:
  - S1: the hook whirlwind and cloak flutters.
  - S2: Enoch's steps, which simply stop, a light shimmer and badge chimes.
  - S3–S4: Jordan river and wind, plus heavy Elijah and light Elisha steps.
  - Chariot: a whoosh, a boom, a fire roar, crackles and two horses galloping. The thumps use a 0.45 s
    stride from chariotBurst. Everything cuts at the freeze.
  - S5: paper whoosh, stamp hit and tape rewind.
  - S6: slowed roar and hooves during the replay, then the whirlwind howl and a circling rumble.
  - S7: soft wind, the cloak's flutter and a soft landing, then a shimmer into S8.
  - S10: typing taps (14 per second, spaces skipped) and heart pops.

## Loop seam

The opening whirlwind, pad and drone start 0.6 s before t = 0. That pre-roll is cross-faded onto the
last 0.6 s (from loopOut = 72.77 s), so the end flows into the start. Matching 8 ms
fades at both ends avoid a click on first play; at the loop point they make a 16 ms dip.

## Mix

- **Voice:** a gentle compressor (3:1, soft knee, −19 dBFS threshold, max 6.3 dB), centered.
- **Levels:** music sits 2.5 LU under the voice and SFX sit 6.5 LU under (gated).
- **Ducking from the voice:** 40 ms look-ahead, about 80 ms attack and 350 ms release. Music drops
  8 dB, ambience beds 10 dB and hits 5 dB.
- **Intelligibility guard:** music and SFX each stay at least 12 dB under the voice's phrase level while
  it speaks, capped at 10 dB extra. Measured extra: up to 10.0 dB for music and 10.0 dB for SFX.
- **While speaking:** the voice is a median 14.2 dB over the music (worst phrase
  11.4 dB) and 18.7 dB over the SFX (worst 13.3 dB).
- **In the pauses** (15 gaps of 0.5 s or more) the music comes up to a median 11.3 dB under the voice's speaking level.
- **Pre-master:** levelled to −14 LUFS, then a true-peak limiter at −1.6 dBTP (max 2.7 dB
  of reduction, more than 0.5 dB on 2.28% of samples).
- **Loudnorm:** two passes (I −14, TP −1, LRA 15). Pass 2 ran in **linear** mode.

## Final mix (`audio/final_mix.wav`, copied to `public/audio/final_mix.wav`)

| Measure | Value |
|---|---|
| Integrated loudness | -13.9 LUFS |
| True peak | -1.4 dBTP |
| Loudness range | 2.6 LU |
| Format | pcm_s24le, 48000 Hz, 2 channels |
| Length | 3521600 samples = 73.3667 s (timeline 73.367 s, 2201 frames) |
| Sample peak | -1.43 dBFS |
| DC offset | -8.9e-5 / -1.1e-4 |
| Key check | F over F# in S7 is 25.6 dB; F# over F after 57.72 s is 37.5 dB; F# rises 9.7 dB across the change |
| Freeze | music drops 23.3 dB across the hard stop at 28.24 s |
| Clicks | largest second-difference spike near any hit is 16.4× its local RMS (no hard discontinuities) |

## Balance per scene (integrated, final scale)

| Scene | Time (s) | Voice LUFS | Music LUFS | SFX LUFS |
|---|---|---|---|---|
| S1 Hook | 0.00–3.73 | -13.4 | -21.9 | -30.7 |
| S2 Enoch | 3.73–15.37 | -14.2 | -26.8 | -27.3 |
| S3 Elijah and Elisha | 15.37–22.43 | -13.3 | -26.3 | -28.3 |
| S4 Chariot of fire | 22.43–27.64 | -13.6 | -27.7 | -29.9 |
| S5 Most people get it wrong | 27.64–32.95 | -13.5 | -28.9 | -23.5 |
| S6 The whirlwind | 32.95–41.22 | -13.6 | -28.0 | -32.7 |
| S7 My father, my father | 41.22–51.50 | -13.8 | -28.1 | -37.7 |
| S8 The mountain | 51.50–57.22 | -13.9 | -26.8 | -29.1 |
| S9 The promise | 57.22–63.92 | -13.6 | -26.3 | — |
| S10 Call to action | 63.92–70.37 | -13.5 | -26.0 | -35.6 |
| S11 End card | 70.37–73.37 | — | -16.2 | -27.2 |
