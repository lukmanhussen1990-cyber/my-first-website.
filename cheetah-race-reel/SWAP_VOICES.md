# Swapping in the ElevenLabs voices

The reel was voiced with a local text-to-speech model (Kokoro-82M). ElevenLabs
was tried first, but the account had no credits left (0 of 10,000), so no
ElevenLabs audio was generated and nothing was charged.

Once you have credits, one command re-makes every line with ElevenLabs and
re-exports the video. The 3D animation is not re-rendered.

```bash
cd cheetah-race-reel
ELEVENLABS_API_KEY=sk_your_key ./remake_with_elevenlabs.sh
```

You can also put `ELEVENLABS_API_KEY=sk_your_key` in a `.env` file in
`cheetah-race-reel/` or in the repository root.

The result is written to `out/cheetah_race_reel_elevenlabs.mp4`.

## What the command does

1. It reads `script/script.json`: the exact text, the ElevenLabs v4 delivery
   tags (`tts_prompt`) and the two voices.
   - Narrator: Elena Wren, `N2MNNfQ4izkc8hqG3xMa`
   - John: Will, `bIHbv24MWmeRgasZH58o`
2. It calls `/v1/text-to-speech/{voice}/with-timestamps` for each line.
   - It saves `voices_elevenlabs/<line>.mp3` and `<line>.words.json`.
   - Word timings come from ElevenLabs' character timestamps, using the
     script's spelling.
3. It places each sentence on its anchor in the animation
   (`tools/layout_voice.py`).
   - A line can't drift off the action it describes.
   - If a new take is longer, the piece is sped up slightly (15 % at most).
   - John's line still starts after the music stops.
4. It rebuilds the word-by-word subtitles with the new timings
   (`tools/make_subs.py`).
5. It re-mixes and exports the final MP4 (`tools/finalize.py`).

## Options

| Option | What it does |
|---|---|
| `--only 08_john 05_narrator` | Re-makes only these lines. Other lines reuse earlier ElevenLabs takes, or are made too if missing. |
| `--model eleven_v3` | Uses a different model. If the requested model is rejected, the script falls back to `eleven_v3`, then `eleven_multilingual_v2` (which uses the plain text without tags). |
| `--skip-tts` | Skips the API calls and only re-lays out, re-subtitles and re-exports from `voices_elevenlabs/`. |

To change the wording or the voices, edit `text`, `tts_prompt` or the voice IDs
in `script/script.json` and run the command again. The subtitles always follow
`text` exactly.
