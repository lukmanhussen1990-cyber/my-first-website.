# IMRAN — bio page

A guns.lol / crax.lol-style personal link page: click-to-enter screen, your video as the background, a glass profile card with a 3D tilt, angel wings around the profile picture, and *Forever Young* by Alphaville playing in a built-in music player. The photo pulses on the song's kick drum.

## Run it
- **Multi-file site:** open `index.html`, or serve the folder (`python3 -m http.server`) and visit `http://localhost:8000`. To host it for free, turn on **GitHub Pages** (Settings → Pages → Deploy from branch).
- **Single file:** run `python3 build.py`. It writes `dist/imran.html` with everything (fonts, images, video, music) embedded, so that one file works anywhere, even offline.

## Customise
- **Social links:** in `index.html`, replace each `href="#"` with your profile URL. The Discord button copies the name in `data-discord="imran"`.
- **Bio lines, enter text, tab title, start volume:** top of `script.js`.
- **Media:** `assets/bg.mp4` (background video), `assets/poster.jpg` (shown until the video starts), `assets/pfp.jpg` (profile picture), `assets/forever-young.mp3` (music), `assets/enter-bg.jpg` (blurred enter screen).

After changing anything, run `python3 build.py` again to refresh the single file.

## Performance
Every animation only moves or fades layers, which the graphics card handles; nothing is re-blurred or repainted each frame. If a device still can't keep up, the page switches itself to a lighter mode (no background blur or particles). It also respects the system "reduce motion" setting.

## Keyboard
`Space` play/pause · `M` mute
