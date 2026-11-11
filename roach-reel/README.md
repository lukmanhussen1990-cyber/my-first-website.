# Hotel Cockroach: 2D low-poly reel

`grace_roach_hotel_1080p.mp4`: 1080×1920, 60 fps, H.264 High (CRF 14, ~20 Mbps), AAC 320 kbps, 32.77 s (matches the voiceover), loudness −14 LUFS / −1 dBTP.

Everything is drawn in code. Characters, sets and props are triangulated into faceted "gem" meshes and lit per facet (key light, ambient, rim, specular and point lights). Frames are rendered with Skia (`@napi-rs/canvas`) and raw RGBA is piped to ffmpeg. No 3D software is used.

## Pipeline
| Step | Command | Output |
|---|---|---|
| Word timestamps (faster-whisper large-v3) | `python3 tools/transcribe.py` | `build/words.json` |
| Mouth-sync loudness envelope | `python3 tools/envelope.py` | `build/envelope.json` |
| Timeline (cuts, captions, SFX cues from word times) | `node src/timeline.mjs > build/timeline.json` | |
| Sound design + ducked mix | `python3 tools/mix_audio.py` | `build/mix.wav` |
| Render frames (4 workers, lossless intermediate) | `node src/render.mjs --all` | `build/video_noaudio.mkv` |
| Final encode + 2-pass loudnorm | `tools/encode.sh` | `grace_roach_hotel_1080p.mp4` |
| Preview stills | `node src/render.mjs --stills 1.5,8.3` | `build/stills/` |

Setup: `npm install`, `pip install faster-whisper scipy numpy pillow`, plus ffmpeg.

## Layout
- `src/core.mjs`: easing, keyframes, springs, noise, camera shake
- `src/poly.mjs`: low-poly mesh builders (blob, slab, panel) and the faceted shader
- `src/roach.mjs`, `src/man.mjs`: cut-out rigs (expressions, blinks, follow-through, IK arms)
- `src/env_bath.mjs`, `src/env_burrow.mjs`: sets (moonlit bathroom, amber burrow) and the cartoon stream
- `src/fx.mjs`, `src/icons.mjs`, `src/layers.mjs`: captions, callouts, watermark, vignette, grain, motion blur, badges
- `src/scenes/*`: the 14 shots, timed to the transcript
- `assets/sfx_raw/`: SFX takes generated with ElevenLabs (voices, splash, trickle, crowd, bell, scratch and others). Pops, hums, ticks, chimes, the crickets bed, the march and so on are synthesised in `tools/mix_audio.py`.

Content rule: the man is always clothed (vest + boxers) and shown from behind or waist-up. The "inside" is a cartoon burrow/hotel cutaway.
