# Partition 1947 reel — build pipeline

Everything is made in code: NASA Blue Marble satellite base, Natural Earth
borders, skia drawing, code-made music and sound effects, ffmpeg encode.

Data lives outside the repo (`$DATA`, e.g. the session scratchpad):

```
$DATA/ne/            Natural Earth 10m zips (countries, disputed areas, boundary lines, admin-1)
$DATA/bmng09/        NASA Blue Marble topo+bathy, September 2004 (21600x10800 + C1/D1 tiles)
$DATA/fonts/         Montserrat Black/ExtraBold/Bold/SemiBold
$DATA/voice_in/      part1..part12 voice recordings (any format)
$DATA/sprites/       GPT-image stickers (radcliffe_pen.png, ...) + chibi_boy.png
```

Steps (run from `engine/`):

```
python3 prep_geo.py $DATA/ne ../build/geo.pkl                 # map shapes (J&K one grey area, no LoC)
python3 basemap.py  $DATA/bmng09 $DATA/base 200409           # satellite layers in Mercator
python3 voice.py    $DATA/voice_in ../build/voice --tempo 1.05 # tighter pauses, even loudness
python3 align.py    ../build/voice ../build/timing.json      # word timings for captions
python3 audio.py    --out ../build/final_audio.wav --timing ../build/timing.json \
                    --voice-dir ../build/voice --voice-out ../build/voice_track.wav
python3 render.py   --base $DATA/base --geo ../build/geo.pkl --fonts $DATA/fonts \
                    --sprites $DATA/sprites --timing ../build/timing.json \
                    --audio ../build/final_audio.wav --out ../build/reel.mp4
```

`render.py --stills 1.2,11.7,...` renders single frames for checking.
The script and on-screen plan are in `SCRIPT.md`; image prompts in `PROMPTS.md`.
Scene choreography for every part is in `engine/story.py` (timed to words).
