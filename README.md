# ArrowGO! by ImranO

A calm arrow-untangle puzzle for phones and desktop. Tap an arrow and it slides off the board
the way its head points. If another arrow is in the way it bumps, bounces back and you lose one
of your three water drops. Clear every arrow to win the level.

* Infinite, deterministic levels (level N is always the same puzzle), guaranteed solvable
* Daily streak, Bronze League (weekly), Daily Challenge, four themes
* ImranO Premium demo (no payment is processed), demo ad breaks for free players
* Vanilla HTML/CSS/JS, no build step; installable PWA that works offline
* Android APK: `dist/ArrowGO.apk`

## Play locally

Any static file server works:

```bash
npx http-server -p 8080 .
# open http://localhost:8080
```

Testing helper: add `?today=2026-10-07` to the URL to simulate another calendar day
(streaks, Daily Challenge, league week).

## Project layout

| Path | What it is |
|------|------------|
| `index.html` | All screens and the SVG icon sprite |
| `styles.css` | Design tokens, the four themes, layout and animations |
| `levels.js` | Seeded level generator, solver and collision geometry (`window.ArrowLevels`) |
| `app.js` | The game: screens, board, slide/bump animation, sounds, storage, premium, ads, league |
| `sw.js`, `manifest.json` | PWA offline cache and install metadata |
| `icons/`, `fonts/` | Logo, app icons, Nunito font (SIL OFL) |
| `android/` | WebView wrapper and `build-apk.sh` |
| `tests/` | Node and Playwright tests |
| `docs/ARCHITECTURE.md` | Module contracts and the movement rule |

## Tests

```bash
node tests/levels.test.js      # generator: determinism, solvability, difficulty ramp
```

## Android APK

```bash
android/build-apk.sh           # needs the Android SDK (build-tools 34, platform 34)
```

The APK is written to `dist/ArrowGO.apk`. See `android/README.md` for signing details.

© 2026 ImranO. All rights reserved. Nunito font © The Nunito Project Authors, SIL Open Font License 1.1.
