# Sone ki Qaid: Instagram reel

Hindi-voiceover cartoon story, edited in the style of the reference reel.

- `sone_ki_qaid.mp4`: final video (slow zoom/pan inside each shot)
- `sone_ki_qaid_static.mp4`: same edit with static shots, the way the reference does it

## Rebuild

```bash
./setup.sh                                   # tools + Hindi TTS voice (Piper "pratham")
python3 make_voice.py pratham 1.05           # voiceover + word timestamps -> build/
python3 make_video.py --out sone_ki_qaid.mp4 # add --static for the no-zoom version
```

- `script_data.py`: script (Hinglish captions ↔ Devanagari for TTS), image per line,
  close-up focus points per image, the "dhadaam!" impact word.
- `make_voice.py`: Piper TTS line by line with phoneme alignments, giving exact word timings.
  Pauses: 0.35 s at "…", 0.45 s between lines. `1.05` = 5% slower than normal.
- `make_video.py`: 720x1280 @ 30 fps, title, cuts, karaoke captions, `@deepsochotv`
  watermark (`WATERMARK` at the top of the file), flash + shake on "dhadaam!",
  loudness normalised to -14 LUFS. Drop a `background.mp3` in this folder and
  it is mixed in at 12% with fades.

Fonts: Poppins (SIL Open Font License, `fonts/OFL.txt`).
