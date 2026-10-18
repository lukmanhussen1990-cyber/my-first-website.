# THE PATH — Asset manifest (Phase 2)

Every input the film uses, where it comes from, how it is licensed or handled, and how it was checked. Official brand files are **never committed**: this repository is public. `tools/fetch_brand.sh` restores them with checksum verification.

## 1. Official brand artwork (git-ignored, restored by `tools/fetch_brand.sh`)

| Asset | Local path | Source | SHA-256 |
|---|---|---|---|
| `duolingo` wordmark (Feather Green) | `assets/brand/duolingo_press_lockup.svg` | Duolingo press room static file `press.duolingo.com/2b2efbe1b1a37089bad6.svg` (the Duo-mark + wordmark lock-up) | `256a0c38…a3213` |
| Duo, front-facing standing pose | `assets/brand/duo_standing_front.svg` | Duolingo web app path character `d35aaqx5ub95lt.cloudfront.net/images/pathCharacters/active/a506d9752e476f9e29b898c8350e21c6.svg` | `5bd589a6…8cda5` |

**How they were found.**
- The brand site `design.duolingo.com` is now a design blog with no downloads.
- The press room's asset portal is hosted on Lingo and lists files only through a private API, which I did not reverse-engineer.
- Both files above are static files that Duolingo itself publishes and serves.

### 1.1 Wordmark
- The lock-up SVG holds two shapes: #0 is the Duo silhouette mark and #1 is the `duolingo` wordmark. The film uses **shape #1 only, untouched**. No path, color or proportion is changed.
- **Color:** the file declares `#58CC02` with a `color(display-p3 …)` override for wide-gamut browsers. The film is sRGB / BT.709, so it uses `#58CC02`, Feather Green from the brief. The reader skips CSS color values it cannot use, as browsers do.
- **Geometry:** 103.12 × 24.36 units, aspect **4.233 : 1**. The `o` is 13.14 units tall (53.9% of the mark).
- **Clear space:** Duolingo's written clear-space rule sits behind the press portal's private API. The film uses **one `o`-height on every side**, a conservative standard derived from the mark itself.

| Rest size | Pixels | Clear space |
|---|---|---|
| 16:9 | **700 × 166 px** | **89 px** |
| 9:16 | **720 × 171 px** | **92 px** |

These supersede the brief's estimate of 187 px wordmark height. The Phase 4 station layouts will use these numbers.
- **Pixel check:** rendered at the rest sizes, every fully opaque pixel is exactly (88, 204, 2), and no other value appears inside the shape.

### 1.2 Duo
- 19 flat-colour shapes in a 1080 × 1080 viewBox, no groups. Part map (shape indices):

| Part | Shapes | Pivot (artwork units) |
|---|---|---|
| app ground shadow, *excluded* (path-context art, not Duo; the film uses its own contact shadow) | 0 | — |
| feet | 1, 2 | feet contact (540.8, 709.3) |
| body | 3 | squash/stretch about the feet |
| wings | 4 (left), 5 (right) | shoulders (392.0, 488.0) / (687.6, 488.0) |
| face mask | 6 | — |
| belly marks | 7, 8, 9 | — |
| beak | 10 lower, 11 upper, 12 highlight | lower beak drops 10 units at `beak = 1` |
| eyes | 13–15 left, 16–18 right (white, pupil, highlight) | eye-white centers (462.9, 547.7) / (618.9, 547.7) |

- The rig (`engine/duo.py`) only transforms existing shapes, never adds, redraws or recolors anything. It covers:
  - volume-preserving squash and stretch;
  - blink (eye groups scale to 8%);
  - wing rotation about the shoulders;
  - beak drop.
  Review sheet: `out/review/duo_rig.png`.

### 1.3 Renderer validation (`engine/svg.py`, NumPy + OpenCV)

**Duo vs. librsvg (opaque pixels):**
- Mean difference 0.27 levels, 99th percentile 7 levels.
- The only larger differences sit on the seams between touching shapes. librsvg shows conflation hairlines there; this renderer composites at 4× and avoids them.
- In the 30%-alpha ground shadow, FFmpeg's librsvg output applies the alpha twice. This renderer produces the mathematically correct blend.

**Lock-up vs. librsvg:** mean difference 0.46 levels.

## 2. Fonts

