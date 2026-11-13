# Aura video (Remotion + React Three Fiber)

45s vertical short (1080x1920, 30fps): "What if your aura doubled every minute on the way to school?"

- `src/timeline.ts` – beat grid of the song, shot list (every cut on a beat), HUD text, captions, shouts, SFX cues
- `src/shots.ts` – per-frame camera, poses, lighting for every shot
- `src/three/*` – low-poly town, school, characters, original trickster (Loki) design, effects
- `src/overlay/*` – HUD, captions, shouts, -200 AURA floaters, news graphics, flashes, end card

Audio files not in git: `public/music.mp3` (song), `public/sfx/late_again.mp3`, `whos_that.mp3`, `accelerate.mp3`.

```
npm install
npx remotion studio                       # preview
node stills.mjs out/stills 30 87 145      # still frames
npx remotion render AuraVideo out/aura.mp4
npx remotion render AuraVideo out/preview.mp4 --props='{"preview":true}' --scale=0.1333333   # fast 144p
```
