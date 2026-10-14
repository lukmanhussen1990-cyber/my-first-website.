# Claude launch film — name-change version

`claude_launch_film_namechange.mp4` is the supplied 44.93 s product-launch film
(1920×1080, 30 fps, 1,348 frames) with every appearance of the brand name "Jensei"
— on screen and in the narration — replaced by "Claude". All other pictures and sound
are the reference itself.

`namechange_vs_reference.mp4` stacks the reference (top) over the new version (bottom)
for a shot-by-shot comparison.

## Redrawn version

`claude_launch_film_redraw_v15.mp4` (48.43 s, 1,453 frames) is the redrawn film; every
scene is now rebuilt. It is made to play on loop: the last frame leads straight into the first.

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
- **Claude thinking (processing scene):** Claude visibly works on the real anatomy model from the previous shot: a scan
  brings the back from grey to colour, the lower back is pinned in coral, and lines map it to the muscles it works with,
  beside the editorial status text.
- **Closing sky:** the ending (statement, Claude lockup, credit) plays over the client's sunset photograph as one
  continuous shot (`shared/sky.js`, plate from `sky_plate.py`): the camera pushes slowly toward the sun, a soft
  shade keeps the type readable, and through the finale the sun goes down (a crossfade to a dusk grade of the same
  photograph while the camera tilts up and the sun sinks out of frame).
- **Seamless loop:** at the end the credit pops off, the wordmark folds back into the mark, night falls from the
  top of the frame to the opening's navy, and the mark returns to the centre and winds down into the point of light
  the film opens on: the same mark, colour, place and spin rate as the first frame, so the film repeats without a
  visible cut. The sound wraps too: a reverse-reverb swell of the opening "ahh" rises into the last frame and the
  "ahh" itself starts on the second frame.
- **Opening "ahh":** the solo sung note that opens the "Introducing Claude Opus 5.5" film, cut from that film's
  soundtrack where it plays alone and tuned from F#4 to G4 to sit in this film's key, now opens the film as the
  starburst blooms.
- **Hero statement:** "Because the right diagnosis / starts with the right direction" builds word by word with the
  narration into one two-line serif composition, the key words in Claude coral and an arrow drawn under "direction".
- **Claude logo reveals:** at "Meet Claude" and in the finale the coral mark turns in and the wordmark wipes out
  beside it in reading order: no flashes or glows, just the lockup and precise easing.
- **Sound:** synthesised sound design synced to the picture (soft whooshes on transitions, a warm thump and bell
  chord on the two Claude reveals, key and click ticks on the typing and buttons, faint ticks under the decode
  effects, a warm pad and chime under the end credit), ducked under the narration and mastered to -14 LUFS.
- **Futuristic "right one":** both "right one" titles decode out of flickering machine glyphs
  with a red/cyan RGB split and a light beam riding the lock front. On the dark title, HUD
  brackets lock onto the words and "MATCH FOUND" types in; over the doctor cards, targeting
  brackets lock onto Dr. Imran Hussain's card, a scan line passes over it and a "Best match" chip
  pops onto the photo.
- **"Build to move beyond generic":** letters rise out of a baseline mask, "move" sweeps in with
  motion blur, "beyond" carries a violet-to-coral gradient and a glowing underline that shoots past
  the word, and "generic" resolves out of a frosted loading-skeleton pill in plain grey; a glint
  crosses the sentence before it lifts away into the search.
- **Dr. Imran Hussain:** the second doctor card and the doctor profile page show Dr. Imran Hussain
  with his photo. On the profile page the name, breadcrumb, photo, e-mail (a placeholder,
  `dr.imranhussain@example.com`) and About text are put into the real footage: the card is tracked
  frame by frame, each old item is filled from its surroundings, and the new one is added with the
  footage's own blur, motion smear and fade.
