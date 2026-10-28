# my-first-website.

## How big is Allah's mercy?

A one-page website for a 42-second audio reminder about the hadith of the
hundred parts of mercy.

- **Listen and read along.** Each phrase lights up as it is spoken. Tap any
  line to play from that point.
- **See the hundred parts.** A grid of 100 dots follows the narration: all 100
  light up, then the one part comes down to the earth, then the 99 kept for the
  Day of Judgement glow.
- **Sources.** Sahih al-Bukhari 6000, Sahih Muslim 2752, and Surah Az-Zumar 39:53.
- **Share.** Native share on phones, WhatsApp, copy link, and audio download.

### Files

| Path | What it is |
| --- | --- |
| `index.html` | The page and the timed transcript (`data-start` = seconds into the audio) |
| `css/style.css` | All styles |
| `js/main.js` | Audio player, read-along sync, the 100-dot animation, sharing |
| `audio/allahs-mercy.mp3` | The narration |

### Run it locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server
```

### Publish it with GitHub Pages

In the repository on GitHub, go to **Settings → Pages**, set the source to
**Deploy from a branch**, pick the branch and the `/ (root)` folder, and save.
The site will be live at `https://<your-username>.github.io/my-first-website./`.
