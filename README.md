# IMRAN — bio page

A guns.lol / crax.lol-style personal link page: click-to-enter screen, your video as the background, a glass profile card with a 3D tilt, and *Forever Young* by Alphaville playing in a built-in music player.

## Run it
Open `index.html` in a browser, or serve the folder (`python3 -m http.server`) for the audio visualiser to work. To host it for free, turn on **GitHub Pages** (Settings → Pages → Deploy from branch).

## Customise
- **Social links:** in `index.html`, replace each `href="#"` with your profile URL. The Discord button copies the name in `data-discord="imran"`.
- **Bio lines, tab title, start volume:** top of `script.js`.
- **Media:** `assets/bg.mp4` (background video), `assets/poster.jpg` (shown while the video loads), `assets/pfp.jpg` (profile picture), `assets/forever-young.mp3` (music).

## Keyboard
`Space` play/pause · `M` mute
