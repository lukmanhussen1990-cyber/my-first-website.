# Mix notes: Wheat and Weeds

Built by `npm run audio` (tools/synth/build_audio.mjs). It is deterministic: seeded noise and no
timers, so the same inputs always give the same file. Every hit comes from `src/beats.mjs`, so re-run
after changing beats or the timeline.

## Voice

The user's own recording (`audio/vo/user_full.mp3`), cut into one clip per sentence at its natural pauses
and joined again with the brief's pauses (tools/build_voice.py): 0.3 s between sentences, 0.6 s after "God
didn't plant the evil", 0.8 s before "But notice", 0.8 s after "who would be left?" and 0.6 s before the
last line. A 75 Hz high-pass clears the rumble under the voice.

## Stems (48 kHz stereo, 32-bit float, at mix level before ducking)

- `audio/stems/music.wav`: soft pads, felt piano, gentle strings, a low D drone, choir in the bright parts
  and a 5.4 s hall.
  - Night (D minor): a dark low pad, high shimmering strings, a felt-piano note as the hand opens, a low swell
    as the weeds burst up.
  - The storyteller and the sowing: warmer; a golden arpeggio on each throw of seed.
  - The enemy: a cold E-flat over D, low plucks on his steps.
  - "Pull them up?": tremolo and a ticking pulse build to the **NAY** at 30.35 s, which lands on a
    timpani hit; strain under the pull; a sad falling line as the wheat roots tear.
  - D minor until **47.54 s** ("He's not slow"), then a warm D major lift with the hourglass.
  - The Damascus road: a proud low march, then a huge bright swell for the light (57.38 s).
  - The harvest: the brightest moment, full D major with choir (64.06 s).
- `audio/stems/sfx.wav`:
  - Wind through the wheat that swells with the camera moves; crickets at night.
  - Seeds: a dull rattle and soft thuds for the black seed, a bright shimmer for the golden seed.
  - The enemy's soft footsteps going away and a cold low tone; the time-lapse rustle.
  - The NAY: a wooden stamp. Underground: roots creak, then tear with soil spilling.
  - A quiet low tone for each dark spot; falling sand in the hourglass.
  - Marching on gravel, the light's swell, the fall on dust; the lamp and paper sliding onto the pile.
  - The harvest: birds, a joyful murmur, sickle swishes. Soft taps, typing and heart pops for the question.

## Loop seam

The night's crickets, wind, pad, strings and drone start 0.6 s before t = 0. That pre-roll is cross-faded
onto the last 0.6 s (from loopOut = 75.63 s), so the end flows into the start. Matching
8 ms fades at both ends avoid a click on first play; at the loop point they make a 16 ms dip.

## Mix

- **Voice:** a gentle compressor (3:1, soft knee, −19 dBFS threshold, max 8.5 dB), centered.
- **Levels:** music sits 0.5 LU under the voice and SFX sit 5.5 LU under (gated).
- **Ducking from the voice:** 40 ms look-ahead, about 80 ms attack and 350 ms release. Music drops
  8 dB, ambience beds 10 dB and hits 5 dB.
- **Intelligibility guard:** music and SFX each stay at least 10 dB under the voice's phrase level while
  it speaks, capped at 10 dB extra. Measured extra: up to 10.0 dB for music and 10.0 dB for SFX.
- **While speaking:** the voice is a median 11.9 dB over the music (worst phrase
  6.6 dB) and 15.1 dB over the SFX (worst 7.5 dB).
- **In the pauses** (7 gaps of 0.5 s or more) the music comes up to a median 7.7 dB under the voice's speaking level.
- **The NAY:** the music rises 1.1 dB on the hit.
- **Pre-master:** levelled to −14 LUFS, then a true-peak limiter at −1.6 dBTP (max 3.6 dB
  of reduction, more than 0.5 dB on 6.81% of samples).
- **Loudnorm:** two passes (I −14, TP −1, LRA 15). Pass 2 ran in **linear** mode.

## Final mix (`audio/final_mix.wav`, copied to `public/audio/final_mix.wav`)

| Measure | Value |
|---|---|
| Integrated loudness | -14 LUFS |
| True peak | -1.4 dBTP |
| Loudness range | 2.6 LU |
| Format | pcm_s24le, 48000 Hz, 2 channels |
| Length | 3659200 samples = 76.2333 s (timeline 76.233 s, 2287 frames) |
| Sample peak | -1.40 dBFS |
| DC offset | -1.3e-5 / 6.7e-5 |
| Key check | F over F# in S4 is 20.4 dB; F# over F after 47.54 s is 20.3 dB; F# rises 34.0 dB across the change |
| Clicks | largest second-difference spike near any hit is 15.4× its local RMS (no hard discontinuities) |

## Balance per scene (integrated, final scale)

| Scene | Time (s) | Voice LUFS | Music LUFS | SFX LUFS |
|---|---|---|---|---|
| S1 Opening: the enemy sows at night | 0.00–4.58 | -13.2 | -24.5 | -25.6 |
| S2 The storyteller | 4.58–6.94 | -13.5 | -26.9 | -38.7 |
| S3 Good seed | 6.94–8.95 | -13.9 | -26.4 | -23.8 |
| S4 While men slept | 8.95–14.41 | -13.7 | -27.8 | -27.8 |
| S5 They look the same | 14.41–20.23 | -13.2 | -26.6 | -26.3 |
| S6 An enemy hath done this | 20.23–24.97 | -15.3 | -27.8 | -38.2 |
| S7 Pull them up? | 24.97–35.34 | -13.9 | -22.4 | -27.7 |
| S8 Grow together | 35.34–38.06 | -15.3 | -27.6 | -37.0 |
| S9 The hard truth | 38.06–47.44 | -14.5 | -29.0 | -30.2 |
| S10 Patient | 47.44–54.42 | -14.4 | -25.6 | -28.8 |
| S11 Saul | 54.42–62.87 | -14.4 | -26.6 | -26.6 |
| S12 Harvest | 62.87–65.39 | -15.2 | -23.8 | -24.5 |
| S13 Call to action | 65.39–73.23 | -14.6 | -24.2 | -20.0 |
| S14 End card | 73.23–76.23 | — | -16.3 | -14.3 |