| Font | Path | License | Status |
|---|---|---|---|
| **Nunito** (variable, wght 200–1000) | `assets/fonts/nunito/Nunito[wght].ttf` + `OFL.txt` | SIL Open Font License 1.1, committed | **In use** as the stand-in for SF Pro Rounded |
| SF Pro Rounded | `assets/fonts/licensed/` (git-ignored) | Apple license limits use to UI mock-ups for Apple platforms | Not available. Apple's download returns HTTP 403 from this environment |

Nunito checks (Pillow 12.3 with Raqm 0.10.5 / HarfBuzz 14.2.1 / FreeType 2.14.3):
- Variable weight reaches the shaper, so advances change with weight.
- Digits are **tabular by default** (all 0.60 em), giving fixed digit cells for `365`, XP and ranks.
- All Spanish glyphs are present (¡ ¿ á é í ó ú ñ ü), and so is π.
- ♪, ♞ and ✓ are absent, so they are drawn as custom vector glyphs.

Weight mapping from the brief's roles:

| Role | Nunito weight |
|---|---|
| Heavy | 900 (π glyph 1000) |
| Bold | 800 |
| Semibold | 700 |
| Regular | 500 |

Specimen: `out/review/type_specimen.png`.

## 3. Supporting graphics (designed in code: `engine/graphics.py`)

All vector, so the engine can texture them or extrude them into chunky 3D slabs. Board: `out/review/graphics_board.png`.

- **Flags (8)**, on rounded 4:3 tiles that orbit the Languages node:
  - Spain (civil ensign), France, Japan, Germany, Italy;
  - Korea (taegeuk with trigrams), Brazil (rhombus, disc, band), China (stars on the official grid).
- **Course glyphs:**
  - a globe for Languages;
  - π from Nunito's own glyph for Math;
  - a custom ♪ for Music;
  - a custom chess knight for Chess, with ear, eye and base.
- **Icons:** lesson star, streak flame (outer and inner), crown, Diamond League gem, speaker, microphone, camera, hang-up handset, checkmark.
- **UI pieces:**
  - lesson node (unlit, lit, pressed);
  - START tooltip;
  - dark-mode word tiles;
  - CHECK button (inactive, active);
  - progress bar (track plus fill; in the film the fill is the green line);
  - week-row days (filled, empty);
  - initial avatars with fictional initials.
- The one off-palette accent is the hang-up red `#FF4B4B`. It is optional and can be removed for strict palette discipline.

## 4. Sound effects (procedural: `audio/synth.py`, `audio/sfx.py`)

- **All 114 cues** from `brief/timeline.json` are synthesized deterministically in NumPy at 48 kHz, in about 2 s.
- **Tuning:** pitched cues are in D major.
  - Node lights rise D5 → E5 → F♯5 → A5 → B5.
  - Tile snaps climb D–E–F♯–A–B.
  - The week row climbs the scale.
  - Course lights ring D6, F♯6, A6, D7.
- **Hero sounds are original, not Duolingo's audio:**
  - **Correct-answer chime:** a quick D-major flourish F♯5–A5 landing on D6, glassy mallet over a soft body, with a short sparkle.
  - **Lesson-complete fanfare:** D5–F♯5–A5 pickups into a held D6 / A5 / F♯5 triad, FM brass-bell voice, low D hit and sparkle, in key with the final D add9 chord.
- **Checks:** every cue is finite, its first and last samples are silent, and it peaks at its layer's nominal level.

  | Layer | Nominal peak |
  |---|---|
  | hero | −3 dBFS |
  | impact | −4 dBFS |
  | whoosh | −8 dBFS |
  | path | −11 dBFS |
  | UI / character | −12 dBFS |
  | texture | −14 dBFS |

  The Phase 4 mixer sets final levels against the VO and music.
- **Review files (git-ignored, regenerated by `tools/sfx_reel.py`):**
  - `out/review/sfx_reel.m4a`: every cue in order, with `sfx_reel_index.txt`.
  - `out/review/sfx_timeline.m4a`: all 114 cues placed at their exact film frames over 21.2 s (no music, no VO).
  - `out/review/sfx_spectrograms.png`.

## 5. Environment

- Python 3.13 with a project virtualenv: `python3 -m venv --system-site-packages .venv && .venv/bin/pip install -r requirements.txt`.
- Pinned packages: OpenCV `opencv-python-headless==4.12.0.88` and NumPy `2.2.6`.
- Pillow 12.3.0 comes from the system and has text shaping. FFmpeg is 6.1.1.
