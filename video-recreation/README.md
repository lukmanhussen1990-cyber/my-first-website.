# Claude promo clip — text swap recreation

Recreation of the 8.6s reference clip with exactly two text substitutions:

| Element | Reference | This version |
| --- | --- | --- |
| Model label in the composer | `sonnet 4.5+` | `Opus 5+` |
| Final scrambled-letter reveal | `Aevnt_fx` | `Imran` |

Everything else — background, bokeh, glow, logo, composer UI, camera moves,
typing, cursor, generated Python, code reveal, glitch timing, music and SFX —
is unchanged.

## Output

`output/claude-opus5-imran.mp4` — 720×720, 30 fps, 254 video frames (8.47s
video / 8.59s container), H.264 + the reference AAC audio stream copied through
untouched, so audio sync is identical by construction.

## Approach

Hand-animating a match for the reference was never going to land frame-for-frame,
so the pipeline instead composites **on the original frames**. For each frame it
locates the text, reconstructs the background behind it, and draws the
replacement with the same font metrics, blur, glow and brightness that were
measured off the reference. Every pixel outside the two text elements is
bit-identical to the source.

### 1. Measure the text (`calib.py`, `calib_end3.py`)

Fit a synthetic render to the reference text, solving for font, size, blur
sigma, glow radius and per-channel gain. The observed pixel is modelled as

    observed = background + a·G(mask, σ₁) + b·G(mask, σ₂)

clipped at 255, with saturated pixels down-weighted so the fit is not dragged by
clipping. Results:

* Composer label — Liberation Sans 17px @ scale 1.0, σ₁ = 1.1
* Ending word — Inter Display 51.9px @ scale 1.0, σ₁ = 1.2, glow σ₂ = 8.0

### 2. Track it (`track.py`, `track2.py`, `track3.py`, `label_track.py`)

The composer label is visible frames 48–179 while the camera pans and zooms
across two cuts, and it leaves the right edge of frame entirely for part of the
shot. Three multi-scale normalised-correlation trackers cover it:

* frames 48–52 — the word `sonnet` alone (the full label is clipped by the frame edge)
* frames 53–88, 138–179 — the full label
* frames 89–137 — the composer's bottom-left corner, plus the rigid label offset
  measured in UI space over the frames where both are visible

Tracks are smoothed within each shot, never across the cuts at 89/90 and 137/138.

### 3. Reconstruct the background (`fillutil.py`)

Naive approaches leave ghosts: a morphological background estimate still
contains the text's own glow, and a polynomial surface fit does not meet the
surrounding pixels, leaving a visible rectangular seam.

`pushpull_fill` instead does boundary-exact interpolation — a Gaussian-pyramid
push-pull fill refined with Gauss-Seidel iterations. Outside the mask it returns
the original pixels exactly, so a composited region has no seam by construction.
This dropped the composer-label residual RMSE from ~28 to ~14.

### 4. Composite (`composite_label.py`, `composite_end.py`)

The replacement is drawn with the gains fitted **from that same frame**, so it
inherits the reference's per-frame blur, brightness and glow automatically —
including motion blur ramps and fade-ins.

* `Opus 5+` is right-aligned to the old label's ink right edge, keeping the gap
  to the mic / send button identical.
* The ending is centred on the fitted centre of the reference word.

### 5. The ending glitch

The reference resolves by ASCII offset — every character counts down to the
target together:

    Eizrxcj| → Dhyqwbi{ → Cgxpvahz → Bfwou`gy → Aevnt_fx

with a crossfade between consecutive states (both strings overlap during a
transition) and opacity ramping up as it resolves. Schedule read off the
reference frames:

| Frames | Offset | Reference | This version |
| --- | --- | --- | --- |
| 221–222 | +4 | `Eizrxcj\|` | `Mqver` |
| 223–226 | +3 | `Dhyqwbi{` | `Lpudq` |
| 227–230 | +2 | `Cgxpvahz` | `Kotcp` |
| 231–233 | +1 | `Bfwou\`gy` | `Jnsbo` |
| 234–253 | 0 | `Aevnt_fx` | `Imran` |

Both the current and previous string are fitted per frame with independent
gains, so the crossfade is reproduced rather than approximated.

### 6. Encode (`encode.sh`)

254 PNGs at 30 fps, H.264 high profile, yuv420p, with the reference AAC stream
copied — not re-encoded.

## Notes

* The reference prompt reads `make me a game ;)` (semicolon), not `:)`. It was
  left exactly as in the reference, untouched.
* `sonnet 4.5+` carries a trailing `+` that is part of the composer chrome
  rather than the model name, so it was kept: `Opus 5+`.

## Reproducing

Needs the reference mp4, `numpy`, `opencv-python-headless`, `pillow`,
`imageio-ffmpeg`, and Inter (downloaded by `fonts.sh`).

    ./pipeline/run_all.sh /path/to/reference.mp4
