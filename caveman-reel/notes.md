# Reference study + timing plan — "Delivering the Nuclear Power Plant"

## Inputs
| file | what | specs |
|---|---|---|
| `refA` (cream/deodorant caveman reel) | style reference 1 | 720x1280, 30 fps, 41.65 s, AAC 96 kHz |
| `refB` (Odd Tilt rotisserie reel, ends on cooling towers) | style reference 2 (the "his video" being parodied) | 720x1280, 30 fps, 39.56 s |
| `clever_odd.mp3` | ElevenLabs voiceover (used as-is) | mono 44.1 kHz, **28.68 s** (speech 0.09 s to 28.59 s), so no trimming/speed-up needed (< 29.6 s) |
| tower photos (sent mid-job) | real cooling towers: hyperboloid shell, V-leg ring at the base, panel lines, rain streaks, billowing plume | |
| previous attempt screenshot | what to avoid: plain white towers, blob-sphere steam, MakeHuman logo t-shirt; confirms caption at ~60 % and `@garden_reels` at ~80 % height | |

## What the references do
**Look.** MakeHuman characters in Blender (EEVEE-like). refA caveman: plain young MakeHuman face, pale smooth skin, light blue-green eyes, long straight very dark-brown centre-parted hair over the ears and behind the shoulders, orange-brown "fur" collared shirt and trousers with big dark-brown spots, no beard. World: bright green meadow with grass tufts, big rounded grey boulders with a spotty texture, cartoon "broccoli" trees (brown trunks, lumpy green canopies), flowering bushes, soft green hills, clear light-blue hazy sky. Midday light, soft shadows, saturated colours, low contrast.

**Shot lengths.** Cuts detected with `scdet` (refA): 0, 2.77, 4.30, 6.70, 9.27, 13.60, 17.17, 18.80, 22.80, 25.60, 29.20, 31.30, 32.67, 38.27 s. Shots last 1.4 to 5.6 s, about 3 s on average. refB is similar (1.5 to 6 s), with quick punch-ins on jokes. A new shot usually starts on a new sentence or joke beat.

**Camera.** Mostly locked-off or slow push-ins at chest/face height. There are some low angles and close-ups of hands/props, and hard-cut punch-ins (wide to close-up) on punchlines. No shaky cam. Vertical framing keeps the subject in the upper-middle third so the captions at 60 % don't cover faces.

**Hook (first second).** refB opens on an extreme close-up gag (heart eyes + prop in mouth) with the first caption on frame 1. refA opens on the character mid-action. Both have an image and a caption in the very first frame, with no fade-in.

**Captions.** Poppins Bold (rounded geometric sans), white fill, thin dark outline (about 2 px at 720p), soft dark drop shadow. Sentence case, punctuation kept, emphasis in CAPS ("You LOVE"). 1 to 3 words per caption, hard cuts, synced to word onsets. Centred horizontally; vertical centre at **60.0 % of frame height** (measured 59.8 to 60.3 % on 8 frames). Text height (ascender to descender) is about **2.2 to 2.8 % of frame height**, i.e. about 42 to 54 px at 1920.

**Watermark** (from the previous-attempt screenshot): `@garden_reels`, small, white, semi-transparent, centred at about 80 % height, on screen the whole video.

**Audio.** Voice up front, light SFX (sparkle/ding, whooshes), very quiet or no music.

## Voiceover word timings
Whisper large-v3 (faster-whisper) transcribed the voiceover perfectly. Its word starts drifted by up to 0.35 s after pauses, so the final timings come from a Kaldi (Vosk en-us 0.22 lgraph) forced alignment constrained to the script. I cross-checked them against the RMS energy envelope; onsets agree within about 30 ms.

