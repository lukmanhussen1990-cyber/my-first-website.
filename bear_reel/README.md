# "You just pooped in the forest" — bear reel

Instagram Reel, 1080x1920, 30 fps, 44.4 s, 29 shots. Same style and workflow as the last reels (airplane toilet /
Thanksgiving / crush's house / keys): calm deadpan narrator telling the story to "YOU", low-poly PS1 / Roblox look,
white Pixelify Sans captions in the centre, green stink lines, fog, sweat drops and tears.

## Status

1. **Voiceover — done.** ElevenLabs, voice **Nassim - Corporate Narration** (`repzAAjoKlgcT2oOAIWt`), model
   `eleven_v4`, tags `[calm] [deadpan]` — the same voice and settings as `thanksgiving_reel/script.json`.
   One take of the whole script, 2 takes generated (flow `x2zfdiMVQta1emaL0aKq`); take B is used because take A
   adds an extra "it's" in "about seven times". Long pauses: 0.90 s before "What you don't know:", 1.05 s before
   the last line.
2. **Shot plan + prompts — done.** `prompts.md`: character sheet prompt, 29 ChatGPT image prompts (same STYLE
   block), caption / effect / sound per shot, 6 key shots with Kling prompts.
3. **Waiting for the images (`images/shot_XX.png`) and Kling clips (`clips/shot_XX.mp4`).**
4. Then: build `final.mp4` (zooms, pans, punch-ins, shake, captions, effects, sound) and check it.

## Files

| | |
|---|---|
| `script.json` | the script lines, the voice (id, model, tags), the take used, the long pauses |
| `audio/raw/narr_A.mp3`, `narr_B.mp3` | the two ElevenLabs takes + `*.words.json` (speech-to-text word times) |
| `stt_words.py` | speech-to-text check (faster-whisper): every script word must be heard |
| `make_voiceover.py` | cuts the take at the real silences between lines and sets the pauses |
| `audio/voiceover.wav` / `.mp3` | the final timed voiceover (44.4 s) |
| `audio/vo_lines.json`, `audio/voiceover.words.json` | exact start/end of every line and word |
| `plan.py` → `shots.json`, `prompts.md` | the 29 shots (times, captions, effects, sound, Kling prompts) |
| `fonts/` | Pixelify Sans (same caption font as last time, OFL licence) |

## Rebuild steps 1–2

```bash
pip install numpy soundfile faster-whisper
python3 stt_words.py audio/raw/narr_A.mp3 audio/raw/narr_B.mp3   # word times + script check
python3 make_voiceover.py                                        # audio/voiceover.wav + timings
python3 plan.py                                                  # shots.json + prompts.md
```
