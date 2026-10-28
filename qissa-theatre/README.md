# Qissa Theatre: The Three Men in the Cave

A 1080×1920, 30 fps Instagram reel told as a folk-art string-puppet show. Everything you see and hear is made in code: SVG puppets, backdrops, captions and synthesized sound effects. The only recorded input is the voiceover.

Outputs: `output/qissa_three_men_in_the_cave.mp4` and `output/cover.png`.

## Pipeline

```
./build.sh            # needs ffmpeg, node + playwright, python3 (numpy, scipy, soundfile, pocketsphinx)
```

1. `align.py` force-aligns `script.txt` to `audio/voiceover.mp3` (PocketSphinx, bundled English model) and writes `timeline/words.json`/`words.js`. Captions always show the script's own words.
2. `js/timeline.js` turns word timings into scene boundaries and story events. The same module runs in the browser and in Node.
3. `index.html` + `js/*.js` build every scene once. `window.renderFrame(t)` poses the whole stage for time `t`.
4. `render.js` serves the folder, drives headless Chromium frame by frame and saves JPEG frames.
5. `audio/sfx.py` synthesizes rain, thunder, rock rumble/grind, the thud, cave drips, wind, crickets, birds, wooden clacks and the curtain whoosh. It ducks them under the voice. `audio/loudnorm.py` normalizes the mix to -14 LUFS.
6. ffmpeg joins the frames and the mix (H.264 + AAC).

## Script format

In `script.txt`, `{braces}` mark teal highlight words and `|` splits caption groups (2–6 words each). Line *n* drives scene *n*.

## Handy commands

```
node render.js stills --out /tmp/stills --every 2      # check frames every 2 s
node render.js stills --out /tmp/stills --times 12,52.5
node render.js cover --out output/cover.png
```

Sources: Sahih al-Bukhari 2272 · Sahih Muslim 2743.

Fonts in `fonts/` (Cinzel, Amiri, Aref Ruqaa) are from Google Fonts under the SIL Open Font License.
