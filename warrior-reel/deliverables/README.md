# The Warrior Who Couldn't Forgive — deliverables

| file | what |
|---|---|
| `the_warrior_who_couldnt_forgive_reels.mp4` | Final reel, 1080×1920 vertical, 30 fps, 60.4 s, H.264 High + AAC 48 kHz, ~10 Mbit/s, subtitles/title/end card burned in, mix at −14 LUFS (Instagram Reels ready). The 15 Mbit/s master is produced by `render/assemble.sh` (too large for git). |
| `voice_track_JESUS.m4a` | Jesus's dialogue only, at its exact film timing (ElevenLabs voice "LAUKYS Voice", id `9Ni5tnvWT8WRgVNQLU3c`, eleven_v4). |
| `voice_track_KNIGHT.m4a` | The knight's dialogue only, at its exact film timing (ElevenLabs voice "Rob – Tough, Calloused, British", id `2ajXGJNYBR0iNHpS4VZb`, eleven_v4). |
| `music_track.m4a` | Score as heard in the mix (ducked under dialogue). |
| `subtitles.srt` | Plain subtitles (the burned-in version is word-synchronised ASS: `out/subs/film.ass` via `render/subtitles.py`). |

See `../docs/PRODUCTION.md` for the script, voice casting, shot list and how to rebuild everything.
