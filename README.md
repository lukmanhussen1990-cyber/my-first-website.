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
- Speaker icon: sound on/off (remembered). Share icon: system share sheet or copy to clipboard.
- Your text (max 3 000 characters), lamp state and slider values are saved in `localStorage`.
- Add `?debug` to the URL to expose a small `window.__fw` inspection object (used by the tests).

Other files:

- `versions/` – snapshots saved after each hourly check (v1 … v8x).
- `notes/video-observations.md` – what was measured in the reference recording.
- `notes/checks.md` – the comparison log for every check.
