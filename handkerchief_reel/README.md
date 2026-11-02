# "You're homeless" — handkerchief reel

Instagram Reel, 9:16, 1080x1920, 30 fps, 73.7 s, 41 shots (about 1.8 s each, like the last reels).
Goofy start (bush, limo, rich lady, "Shut up."), then a sweet love-story timeline (DAY 1, MONTH 3, YEAR 1,
50 YEARS LATER). Same look as the last reels: low-poly PS1 / Roblox 3D, white Pixelify Sans captions in the
centre (57.5 % height), stink lines, sweat drops, sparkles and floating hearts added in the edit.

## Status

1. Voiceover: done — the user's own recording (`audio/voiceover_src.mp3`), nothing regenerated.
2. Shot plan + prompts: done — `prompts.md` (character sheets + 41 ChatGPT prompts + 6 Kling prompts).
3. Waiting for the user's images (`images/shot_01.png` ...) and Kling clips (`clips/shot_04.mp4` ...).
4. Then: build `final.mp4`.

## Voice

- `make_voiceover.py` cuts the take into the 42 script lines at the real silences (STT check with
  `stt_words.py`, HINT=1: every word matches the script) and keeps the user's own pacing (gaps evened to
  0.30–0.55 s). Longer pauses for timing: 0.95 s after "Shut up." (the bodyguard's "boop"), 1.05 s before
  "What you don't know:", 0.80 s before "First date." and "Fifty years later.", 1.10 / 0.75 / 0.85 s before
  the last three lines. Output: `audio/voiceover.wav` (+ `.mp3`), `audio/vo_lines.json`.
- `make_captions.py`: 2–4 word captions, each appears 10–40 ms before its word (pocketsphinx alignment +
  energy snapping). Lines spoken with no break between them ("…someone's face / in about a tenth…") are
  split at the real gap, not inside a word. Output: `audio/captions.ass`, `audio/word_onsets.json`.

## Files

| | |
|---|---|
| `script.json` | the 42 lines + pauses |
| `make_voiceover.py`, `stt_words.py` | voiceover (see above) |
| `make_captions.py`, `fonts/` | burned-in captions |
| `plan.py` → `shots.json`, `prompts.md` | the 41-shot plan and the ChatGPT / Kling prompts |
