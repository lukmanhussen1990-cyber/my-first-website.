# Reel Studio: field-journal science reels

A reusable template for vertical (1080×1920, 30 fps) Hindi science reels in the "vintage field journal + X-ray" style.

The style uses aged paper, big Anton titles (dark line plus red line), typewriter labels, tags, rulers, stamps, checklists, a magnifier, counters, X-ray scenes with glowing parasites, page-roll and scan transitions, a procedural sound design and a fixed **@speciman.files** watermark.

The first project, `projects/snail-disco-eyes/`, is a complete worked example.

## What you supply for a new reel
1. **Script:** `vo_script.json` holds one line of Hindi voiceover per scene (`id`, `vo`, optional `"optional": true`).
2. **Voice:** ElevenLabs takes, one MP3 per group of scenes (see `elevenlabs_paste.txt` in the example). The free Edge voice also works (`engine/tools/vo_edge.py`).
3. **Images:** GPT Image PNGs in `images/`, listed in `project.json`. Images that swap or crossfade on screen share a `"group"`, which gives them one shared crop box.

## Build steps
```bash
cd reel-studio
P=projects/my-new-reel            # copy projects/snail-disco-eyes as a starting point

# 1. voice -> one clip per scene + word timings (pauses tightened, speech never sped up)
python3 engine/tools/vo_split.py $P/vo_script.json $P/build/vo_el \
   --part $P/audio/part1.mp3:S01,S02,S03 --part $P/audio/part2.mp3:S04,S05 ...

# 2. images -> cut-outs, shared crop boxes, X-ray versions (+ pulse loops if configured)
python3 engine/tools/prep_images.py $P
python3 engine/tools/pulse_frames.py $P          # only if geometry.json has a "pulse" section

# 3. write scenes.js (choreography; cue things with s.w('word'))
#    check layouts quickly with a contact sheet of every scene:
python3 engine/tools/scene_sheet.py my-new-reel --vo vo_el --fracs 0.4,0.92

# 4. render: a fast preview first, then the final
node engine/render.mjs --project my-new-reel --vo vo_el --video build/preview_180p.mp4 --scale 0.16667 --crf 23
node engine/render.mjs --project my-new-reel --vo vo_el --video build/final_video.mp4 --workers 3 --crf 18

# 5. finish: mix (-14 LUFS), reel_final.mp4, reel_no_music.mp4, cover.jpg
python3 engine/tools/finish.py $P --vo vo_el --cover-time 5.2
```

## Writing scenes (`scenes.js`)
Each scene is `S('S07', { look: 'paper' | 'xray', transition: { type: 'cut' | 'scan' | 'curl' | 'whip' } }, (s) => { ... })`.

Times are in seconds from the scene start. `s.w('चिड़िया')` returns when that word starts in the voiceover, so everything stays in sync if the voice changes.

| helper | what it does |
|---|---|
| `s.sprite(name, {x, y, w, enter, path, crawl, bob, pulse, xray, flip, crop})` | an image (animal, leaf…), with slide-ins, crawl, pulse loop or its X-ray version |
| `s.title([line1, line2], {at: [t1, t2]})` | big Anton title, top-left; line 2 is red |
| `s.kicker(text)` / `s.type(text, {...})` | small typewriter labels typed letter by letter |
| `s.nameTag(name, latin)` / `s.hangTag(text, {anchor})` / `s.torn(text)` | red name tag, swinging tag on a string, torn-paper label |
| `s.ruler({...span, spanLabel})` / `s.bracket({a, b, label})` | measuring props |
| `s.checklist({items})` | options or status card with drawn X/✓, strike and red circle |
| `s.terminal(text, {wires})` / `s.stamp(text)` / `s.ticket({tearAt})` | terminal with progress bar, slamming stamp, film ticket |
| `s.magnifier({to, image or focus})` / `s.dayCounter({from, to})` / `s.monitor({text})` / `s.barChart({bars})` / `s.swatches({items})` | lens, flip counter, heart monitor, chart, colour chips |
| `s.glow({paths})` / `s.target({pos})` / `s.bigNumber(text)` / `s.cracks({x, y})` / `s.arrow({pts})` | X-ray glow tubes, red target rings, faded number, impact lines, dashed arrows |
| `s.camera([[t, scale, fx, fy], ...])` / `s.shake(t)` / `s.sfx(t, name)` | camera moves, impact shake, extra sounds |

Sounds come from the components automatically (typing, pops, slides, stamps, pens, flips…). The library is in `engine/tools/sfx.py`, all generated in code, so there are no licences to worry about.

## Requirements
Node 18+ with Playwright (Chromium), ffmpeg, Python 3 with `numpy scipy pillow soundfile pyloudnorm opencv-python-headless faster-whisper rembg[cpu] edge-tts`. The fonts are included in `engine/fonts` (open licences).
