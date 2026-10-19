# Maa ki Lori — 9:16 reel drawn in code

A 55-second, 1080×1920 Instagram reel drawn entirely with the HTML Canvas API:
glowing line-art silhouettes, a navy star-filled sky, and warm diya light.

- **Maa:** gold outline; cotton saree, pallu over her head, low bun; older and slightly bent in scenes 6 and 8.
- **Beta:** blue-white outline; a baby, then a 5-year-old with messy hair and half pants, then a young man of 22 with a backpack.

## Files

| File | What it does |
| --- | --- |
| `lib.js` | Drawing library: glow renderer, posable character rig, sky, moon, town, rooftop props, diya |
| `scenes.js` | The 8 scenes and the 55 s timeline, cut to the song's lyric lines |
| `index.html` | Preview player: open it in a browser to watch, scrub or jump to a scene |
| `render.mjs` | Headless render to PNG stills and MP4 |
| `soundtrack.sh` | Edits the "Luka Chuppi" song to the reel and muxes it in (bring your own copy of the song) |
| `out/scene-1.png` … `scene-8.png` | One key frame per scene |
| `out/maa-ki-lori.mp4` | The full reel, silent (30 fps, H.264; not committed) |
| `out/maa-ki-lori-with-song.mp4` | The reel with the song (not committed) |

## Timeline and song sync

Song: "Luka Chuppi" (Rang De Basanti). One edit: 27.24–64.98 s of the song, crossfaded on the beat into 188.76–207.2 s.

| # | Scene | Reel time | Lyric |
| --- | --- | --- | --- |
| 1 | Lori — Maa rocks baby Beta, golden stars rise from her song | 0–6.4 s | intro |
| 2 | Hide and seek — Beta peeks from behind the saree, Maa counts | 6.4–10.8 s | *Luka chuppi bahut hui* |
| 3 | Found you — she pulls the saree aside, he jumps into her arms | 10.8–15.6 s | *saamne aa jaa naa* |
| 4 | Growing up — he grows from 5 to 22 as he walks, echoes trail behind | 15.6–24.4 s | *kahaan kahaan dhoondha tujhe, thak gayi hai ab teri maa* |
| 5 | Goodbye — he goes down the stairs and looks back, she waves with the diya | 24.4–29.8 s | *aaja saanjh hui, mujhe teri fikar* |
| 6 | Waiting — older Maa alone with the diya under a huge sky | 29.8–36.9 s | *dhundhla gayi dekh meri nazar, aa jaa naa* |
| 7 | Far away — city balcony, a golden thread runs to home | 36.9–45.6 s | *chanda tu hai kahaan, mere chanda tu hai kahaan* |
| 8 | Luka chuppi again — he covers her eyes, the diya blooms, camera rises to the moon | 45.6–55.4 s | *Luka chuppi bahut hui, saamne aa jaa naa* |

Rocking, footsteps and the lullaby stars follow the song's beat (103 BPM).

## Render

Needs Node, Playwright with Chromium, and ffmpeg.

```sh
cd reel
export NODE_PATH="$(npm root -g)"   # if Playwright is installed globally
node render.mjs stills              # out/scene-*.png
node render.mjs video 30            # out/maa-ki-lori.mp4 (silent)
./soundtrack.sh path/to/luka-chuppi.mp3   # out/maa-ki-lori-with-song.mp4
node render.mjs frames 0:50:1       # out/frames/ storyboard, one frame per second
```

To change a scene, edit its function in `scenes.js`. Scene lengths and still-frame times are in the `SCENES` table at the bottom of the file.
