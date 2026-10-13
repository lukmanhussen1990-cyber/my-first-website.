# Claude launch film — name-change version

`claude_launch_film_namechange.mp4` is the supplied 44.93 s product-launch film
(1920×1080, 30 fps, 1,348 frames) with every appearance of the brand name "Jensei"
— on screen and in the narration — replaced by "Claude". All other pictures and sound
are the reference itself.

`namechange_vs_reference.mp4` stacks the reference (top) over the new version (bottom)
for a shot-by-shot comparison.

## Redrawn version (work in progress)

`claude_launch_film_redraw_v3.mp4` (48.43 s, 1,453 frames) is the current cut of the
redrawn film:

- **Opening:** the four-point sparkle is replaced by the orange Claude starburst, and the
  clouds open through a growing, turning triangle instead of the scalloped circle.
- **Claude UI:** the app window uses a Claude-style sidebar (coral New chat button, chats, projects,
  artifacts, code, starred, initials avatar). Claude's reply is set in a serif font and streams
  in word by word, with the starburst under the newest text.
- **Chat UI:** every chat box is a Claude-style composer: a rounded box with "+" and tools
  buttons, an "Opus 5.5" model picker and the coral send button with an up-arrow. It
  replaces the pill with a mic and a black send disc.
- **Redrawn scenes:** titles, chat pill, doctor cards and the "Claude" wordmarks are
  rebuilt as animated HTML/CSS. Real-world footage and backgrounds come from the
  reference, with the original text removed.
- **End credit:** "Built by Imran using Opus 5.5" plays at the end, over a ring-out of
  the music.

| Frames | Scene | Status |
|---|---|---|
| 1–60 | opening, Claude starburst, triangle reveal | redrawn |
| 61–250 | cloud chat | redrawn (Claude composer) |
| 251–350 | "right one" → "Meet Claude" | redrawn |
| 351–448 | dashboard window | name-change frames for now |
| 449–525 | "Build to move beyond generic healthcare search" | redrawn |
| 526–605 | typing the symptom | redrawn (Claude composer) |
| 606–718 | anatomy viewer | redrawn UI (Claude sidebar, buttons, Done, pointer) over the tracked window; anatomy model kept |
| 719–862 | processing lines | redrawn |
| 863–972 | Claude's reply | redrawn Claude chat (user bubble, serif reply streaming with the starburst, composer) over the tracked, scrolling window |
| 973–1090 | doctor cards, "right one" | redrawn |
| 1091–1167 | profile and analytics | name-change frames for now |
| 1168–1348 | closing lines, Claude wordmark | redrawn |
| 1349–1453 | end credit | new |

The redraw sources are in `redraw/`:

- `scenes/*/index.html`: one page per scene that draws any frame with `renderFrame(f)`.
- `shared/`: title-line animator, Claude composer, glass and icon components, and the
  Noto Sans logo font and Source Serif 4 for Claude's replies (both OFL). Inter (OFL) is used
  from the system.
- `s07_*.py`, `s09_*.py`: window tracking (SIFT homographies on the window frame, scroll by
  phase correlation), plate cleaning and compositing of the flat UI layer.
- `render.py`: renders a scene with headless Chromium.
- `assemble_final.py`: joins the scenes into one frame sequence.

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
