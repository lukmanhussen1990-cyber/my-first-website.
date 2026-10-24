# Secret Bunker Reel

`secret-bunker-reel.mp4` is a 60-second vertical Instagram Reel (1080×1920, 30 fps, H.264 + AAC). It shows a living room in dollhouse cutaway while a secret bunker is dug, built, furnished and hidden beneath it.

Everything is generated from code:

| Step | Script | What it does |
| --- | --- | --- |
| Scene | `src/build_scene.py` | Builds the procedural Blender scene: the room, ground layers, pipe, bunker, all 8 scenes' animation, lights and camera (`camera.json`). Event times come from `timeline.py` / `timeline.json`. |
| Render | `src/render.py`, `src/fix_frames.py` | Renders the frames with Cycles at 720×1280. Can resume, and can run as parallel odd/even jobs. |
| Voice | `src/tts.py`, `src/place_vo.py` | Synthesizes the narration with Kokoro (a blend of the am_michael and am_fenrir voices) and force-aligns every word with PocketSphinx. Each phrase is then placed so its key word lands on the matching visual event. |
| Captions | `src/captions.py` | Burns in one word at a time, styled like the reference reel: white Montserrat ExtraBold with a black outline and soft shadow. |
| Sound | `src/sound_design.py`, `src/mix.py` | Synthesizes the music bed and every sound effect. The mix ducks the effects (hardest in the speech band) and the music under the voice. |
| Assemble | `src/compose.sh` | Upscales to 1080×1920, burns in the captions, and muxes the audio. |

Requirements: Python 3.13 with `bpy==5.2.3` for the scene and render; `kokoro-onnx`, `pocketsphinx`, `numpy`, `scipy`, `soundfile` and `pyloudnorm` for audio; `ffmpeg` with libass; and the Montserrat font.
