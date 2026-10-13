# Claude launch film — name-change version

`claude_launch_film_namechange.mp4` is the supplied 44.93 s product-launch film
(1920×1080, 30 fps, 1,348 frames) with every appearance of the brand name "Jensei"
— on screen and in the narration — replaced by "Claude". All other pictures and sound
are the reference itself.

`namechange_vs_reference.mp4` stacks the reference (top) over the new version (bottom)
for a shot-by-shot comparison.

A fully redrawn version (new graphics, reference footage only for the real-world shots)
is being built separately.

## What changed

| Time | Frames | Reference | New version |
|---|---|---|---|
| 10.17–11.70 s | 306–352 | "Jensei" title after "Meet" | "Claude" title, same zoom, blur sweep and fade |
| 11.70–14.83 s | 352–445 | white "Jensei" label on the dashboard window | white "Claude" label, tracked with the window |
| 36.53–38.90 s | 1096–1167 | dark "Jensei" sidebar label (profile → analytics) | dark "Claude" label, tracked with the window |
| 42.23–44.93 s | 1268–1348 | closing "Jensei" wordmark | closing "Claude" wordmark |
| ≈10.2 s, 24.1 s, 42.4 s | — | narrator says "Jensei" | narrator says "Claude" |

## Typography

The reference logo is a humanist sans (Noto/Open Sans-style lowercase, weight ≈660) with
an enlarged initial capital (≈1.34× the body size). "Claude" is set the same way in
Noto Sans (SIL Open Font License): enlarged "C", lowercase "laude", same baseline,
x-height, stroke weight and violet-to-blue fill measured from the reference letters.

## How it was made

1. **Wordmarks** (`tools/wm_*.py`): the reference "Jensei" is fitted per frame (scale about
   an anchor, translation, and blur + colour gain at 12 positions across the word, which
   captures the letter-by-letter focus and highlight sweeps). "Jensei" is removed with a
   harmonic (Laplace) background fill and "Claude" is rendered through the identical
   per-frame parameters.
2. **Interface labels** (`tools/ui_*.py`): each window is tracked with a homography
   (ECC on a cropped template, SIFT + RANSAC fallback, re-localisation for low-confidence
   frames). Per frame the label is inpainted from the surrounding glass, the original
   label's blur kernel (gaussian / horizontal / vertical / diagonal motion), small
   shift/shear/scale and ink colour are fitted, and the typeset "Claude" is drawn
   through the same homography, kernel and colour. Edits are confined to a safe zone so
   neighbouring icons and text are never touched.
3. **Narration** (`tools/audio/`): vocals and music were separated locally (Demucs);
   the three brand words were re-voiced in the narrator's voice with F5-TTS speech
   editing and spliced back over the original accompaniment with short crossfades. The
   soundtrack is sample-identical to the reference outside those three windows
   (≈0.5–0.7 s each).
4. `tools/assemble.py` merges the passes, `tools/encode.sh` encodes H.264 (CRF 14) + AAC.

Scripts expect the reference frames extracted as PNGs; paths inside are those of the
working session.
