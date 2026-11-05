# Atheist vs Believer — 5-minute debate

- **Believer:** Siren (ElevenLabs voice `eXpIbVcVbLo8ZJQDlDnl`)
- **Atheist:** Zhao (ElevenLabs voice "Evan Zhao", `MI36FIkp9wRP7cpWKPTl`)
- **Model:** `eleven_v4` with emotion tags. Full script in [SCRIPT.md](SCRIPT.md).
- **Joined MP3 (5:10):** made in ElevenLabs as the "Full debate (joined MP3)" composition node in the flow
  *Atheist vs Believer Debate*. Download it from there.

## Video

`debate_visuals.mp4` is the video track: speaker cards that highlight whoever is talking, plus captions,
timed to the ElevenLabs clips. To make the final video with sound, put the downloaded MP3 next to this file and run:

```bash
python3 build_video.py debate.mp3     # -> debate_video.mp4
```

or mux it with ffmpeg alone:

```bash
ffmpeg -i debate_visuals.mp4 -i debate.mp3 -c:v copy -c:a aac -b:a 192k -shortest debate_video.mp4
```
