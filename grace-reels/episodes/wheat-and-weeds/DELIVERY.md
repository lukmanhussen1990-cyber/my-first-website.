# Delivery: Wheat and Weeds (Grace in Motion, idea 68, 100% code)

Everything on screen was drawn in code: the characters are SVG parts rigged as cut-outs, the world is
low-poly geometry, the field is tens of thousands of instanced wheat stalks, all rendered with Remotion
and three.js. No GPT Image, no downloaded pictures.

## Files

| File | What it is |
|---|---|
| `out/reel_wheat-and-weeds.mp4` | The reel at full quality: 1080×1920, 30 fps, 2287 frames (76.23 s), H.264 CRF 18 yuv420p, AAC 256 kb/s 48 kHz stereo, 294 MB |
| `out/reel_wheat-and-weeds_under20MB.mp4` | The same reel for upload limits: two-pass H.264 at 1.85 Mb/s + AAC 128 kb/s, 1080×1920, 18.8 MB |
| `out/cover_wheat-and-weeds.png` | Cover, 1080×1920: the moonlit field, the weeds risen, the hooded shadow walking away; title and MATTHEW 13:29 inside y 240–1680 |
| `out/caption_wheat-and-weeds.txt` | Caption: hook line, three short lines, 1 Timothy 1:15 as the closing line, "Ready or not yet? 👇", five hashtags |
| `out/stills/*.jpg` | Ten check stills from the final reel and a contact sheet |
| `KJV_CHECK.md` | Every quote, card and label checked against the KJV |
| `audio/MIX_NOTES.md` | How the music, sound effects and mix were made, with the measured checks |

## Checks on the final reel

| Check | Result |
|---|---|
| Size and rate | 1080×1920, 30 fps, 2287 frames, 76.23 s |
| Loudness | −14.0 LUFS integrated, true peak −1.0 dBTP, LRA 2.6 LU |
| Voice | The user's own recording, cut per sentence and re-timed with the brief's pauses; transcribed again after the build: 196 of 198 words matched, mean timing error 0.03 s |
| Subtitles | Word-timed from the recording; keywords pop in gold capitals |
| Under-20 MB copy | 18,826,901 bytes, 1080×1920, 30 fps |
| Safe zones | Captions y 240–600, meter y ≈ 650, cards and buttons above y 1450, nothing important right of x 960 |
| Loop | The end card dissolves back into the night field and the hand before the throw; the audio pre-roll is folded onto the end |

## Known limits

- Rendering is CPU-only here (about 3.5 s a frame), so the full render takes about 2.5 hours.
- The WEEDS counter is charcoal with a thin gold edge, as the brief asks; on the night shots it is quiet.
- During the white-out at the Damascus light the subtitles sit on a very bright picture (a warm scrim keeps
  them readable).
- The "AN ENEMY" tag in S6 sits near the left edge of the frame.
