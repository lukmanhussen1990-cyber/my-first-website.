# Mix notes: Friend

Built by `npm run audio` (tools/synth/build_audio.mjs). It is deterministic: seeded noise and no
timers, so the same inputs always give the same file. Every hit comes from `src/beats.mjs`, so re-run
after changing beats or the timeline.

## Voice

edge-tts, en-US-AndrewMultilingualNeural at rate −5%, one clip per sentence (tools/build_voice.py), joined
with the brief's pauses: 0.3 s between sentences, 0.6 s after "Including Judas", 0.8 s before "But
notice", 1.0 s before "Friend, wherefore art thou come?", 0.7 s after "To the man betraying Him", and
1.0 s after "That's what Jesus was worth to him" for the coin to fall flat.

## Stems (48 kHz stereo, 32-bit float, at mix level before ducking)

- `audio/stems/music.wav`: pads, felt piano, a low cello-like D drone, strings, choir and a 4.6 s hall.
  - D minor until **48.93 s** ("That's who Jesus is"), then D major.
  - S4: one rising pizzicato note per dot; the 12th (Judas) falls to a low E-flat against D.
  - S6: tremolo strings grow to a low hit on "silver" (22.56 s).
  - S7: a low A when the scale settles level on "slave" (28.97 s).
  - S8 and S10 are near silence. S11 is a full second of silence, then one warm piano note on
    "Friend" (43.52 s) and a soft chord swell into the key change.
  - S13 rises warmly into "enemies"; S14 has lilting plucks, a soft frame drum and tambourine.
- `audio/stems/sfx.wav`:
  - Garden: crickets, wind in olive leaves, torch roar and crackle, the crowd's distant footsteps.
  - S1 and S10–S11: a slow heartbeat. S2: a reversed whoosh and tape chatter that stop on the landing.
  - Upper room: lamp crackle, room tone and a soft murmur of voices without words.
  - S3: robe and towel cloth, water poured into the basin, splashes and drips.
  - S4: a soft tick per dot; the 12th is darker with a tiny coin ting.
  - S6: one clink per coin (30). S7: the coins pour onto the pan, the scale creaks, the chain clanks and
    the scale settles. S8: one long spinning coin that wobbles faster and drops flat.
  - S14: a happy murmur and laughter without words, cups. S15: YES/NO pops, typing taps, heart pops.

## Loop seam

The garden, torches, pad and drone start 0.6 s before t = 0. That pre-roll is cross-faded onto the
last 0.6 s (from loopOut = 71.27 s), so the end flows into the start. Matching 8 ms
fades at both ends avoid a click on first play; at the loop point they make a 16 ms dip.

## Mix

- **Voice:** a gentle compressor (3:1, soft knee, −19 dBFS threshold, max 8.3 dB), centered.
- **Levels:** music sits 2.5 LU under the voice and SFX sit 6.5 LU under (gated).
- **Ducking from the voice:** 40 ms look-ahead, about 80 ms attack and 350 ms release. Music drops
  8 dB, ambience beds 10 dB and hits 5 dB.
- **Intelligibility guard:** music and SFX each stay at least 12 dB under the voice's phrase level while
  it speaks, capped at 10 dB extra. Measured extra: up to 10.0 dB for music and 10.0 dB for SFX.
- **While speaking:** the voice is a median 13.9 dB over the music (worst phrase
  11.2 dB) and 22.1 dB over the SFX (worst 12.6 dB).
- **In the pauses** (7 gaps of 0.5 s or more) the music comes up to a median 13.2 dB under the voice's speaking level.
- **The silence before "Friend":** music -215.7 dB and SFX (the heartbeat) -11.6 dB relative to the voice.
- **Pre-master:** levelled to −14 LUFS, then a true-peak limiter at −1.6 dBTP (max 0.0 dB
  of reduction, more than 0.5 dB on 0.00% of samples).
- **Loudnorm:** two passes (I −14, TP −1, LRA 15). Pass 2 ran in **linear** mode.

## Final mix (`audio/final_mix.wav`, copied to `public/audio/final_mix.wav`)

| Measure | Value |
|---|---|
| Integrated loudness | -13.9 LUFS |
| True peak | -1.6 dBTP |
| Loudness range | 2.4 LU |
| Format | pcm_s24le, 48000 Hz, 2 channels |
| Length | 3449600 samples = 71.8667 s (timeline 71.867 s, 2156 frames) |
| Sample peak | -1.64 dBFS |
| DC offset | 7.6e-5 / 7.3e-5 |
| Key check | F over F# in S9 is 33.4 dB; F# over F after 48.93 s is 35.4 dB; F# rises 41.0 dB across the change |
| Clicks | largest second-difference spike near any hit is 16.4× its local RMS (no hard discontinuities) |

## Balance per scene (integrated, final scale)

| Scene | Time (s) | Voice LUFS | Music LUFS | SFX LUFS |
|---|---|---|---|---|
| S1 Hook: the kiss | 0.00–4.83 | -13.9 | -27.0 | -31.5 |
| S2 Rewind | 4.83–6.84 | -14.2 | -28.8 | -25.6 |
| S3 The towel | 6.84–12.29 | -14.5 | -28.0 | -30.0 |
| S4 Twelve | 12.29–14.85 | -13.6 | -25.4 | -30.6 |
| S5 Judas | 14.85–19.82 | -13.2 | -28.8 | -31.7 |
| S6 The deal | 19.82–23.66 | -13.3 | -30.3 | -23.2 |
| S7 But notice | 23.66–29.68 | -13.7 | -31.3 | -23.7 |
| S8 Worth | 29.68–32.20 | -13.8 | -37.1 | -29.8 |
| S9 The garden | 32.20–38.28 | -14.4 | -28.3 | -35.3 |
| S10 The kiss | 38.28–41.37 | -14.0 | -40.6 | -26.3 |
| S11 Friend | 41.37–48.58 | -13.6 | -27.0 | -29.0 |
| S12 The same night | 48.58–53.14 | -14.2 | -25.4 | -41.1 |
| S13 Enemies | 53.14–58.01 | -13.4 | -26.3 | -30.7 |
| S14 Friend of sinners | 58.01–62.99 | -14.0 | -25.7 | -37.5 |
| S15 Call to action | 62.99–68.87 | -13.6 | -24.0 | -26.8 |
| S16 End card | 68.87–71.87 | — | -16.2 | -25.5 |
