YOUR MODULE: SUBTITLES, TITLE CARD and END CARD as an ASS script burned in at the final encode with ffmpeg's libass:
  ffmpeg -i film.mp4 -vf "ass=out/subs/film.ass:fontsdir=assets/fonts" ...
Write render/subtitles.py (you own it) that reads timeline/timeline.json and writes out/subs/film.ass (PlayResX 1080,
PlayResY 1920) and out/subs/film.srt. Fonts available in assets/fonts: "Pixelify Sans" (Regular, Bold) and "Silkscreen".
Look at the reference subtitles (/tmp/claude-0/-home-user-my-first-website-/8e87b992-8f6b-5beb-bf81-e714aaa05691/scratchpad/ref/full_8.png, full_25.png, full_54.png, full_63.png): small speaker label ("JESUS"/"KNIGHT")
above large white pixel-font dialogue text with a dark outline, centred. Make ours larger and more readable for Reels:
- Dialogue: Pixelify Sans Bold ~64 px, white, 5-6 px dark warm-brown/black outline + soft shadow, max ~24 characters per line,
  balanced line breaks (no orphan words), max 3 lines; centred horizontally; vertical position inside the Instagram Reels safe
  area (keep text between y ≈ 1050 and y ≈ 1450 of 1920 and within x ≈ 90..990 — the bottom ~360 px and right ~140 px are covered
  by IG UI). Speaker label in Silkscreen ~30 px with letter spacing, JESUS in warm gold (#FFD37A), KNIGHT in steel blue (#A9C8E8),
  directly above the text block.
- Typewriter / word-synchronised reveal like the reference: each word appears exactly when spoken (cue.words[].s), with a short
  ~70 ms alpha fade-in, while the line layout stays stable (pre-layout full text; unrevealed words fully transparent via \alpha).
  The whole subtitle appears with the label at speechStart - 0.05, holds ~0.5 s after speechEnd (or until the next cue starts),
  then fades out over 0.2 s. Every spoken line must be on screen and synced — never skip one.
- Title card: "THE WARRIOR WHO COULDN'T FORGIVE" during the establishing shot (beats.establishStart + 0.25 for ~2.8 s),
  in the upper-middle area (y ≈ 520-700), Pixelify Sans Bold, warm off-white with a gold tint, strong outline, gentle fade, 2 lines.
- End card from beats.endCardStart to the end: the scene will be dimmed ~40% by the integrator. Show the verse
  (timeline.endCard.verse, centred, Pixelify Sans ~52 px, white, line breaks for balance, inside the safe area around y ≈ 700-1050),
  then the reference (timeline.endCard.reference) in orange (#F2A541) Silkscreen ~32 px below it (fade in +0.6 s), then the
  tagline (timeline.endCard.tagline) larger (~70 px, warm gold) around y ≈ 1250 (fade in +1.4 s). Everything fades with the film.
Validate visually: produce test stills by burning the ASS onto a 1080x1920 background at many timestamps (use ffmpeg with a
lavfi color source or a scaled reference frame as background, e.g. ffmpeg -f lavfi -i color=c=0x88aa66:s=1080x1920:d=61 ...
-vf "ass=...:fontsdir=assets/fonts" -ss T -frames:v 1 out/subs/test_T.png), Read them, and check: legibility, safe area,
balanced line breaks, word-reveal timing (e.g. mid-sentence frames show only the spoken words), label colours, title and end
card composition. Also report the font names libass actually used (check ffmpeg log for font fallback warnings).
