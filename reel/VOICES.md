# Swapping in the ElevenLabs voices

The first cut of the reel uses **local Piper voices** (ElevenLabs was not usable when it was made:
no API key in the environment, and the connected ElevenLabs account had 0 credits left).
Everything is set up so you can switch to ElevenLabs with one command — the 3D video is reused,
only the audio mix and the subtitle timing are rebuilt.

## One command

```bash
cd reel
export ELEVENLABS_API_KEY=sk_...          # or put  ELEVENLABS_API_KEY=sk_...  in reel/.env
./remake_with_elevenlabs.sh
```

This will:
1. generate all 7 lines with ElevenLabs (`voice/make_voices_elevenlabs.py`, using the
   `/with-timestamps` endpoint) into `voices/elevenlabs/<id>.wav` + `<id>.words.json`
   (word timings come straight from ElevenLabs' character alignment);
2. re-place the lines on the timeline (`export.py`): if a line is longer than its slot it is
   sped up slightly (max x1.12) or the next line is nudged later;
3. regenerate the music so it still stops dead 0.3 s before Grandpa's line;
4. rebuild the word-by-word subtitles from the new timings and re-export
   `output/treasure_reel.mp4`.

If ElevenLabs fails (no key, 401, no credits) the script stops with the error and changes nothing.

## Choosing voices

Voice ids, model and settings live in `script.json` → `speakers` → `elevenlabs`:

| speaker  | default voice | voice_id |
|----------|---------------|----------|
| narrator | Elena Wren – friendly, warm, neutral accent | `N2MNNfQ4izkc8hqG3xMa` |
| grandpa  | Bill – wise, mature, old American male      | `pqHfZKP75CvOlQylNhV4` |

Change a `voice_id` (any voice in your ElevenLabs library) and re-run the script.
Only want to redo one line? `./remake_with_elevenlabs.sh --only g1`

## Files

- `script.json` — the exact script (subtitles are spelled from it word for word)
- `voices/local/` — Piper voice files used in the current video (+ word timings)
- `voices/elevenlabs/` — created by the script above
- `export.py --voices local|elevenlabs|auto` — re-export with either set (auto = ElevenLabs when complete)
- `./make_local_voices.sh` — regenerate the local Piper voices and re-export
