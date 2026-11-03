# Poop For Money — vertical reel

`poop_for_money_reel.mp4` (repo root): 45 s, 1080x1920, 30 fps, H.264 + AAC.

How it was made:

- **Voice**: the supplied voiceover MP3, cut into its 28 spoken lines and re-spaced with longer pauses (1.05 s after "Silence.") to reach 45 s. Nothing was regenerated.
- **Caption timing**: word timestamps from a local Whisper (`faster-whisper`, `small.en`) pass over the original voiceover, snapped to each line's measured start and end (`scripts/transcribe.py`, `scripts/build_audio.py`). The output is `src/timeline.json`.
- **Sound effects**: all made with numpy in `scripts/build_audio.py`: street ambience, cha-chings, a record scratch, footsteps, a rumble, wing flaps and a moth flutter. They sit about 11 dB under the voice, and the mix is loudness-normalised to -15 LUFS.
- **Visuals**: a Three.js low-poly street scene (`src/scene.js`). Every frame is a pure function of time and is rendered with Playwright/Chromium (`src/render.js`). The frames go straight into ffmpeg (`scripts/render_par.sh`).

Rebuild:

```bash
cd reel/src && npm install          # three + pixel fonts
# put the mixed audio at ../work/mix.wav (see build_audio.py), then:
../scripts/render_par.sh /tmp/out.mp4 1080 1920 30 4 19 ../work/mix.wav
```
