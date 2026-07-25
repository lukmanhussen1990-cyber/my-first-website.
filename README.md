# SCP-3143 — Murphy Law (animated)

The still illustration, cut into moving parts and set to the track. Open
`index.html`, hit **PLAY**, and he breathes, blinks, nods to the beat and works
his cigarette.

There are two versions of the same animation:

| | file | notes |
|---|---|---|
| **Video** | [`murphy-law.mp4`](murphy-law.mp4) | 2:34, 684×1258, audio baked in — download and share |
| **Web page** | [`index.html`](index.html) | reacts to the music live, needs one click to start |

## How it works

The original drawing is a single flat JPEG, so the first job was taking it
apart. `assets/layers/` holds six pieces cut out of it:

| layer | what it is | moves? |
|---|---|---|
| `plate.png` | background — the figure's head, arm and smoke erased and painted over | no |
| `smoke.png` | the drawn smoke curl | drifts |
| `head.png` | hat, hair and face | tilts, bobs, blinks |
| `coat.png` | the coat and collar, drawn *over* the head | no |
| `hand.png` | hand, wrist and cigarette | rotates at the wrist |
| `sleeve.png` | sleeve and cuff, drawn *over* the hand | no |

Each moving piece is cut a little larger than it looks, so its edge stays
tucked under the static piece in front of it — the head runs on under the
collar, the hand under the cuff. That is why nothing tears when they move.
The holes left behind (the head against the sky, the hand against the wall)
are filled in on the plate, so there is never a ghost of the old pose.

The eye is not part of any layer: the lid is a shape drawn over the face in
CSS, clipped so it sweeps down over the eye and leaves the eyebrow alone.

**The beat.** The page runs the audio through a Web Audio analyser, watches
the 30–170 Hz band, and fires a pulse whenever the bass jumps above its own
running average. That pulse drives the nod, the zoom and a kick in the smoke.
The MP4 is rendered from the same motion model, with the beats found offline
by FFT — so the video and the page move alike.

## Running it

Any static server works, e.g.

```sh
python3 -m http.server 8000    # then open http://localhost:8000
```

Opening `index.html` straight off disk also works, but browsers refuse the
analyser on `file://` — the animation falls back to a fixed 124 BPM pulse.

## Credits

* Artwork: **zal**, 2022 — SCP-3143 "Murphy Law", from the SCP Foundation
  wiki (CC BY-SA 3.0).
* Track: **BROOKLYN BLOOD POP!** — Syko. Not mine; included here for this
  personal page only.
* Animation rig, page and renderer: this repo — see `tools/`.
