# "MOM! I'M DONE!" — wedding reel

Instagram Reel, 1080x1920, 30 fps, 61.1 s, 36 shots. Same style and workflow as the last reels (airplane toilet /
Thanksgiving / bear): calm deadpan narrator telling the story to "YOU", low-poly PS1 / Roblox look, white
Pixelify Sans captions in the centre, green stink lines, sweat drops and tears.

Reference watched for style and pacing: the exam-hall reel uploaded with this request (same series and style
as the airplane-toilet reel; the airplane video file itself was never saved in the old branches). It has about
29 shots in 44.8 s (0.6–3.4 s each, about 1.5 s on average), hard cuts, slow push-ins with punch-ins on the
jokes, captions 2–4 words at a time in a white pixel font with a black outline, a little below the centre, and
an ending that slowly zooms out while green haze fills the room.

## Status

1. **Voiceover — done.** ElevenLabs, voice **Nassim - Corporate Narration** (`repzAAjoKlgcT2oOAIWt`), model
   `eleven_v4`, tags `[calm] [deadpan]` — the same voice and settings as `bear_reel/script.json` and
   `thanksgiving_reel/script.json`. The two yells ("MOM! I'M DONE!") are the same voice with `[shouting]`.
   ElevenLabs flow `eb7qlRn1EmAIRCBYfiKN`; 2 takes each. Narrator take A is used (take B dropped "crying"),
   yell take B is used (its second yell is louder and longer). The last word "DOOONE!" is stretched 1.35x.
   Pauses: 1.00 s before "What you don't know:", 1.25 s before "He throws scissors.", 1.10 s before the last
   line, 0.85 s of real silence after "Silence.", drum-beat gaps between "Rock. / Paper. / Scissors.".
   Script changes (allowed by the brief): added "Louder." after "You yell again." Opening line, twist fact
   and ending are unchanged.
2. **Shot plan + prompts — done.** `prompts.md`: character sheet prompt, 36 ChatGPT image prompts (same STYLE
   block), caption / effect / sound per shot, 6 key shots with Kling prompts.
3. **Waiting for the images (`images/shot_XX.png`) and Kling clips (`clips/shot_XX.mp4`).**
4. Then: build `final.mp4` (zooms, pans, punch-ins, shake, captions, effects, sound) and check it.

## Files

| | |
|---|---|
| `script.json` | the script lines, the voices (id, model, tags), the takes used, the pauses |
| `audio/raw/narr_*.mp3`, `yell_*.mp3` | the ElevenLabs takes + `*.words.json` (speech-to-text word times) |
| `stt_words.py` | speech-to-text check (faster-whisper): every script word must be heard |
| `make_voiceover.py` | cuts the takes at the real silences between lines and sets the pauses |
| `audio/voiceover.wav` / `.mp3` | the final timed voiceover (61.1 s) |
| `audio/vo_lines.json`, `audio/voiceover.words.json` | exact start/end of every line and word |
| `plan.py` → `shots.json`, `prompts.md` | the 36 shots (times, captions, effects, sound, Kling prompts) |
| `fonts/` | Pixelify Sans (same caption font as last time, OFL licence) |

## Rebuild steps 1–2

```bash
pip install numpy soundfile faster-whisper
python3 stt_words.py audio/raw/narr_A.mp3 audio/raw/yell_B.mp3   # word times + script check
python3 make_voiceover.py                                        # audio/voiceover.wav + timings
python3 plan.py                                                  # shots.json + prompts.md
```
