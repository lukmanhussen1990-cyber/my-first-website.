# Stair-landing dance

A 15-second, silent, 720×1280 / 30 fps H.264 video. Seven original
characters dance on a two-level stair landing:

* three rounded dancers bounce and swing their arms on the floor;
* four slim dancers dance along the upper walkway behind a railing.

Everything is painted by code with rough, layered brush strokes: walls,
stairs, railings, shadows and characters. No video frames, 3D models, images,
fonts, text or watermarks are used. The action sits in a 720×800 panel with
black above and below. The scene cuts every eighth note between electric
yellow, magenta, neon green, deep blue, grey, silver and near-black versions
of the same painting, with brief black flashes. It ends on a deep-blue hold
with a slow push-in. Paint edges flicker a little on every frame while the
dancers move smoothly.

## Render

```bash
pip install -r requirements.txt && python stair_dance.py
```

This writes `stair_dance.mp4` (no audio track) in about 35 s on 4 cores.
`imageio-ffmpeg` supplies ffmpeg; set `FFMPEG=/path/to/ffmpeg` to use your
own.

| flag | what it does |
|------|--------------|
| `--out FILE.mp4` | output path |
| `--still 6.0` | render the frame at 6.0 s as a PNG |
| `--sheet` | PNG with every colour version side by side, plus a few moments of the dance |
| `--jobs N` | number of worker processes |

## Editing

Everything you are likely to change is at the top of `stair_dance.py`.

**Tempo and cuts (part 1).** `BPM` and `BEAT0` set the musical grid. The
defaults, 147.3 BPM with beat 0 at 0.124 s, were measured from the reference
cut times. `TIMELINE` is a list of `(eighth notes, colour version, shot)`,
played in order. `BAR` is the 8-cut colour cycle used by `bar()`. `FLASHES`
adds short pure-black flashes. `CAMERAS` defines the `close`, `wide` and
`push` shots. If your track has a different tempo, change `BPM`/`BEAT0` and
both the cuts and the dancing follow.

**Colours (part 2).** Each entry in `VERSIONS` needs one `key` colour. The
walls, floor, stairs and railings are shades of it. `accent` colours hats,
bows, ties and cheeks. `tint` and `dim` control how much the key colour and
darkness reach the dancers. Neutral character colours are in
`CHARACTER_COLOURS`.

**Choreography (part 3).** `MOVES` are loops of key poses placed in beats.
They set arm and elbow angles, foot lifts, lean, sway, squash, and a
groove/hop bounce. `DANCERS` places each character and gives it a
`routine`: a list of `(start beat, move)`, with an optional phase shift for
canons. By default each dancer has its own signature move:

| dancer | level | move |
|---|---|---|
| Plum (beanie) | floor | `sway`: side-to-side arm swing |
| Dot (bow) | floor | `raise_roof`: pumping arms overhead |
| Mo (glasses) | floor | `step_clap`: side steps with overhead claps |
| Reed (bob) | walkway | `disco_point` |
| Wick (cap) | walkway | `arm_wave` |
| Lark (bun) | walkway | `knee_runner` |
| Stem (spikes) | walkway | `twist` |

All seven hit a unison `star` pose as the wide shot opens. They finish with
`hop_finale` on the floor and a canon `wave_line` on the walkway. Legs use
two-bone IK, so feet stay planted while the bodies bounce, and moves blend
into each other over `BLEND` beats.

## Timeline

| time | shot | colours |
|---|---|---|
| 0 – 3.3 s | close on the rounded trio | green, yellow, blue, grey (held), magenta, silver … |
| 3.3 – 3.6 s | black flash | |
| 3.6 – 11.3 s | wide stair landing | a new version every eighth note, 2-frame black flashes on two downbeats |
| 11.3 – 15 s | deep-blue hold, slow push-in | |
