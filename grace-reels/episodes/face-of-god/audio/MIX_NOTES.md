# Mix notes: The Face of God

Built by `npm run audio` (tools/synth/build_audio.mjs). It is deterministic: seeded noise and no
timers, so the same inputs always give the same file. Every hit comes from `src/beats.mjs`, so re-run
after changing beats or the timeline.

## Voice

The user's own recording (`audio/vo/moses_full.mp3`), cut into one clip per sentence at its natural pauses
and joined again with the brief's pauses (tools/build_voice.py): 0.3 s between sentences, 0.7 s after "you
will die", 0.8 s before "But notice", 0.6 s after "That was just from being near God" and 0.6 s before the
last line. A 75 Hz high-pass clears the rumble under the voice.

## Stems (48 kHz stereo, 32-bit float, at mix level before ducking)

- `audio/stems/music.wav`: deep pads, low strings, choir, felt piano, timpani hits and rolls, a D drone and a
  5.2 s hall.
  - The storm: low tremolo strings and a dark choir grow under the lightning, a riser and a timpani roll
    swell into "you will die", then a **hard cut** at 5.03 s: "die" lands in near silence.
  - The montage: a driving low pulse, a hit on every whip cut and a big D minor hit when the sea splits
    (9.50 s).
  - The summit: the request rises to a bright F chord on "glory"; E-flat over D and a timpani roll grow to "live".
  - The clift: quiet tension, then choir and strings swell on a luminous B-flat as the glory passes, with a long echo.
  - Coming down and the camp: tender, a soft piano line, a twinkle on "shining".
  - D minor until **40.58 s** ("Now here's the best part"), then a warm D major swell; warmest
    at Jesus' face, peaking on "Christ" (52.61 s).
- `audio/stems/sfx.wav`:
  - The storm: a howling gale, rain, thunder after every flash, the robe and beard flapping, a rising tone as
    the light breaks through, and a swell that stops dead on the hard cut (then only faint wind).
  - The montage: a fire whoosh, the bush roaring and crackling, whips, three frog croaks, hail, the sea's roar
    and a surge as it splits.
  - The clift: a rock scrape, a low whoosh as the shadow covers him, the roaring rush of light (a filtered
    noise sweep over a low roar) and its soft echo.
  - Coming down: footsteps on gravel, a morning breeze, a shimmer around the face.
  - The camp: murmurs and gasps without words, people stepping back, a child's shuffle. The veil: soft cloth.
  - A whoosh for the light streak; lamps and room tone in the upper room; birds and a breeze on the hillside.
  - Badges: a pop and a chime as FIRE and SEA fill, a bright chord when FACE fills. Soft taps and heart pops
    for the call to action; a sparkle as the logo draws itself.

## Loop seam

The storm's wind, rain, pad, strings and drone start 0.6 s before t = 0. That pre-roll is cross-faded onto the
last 0.6 s (from loopOut = 64.47 s), so the end flows into the start. Matching 8 ms
fades at both ends avoid a click on first play; at the loop point they make a 16 ms dip.

## Mix

- **Voice:** a gentle compressor (3:1, soft knee, −19 dBFS threshold, max 5.7 dB), centered.
- **Levels:** music sits 0.5 LU under the voice and SFX sit 5.5 LU under (gated).
- **Ducking from the voice:** 40 ms look-ahead, about 80 ms attack and 350 ms release. Music drops
  8 dB, ambience beds 10 dB and hits 5 dB.
- **Intelligibility guard:** music and SFX each stay at least 10 dB under the voice's phrase level while
  it speaks, capped at 10 dB extra. Measured extra: up to 10.0 dB for music and 9.9 dB for SFX.
- **While speaking:** the voice is a median 13.5 dB over the music (worst phrase
  6.3 dB) and 18.9 dB over the SFX (worst 11.9 dB).
- **In the pauses** (5 gaps of 0.5 s or more) the music comes up to a median 11.8 dB under the voice's speaking level.
- **The hard cut on "die":** music falls from -7.7 to -213.6 dB and SFX from -12.0 to -43.8 dB relative to the voice (only faint wind is left).
- **Pre-master:** levelled to −14 LUFS, then a true-peak limiter at −1.6 dBTP (max 3.9 dB
  of reduction, more than 0.5 dB on 4.56% of samples).
- **Loudnorm:** two passes (I −14, TP −1, LRA 15). Pass 2 ran in **linear** mode.

## Final mix (`audio/final_mix.wav`, copied to `public/audio/final_mix.wav`)

| Measure | Value |
|---|---|
| Integrated loudness | -13.8 LUFS |
| True peak | -1.3 dBTP |
| Loudness range | 3 LU |
| Format | pcm_s24le, 48000 Hz, 2 channels |
| Length | 3123200 samples = 65.0667 s (timeline 65.067 s, 1952 frames) |
| Sample peak | -1.30 dBFS |
| DC offset | 3.3e-5 / 4.3e-5 |
| Key check | F over F# in S4 is 31.9 dB; F# over F after 40.58 s is 41.9 dB; F# rises 47.4 dB across the change |
| Clicks | largest second-difference spike near any hit is 16.4× its local RMS (no hard discontinuities) |

## Balance per scene (integrated, final scale)

| Scene | Time (s) | Voice LUFS | Music LUFS | SFX LUFS |
|---|---|---|---|---|
| S1 He asked to see | 0.00–2.29 | -13.6 | -28.5 | -25.6 |
| S2 You will die | 2.29–5.84 | -14.4 | -26.4 | -27.2 |
| S3 Fire, plagues, sea | 5.84–10.49 | -13.2 | -23.4 | -24.7 |
| S4 The ask | 10.49–15.58 | -13.0 | -25.9 | -27.9 |
| S5 The answer | 15.58–19.40 | -13.3 | -26.4 | -28.2 |
| S6 The clift | 19.40–24.59 | -15.0 | -30.7 | -29.6 |
| S7 His back | 24.59–26.69 | -14.1 | -29.5 | -32.7 |
| S8 Coming down | 26.69–32.94 | -13.9 | -30.1 | -29.9 |
| S9 The camp | 32.94–38.13 | -13.6 | -30.0 | -35.2 |
| S10 The veil | 38.13–40.28 | -13.5 | -30.5 | -33.1 |
| S11 Centuries later | 40.28–47.04 | -13.7 | -27.1 | -27.4 |
| S12 No more hiding | 47.04–49.89 | -13.5 | -27.1 | -29.6 |
| S13 The face | 49.89–53.54 | -14.1 | -25.5 | -29.5 |
| S14 Call to action | 53.54–61.37 | -14.2 | -24.3 | -25.9 |
| S15 End card | 61.37–65.07 | — | -17.4 | -26.6 |
