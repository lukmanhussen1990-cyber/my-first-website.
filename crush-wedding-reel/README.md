# Crush wedding reel

Source for `../crush_wedding_reel.mp4`: a 1080×1920, 30 fps reel. Low-poly Three.js scenes are rendered frame by frame in headless Chromium (Playwright), then joined with ffmpeg over the original voiceover.

## Pipeline
1. `audio/transcribe.py`: local faster-whisper (`medium.en`) word timestamps. These were refined with an energy envelope, and the resulting times are in `src/story.js` (`CAPTIONS`).
2. `audio/sfx.py`: synthesizes quiet SFX (organ, record scratch, laugh echo, crowd, door slam) and sums them under the untouched voice. Output: `mix.wav`.
3. `render.js`: `node render.js --out frames --w 1080 --h 1920 --fps 30 --workers 3 --shadow 2048 --msaa 4`
4. Encode:
   `ffmpeg -framerate 30 -i frames/f_%05d.png -i mix.wav -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 16 -c:a aac -b:a 192k -t 34.50775 -movflags +faststart crush_wedding_reel.mp4`
5. `audio/verify_captions.py`: re-transcribes the final MP4 and compares each caption's on-screen time with the spoken word (results in `checks/`).

Font: Pixelify Sans (SIL Open Font License).
