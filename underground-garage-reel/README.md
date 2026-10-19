# Secret Underground Garage — Instagram Reel

Vertical 9:16 reel (1080×1920, 24 fps, ~56 s, H.264 + AAC) showing a backyard
garage being built step by step, as a stylized 3D cutaway diorama.

**Final video:** [`secret-underground-garage.mp4`](secret-underground-garage.mp4)

## How it is made

Everything is procedural and reproducible from this folder:

| Part | How |
| --- | --- |
| 3D animation | [three.js](https://threejs.org) scene in headless Chromium (SwiftShader WebGL2). Each frame averages several sub-frames (sub-pixel jitter, jittered sun, rotating sky light, motion blur) like Blender Eevee's soft-shadow accumulation, then bloom and an AgX "punchy" grade. |
| Timing | [`src/timeline.js`](src/timeline.js) is the single source of truth: voiceover sentence placement, every animation event and every sound cue. |
| Voiceover | ElevenLabs TTS (voice "Holden – Warm Midwest Narrator", model `eleven_v4`) reading the script; cut into sentences and placed so each action lands on its words. |
| Captions | One word at a time, centred, Fredoka Bold white with a thick black outline. Word times from faster-whisper, refined against the audio's silences ([`tools/refine_words.py`](tools/refine_words.py)). |
| Sound | Synthesised effects (pops, thuds, crumbling dirt, rain, bubbles, pump, tyre spin, hydraulics, engine, fan, whoosh, sparkles) plus an ElevenLabs pop; light pizzicato/marimba music composed in code so its last chord lands as the lawn closes. Voice-ducked mix at −14 LUFS. |

### Scenes

1. Dig the pit; dirt pile lands; the red hatchback drives across the lawn and tips in nose-first.
2. Dirt walls cave in and half-bury the car; loose dirt pops away; concrete walls and floor rise.
3. A rain cloud floods the pit; gravel, floor drain and sump pump snap in; blue dots carry the water out.
4. Wheels spin against the wall; a striped steel platform on a chrome piston lifts the car to the lawn.
5. Exhaust fills the room; a vent pipe with a spinning fan pops up; fresh air flows in low, smoke out the top.
6. A turf roof on four posts snaps onto the lift, grass grows, the lift sinks and the lawn closes flush.
7. Slow push-in: the lawn splits, the car rises into the sunset, headlights flash, then it sinks away.

## Rebuild

```bash
npm install                      # three.js
pip install numpy scipy soundfile pillow faster-whisper
PY=python3 SPP=8 JOBS=2 ./make_reel.sh
```

Quick looks: `node render.mjs stills 4.2,21.6 --spp 4` (PNG stills) or
`node render.mjs video 0 1356 build/preview.mp4 --spp 2 --scale 0.5` (half-res preview).

The voiceover take (`assets/vo/take1.mp3`) and its word timings were produced once
with `tools/align_vo.py` + `tools/refine_words.py` and are committed; `build/` is
scratch output and is not.

Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) (SIL Open Font License 1.1).
