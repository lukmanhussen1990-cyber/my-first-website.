# my-first-website.

**imran**: an animated logo with chess cards and its own sound design.

Six chess cards (king, queen, rook, bishop, knight, pawn) fan out and stack up.
The stack stretches into blocks that become the name **imran**. The letters
break into pixels and shuffle, then the stack spirals away into a dot.

- `index.html`: open it in a browser. The animation loops; press **Play with sound** for audio.
  Keys: `Space` replay, `M` sound, `L` loop.
- `media/imran.mp4`: the rendered video (3840×2160, 60 fps, with sound).
- `js/scene.js`: the animation, drawn on a canvas as a pure function of time.
- `js/sound.js`: the sound design, synthesised with the Web Audio API (no audio files).
- `tools/render.mjs`: re-renders the MP4 (`npm install && npm run render`, needs ffmpeg).

Credits: letters from [Instrument Sans](https://github.com/Instrument/instrument-sans) (SIL OFL 1.1).
Chess pieces from [Font Awesome Free](https://fontawesome.com) (CC BY 4.0).
