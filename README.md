# my-first-website.

**Frankenwriter** – a Halloween "Frankenstein" typewriter, rebuilt from a 15-second phone
recording. Everything (HTML, CSS, JavaScript, paper texture, rail, capsule, cobwebs, sparks,
lamp light and all sounds/music) lives in one file: [`index.html`](index.html). The only
outside resource is the Google Font *Courier Prime* (falls back to Courier New).

Open `index.html` in a browser (or serve the folder) – on a phone, tap the paper to bring up
the keyboard and start typing.

- Tap the dimmer dial (bottom right of the paper) to switch the lamp on/off; the LIGHT / SPREAD /
  REACH sliders appear in lamp mode.
- Tap "Need a first line?" for a random spooky opening line.
- Tap the capsule to change its skin: Frankenstein (the recorded one), Pumpkin, Vampire, Mummy, Ghost,
  Witch or Claude Special – each with its own sparks, glow and sound. Claude Special is alive: its spark
  breathes and spins while you type, its speech bubble shows typing dots, and every new line sparkles.
- Share icon: share or copy the text, share or save a picture of the page, save a `.txt`, or tear the
  page off for a new one (with Undo).
- Speaker icon: music + effects → effects only → off. Android phones also get light haptics.
- Now and then a distant lightning strike (with thunder) or a few bats; on wide screens the machine
  stands before a night window. "Reduce motion" turns off flashes, bats and flying paper.
- Your text (max 3 000 characters), lamp state, slider values, skin and sound mode are saved in
  `localStorage`.
- Add `?debug` to the URL to expose a small `window.__fw` inspection object (used by the tests).

Other files:

- `versions/` – snapshots saved during each hourly check (v1 … v15x); `index.html` is always the latest.
- `notes/video-observations.md` – what was measured in the reference recording.
- `notes/checks.md` – the comparison log for every check.