```
the 0.09  odd 0.33  tilt 0.63  didn't 0.99  bring 1.32  back 1.53  the 1.77  nuclear 1.86  power 2.22  plant 2.58
in 2.88  his 2.97  video 3.06 | but 3.96  you 4.17  LOVE 4.44  nuclear 4.95  power 5.40 | so 6.09  you 6.36  being 6.96
a 7.29  genius 7.35  caveman 7.86 | carry 8.76  the 9.12  whole 9.21  cooling 9.66  tower 10.05  to 10.38  his 10.56  house 10.68
| but 11.52  it 11.88  won't 12.03  fit 12.24  through 12.48  the 12.63  door 12.75 | so 13.44  you 13.83  try 13.98  the 14.19
window 14.31 | Clever 14.91 | except 16.02  it's 16.41  even 16.56  smaller 16.86 | so 17.88  you 18.27  shove 18.45  it 18.78
down 18.87  the 19.08  chimney 19.17 | now 19.89  the 20.25  chimney 20.37  is 20.79  gone 20.91 | so 21.57  you 21.99  just 22.11
plant 22.32  it 22.71  in 22.80  his 22.92  yard 23.01  and 23.37  plug 23.46  it 23.73  in 23.82 | lights 24.30  on 24.72
| you're 25.32  welcome 25.59  and 26.46  enjoy 26.82  your 27.30  new 27.45  third 27.66  arm 28.11 (ends 28.59)
```

## Shot plan (30 fps, frame f shows time (f-1)/30; the video is 900 frames = 30.0 s)
| # | frames | time (s) | line | content |
|---|---|---|---|---|
| 1a | 1-66 | 0.00-2.20 | The Odd Tilt didn't bring back the nuclear | HOOK: low angle, wooden mailbox "theoddtilt" in the foreground; the caveman hauls a giant steaming cooling tower up over the crest on a rope behind it |
| 1b | 67-118 | 2.20-3.93 | power plant in his video… | cut to the caveman holding a stone-framed "phone" showing a landscape with no power plant, annoyed |
| 2 | 119-182 | 3.93-6.07 | but you LOVE nuclear power. | close-up, glossy red heart eyes pulse on "LOVE", hugging a tiny toy cooling tower, sparkles |
| 3 | 183-262 | 6.07-8.73 | So you, being a genius caveman, | finger taps temple, smug grin, sparkle "ding" on "genius" |
| 4 | 263-345 | 8.73-11.50 | carry the whole cooling tower to his house. | wide: tower on his back, legs shaking, sweat drops, heavy footsteps, arriving at the house |
| 5 | 346-403 | 11.50-13.43 | But it won't fit through the door. | tower jammed in the doorway, pushing with his whole body, frame creaks |
| 6a | 404-447 | 13.43-14.90 | So you try the window. | swings the tower up to the tiny window |
| 6b | 448-480 | 14.90-16.00 | Clever! | punch-in: smug close-up |
| 7 | 481-536 | 16.00-17.87 | Except it's even smaller. | tower stuck, glass cracks, shrug to camera |
| 8a | 537-596 | 17.87-19.87 | So you shove it down the chimney. | on the roof shoving it down the chimney |
| 8b | 597-647 | 19.87-21.53 | Now the chimney is gone. | chimney crumbles into a soft dust cloud; he looks at camera |
| 9a | 648-701 | 21.53-23.37 | So you just plant it in his yard | tower planted in the yard with a thump |
| 9b | 702-729 | 23.37-24.27 | and plug it in. | close-up: bright yellow cable plugged into the wall (click on "in") |
| 10 | 730-760 | 24.27-25.30 | Lights on! | every window lights up warm, steam puffs, big fist pump |
| 11 | 761-900 | 25.30-30.00 | You're welcome… and enjoy your new third arm. | close-up, heart eyes back, green glowing third arm pops out of the chest on "third arm", waves goodbye with a bounce to the end |

Caption groups (each starts 1 frame before its first word and hard-cuts to the next): The Odd Tilt / didn't bring back / the nuclear / power plant / in his video... / but you / LOVE / nuclear power. / So you, / being a / genius / caveman, / carry the whole / cooling tower / to his house. / But it won't / fit through / the door. / So you try / the window. / Clever! / Except it's / even smaller. / So you shove / it down / the chimney. / Now the chimney / is gone. / So you just / plant it / in his yard / and plug / it in. / Lights on! / You're welcome... / and enjoy / your new / third arm.

## How this version improves on the references
Cycles path tracing with OpenImageDenoise, an HDRI sky with a sun aligned to the HDRI's sun, real grass geometry and displacement, volumetric steam/dust, depth of field on close-ups and haze on wides. Strand hair that follows the head and face. A full IK rig with finger curls and 52 ARKit face shapes for expressions plus voice-driven mouth movement. Anticipation, overshoot and eased motion; punch-ins on jokes.