- **End credit, Hello Kitty style (client request):** after the Claude lockup, a heart opens out of the centre into
  the client's Hello Kitty wallpaper and the lockup takes on a sticker outline. "Built by Imran using Opus 5.5" pops on
  as a cute sticker (letters in Fredoka hop on one by one, the i's dotted with hearts, a polka-dot bow on the corner),
  and the client's winking Hello Kitty pops up from behind it, sways and hops while hearts float up and stars twinkle.
  She ducks away and the sticker pops off as night falls into the loop. Cute sounds to match (a twinkle as the heart
  opens, a pop, a toy-piano note per word, Kitty's bloops). Hello Kitty is (c) Sanrio; the two images were supplied by
  the client and are not included in this repository.

| Frames | Scene | Status |
|---|---|---|
| 1–60 | opening, Claude starburst, triangle reveal | redrawn; the opening "ahh" sounds as the starburst blooms |
| 61–250 | cloud chat | redrawn (Claude composer) |
| 251–350 | "right one" → "Meet Claude" | redrawn; "right one" decodes from machine glyphs, HUD brackets lock on and "MATCH FOUND" types in; on the narrator's "Claude" the coral mark turns in and the white wordmark wipes out beside it in reading order |
| 351–445 | dashboard window | redrawn UI over the real background and glass; livelier per-letter headline (drop-in, light sweep, flowing gradient, glow, staggered exit) |
| 446–525 | "Build to move beyond generic healthcare search" | redrawn; "Build to move beyond generic" is a kinetic title (mask rise, motion-blur sweep, gradient hero word with an overshooting underline, skeleton-to-word "generic", glint, wave exit); "healthcare" ripples in, then a compact frosted-glass search field opens beside it (soft shadow, focus ring), a gradient magnifier draws itself, "search" is typed behind a soft caret, a sheen crosses the glass and a violet-to-coral progress line runs along its base |
| 526–605 | typing the symptom | redrawn (Claude composer) |
| 606–718 | anatomy viewer | redrawn UI (Claude sidebar, buttons, Done, pointer) over the tracked window; anatomy model kept |
| 719–862 | processing lines | a product-film shot on the real 3D anatomy model (cut from the anatomy-viewer footage): a scan plane brings the back from grey to colour, the lower back warms in Claude coral with a ring and a label, then a line drawn under "connections" flows from the text into the spot and the map blooms from it to the erector spinae, trapezius, latissimus dorsi and gluteus maximus; the editorial status text ("CLAUDE IS THINKING", serif headline, words rising out of masks) sits on the left |
| 863–972 | Claude's reply | redrawn Claude chat (user bubble, serif reply streaming with the starburst, composer) over the tracked, scrolling window; the redrawn UI takes on the footage's measured focus blur |
| 973–1090 | doctor cards, "right one" | redrawn over the reference light field (cards and titles removed); the centre doctor is Dr. Imran Hussain; futuristic "right one" with a targeting lock on his card and a "Best match" chip |
| 1091–1167 | profile and analytics | "Right outcome" redrawn; the profile footage now shows Dr. Imran Hussain (name, breadcrumb, photo, e-mail, About), tracked and blur-matched through the fast scroll |
| 1168–1267 | closing lines | over the client's sunset photograph (slow push toward the sun, a soft shade behind the type), the hero statement: words rise out of masks as the narrator says them in a large serif, "right" semibold and "diagnosis" / "direction" in Claude coral built letter by letter; the first line glides up so the whole sentence ends on screen as one composition, and a fine coral line under "direction" resolves into an arrow pointing forward |
| 1268–1453 | Claude lockup, end credit, loop | one continuous shot on the same sunset sky: the coral mark turns in and the wordmark wipes out beside it; a heart opens into the client's Hello Kitty wallpaper, the lockup lifts with a sticker outline, the credit pops on as a cute sticker and the client's Hello Kitty pops up from behind it; then she ducks away, the sticker pops off, night falls to navy, the wordmark folds back into the mark and the mark winds down into the opening's point of light (loop point) |

The redraw sources are in `redraw/`:

- `scenes/*/index.html`: one page per scene that draws any frame with `renderFrame(f)`.
- `shared/`: title-line animator, Claude composer, glass and icon components, and the
  Noto Sans logo font and Source Serif 4 for Claude's replies (both OFL). Inter (OFL) is used
  from the system.
- `uimask.py`: renders a scene's redrawn foreground alone; its alpha marks exactly where the
  original graphics sat, so `s04_plates.py` and `s10_plates.py` fill only those pixels and keep
  the real glass and light-field gradients. `s11_plates.py` cleans the profile scene's title.
- `s07_refine.py`: masked ECC refinement of the anatomy-viewer window tracking.
- `shared/brand.js`: the Claude lockup reveal used by both logo moments. `wm_plates.py` cleans their backgrounds.
- `s08_model.py`: cuts the anatomy model out of the footage (colour key, edge clean-up) for the thinking shot.
- `sound_design.py`: synthesises the effects, places the opening "ahh" and its reverse swell at the loop point,
  ducks the effects under the narration, mixes and masters the soundtrack.
- `sky_plate.py`: prepares the client's sunset photograph (upscale, grain) and its dusk grade for `shared/sky.js`.
- `hk_assets.py`: prepares the client's Hello Kitty wallpaper and cuts their Hello Kitty image out of its pink
  background for the credit. `shared/fonts/Fredoka-*.woff2`: the credit's rounded face (SIL Open Font License).
- `shared/hud.js`: the decode title and HUD brackets used by both "right one" moments.
- `s11_*.py`, `textr.py`: the profile-page doctor swap. `s11_track.py` / `s11_refine*.py` track the page
  (SIFT, then masked ECC on static content), `s11_calib.py` fits the original fonts, `s11_edit.py` builds the
  edited page, `s11_comp.py` puts it into each frame with the measured blur and fade, and `s11_minicard.py`
  fixes the small card seen through the white mist.
- `s09_blurfit.py`: measures the reply scene's focus blur so the redrawn UI matches it.
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
