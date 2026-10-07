# Border Trials

**Survive · Solve · Escape.** A cinematic survival-challenge game companion app with a dark
mystery and strategy atmosphere: a black-and-crimson, neon-lit, playing-card universe set in an
abandoned city.

**Created by IMRAN.**

> Border Trials is an original fan-made work inspired by the survival-thriller genre. It is not
> affiliated with or endorsed by any existing series, film or publisher. All characters, places,
> artwork and sound are original.

---

## What's inside

| Screen | What it does |
| --- | --- |
| **Loading** | Cinematic key art (blood moon, floating card, lone survivor), rain, logo glitch-in, real asset preloading with a progress bar, creator credit |
| **Welcome / Login** | Create account, log in, or continue as a guest |
| **Dashboard** | Avatar, level and XP, survival points, gems, rank, stats, current missions, the four suit cards |
| **Card selection** | Cards are dealt face-down and flipped in an animated reveal: ♠ Spade (physical), ♥ Heart (psychological), ♦ Diamond (logic), ♣ Club (team strategy) |
| **Card details** | Suit briefing, difficulty, time limit, rewards, players, plus all five trials of the suit |
| **Challenge details** | Mission briefing, rules, timer, difficulty, rewards, location, personal record, start button |
| **Mini-games** | 8 engines across 20 ranked trials: memory puzzles, logic tests, pattern relays, escape rooms, reaction tests, number-order puzzles, moral-choice scenarios and endurance runs |
| **Survival map** | Pan/zoom city map with locked, available, completed and hidden locations, plus a radar scan that reveals secrets |
| **Leaderboard** | Global, friends and top-player rankings with achievement badges |
| **Profile** | Avatar picker, statistics, suit mastery, achievements, recent trials |
| **Settings / About / App info** | Audio, haptics, reduced motion, account management, credits and app information |

## Tech

- **React 19 + TypeScript + Vite 8**: fast, code-split, mobile-first.
- **Installable PWA**: works offline after first load (service worker via `vite-plugin-pwa`).
- **Native-ready**: packages for Android and iOS with **Capacitor** (`capacitor.config.json`).
- **Motion**: screen-stack transitions, card flips and micro-interactions.
- **Zustand** state, **IndexedDB** persistence (`idb`).
- **Original procedural assets**: every image is painted by code in `tools/art/` and every
  sound is synthesised live with the Web Audio API. Fonts are self-hosted (SIL OFL) and icons
  come from Lucide (ISC).

### Accounts & progress

Accounts are stored **on the device**. There is no server.

- Passwords are never stored. Only a PBKDF2-HMAC-SHA256 hash is kept (600,000 iterations,
  random per-account salt), and hashes are compared in constant time.
- Repeated failed logins lock the account with exponential back-off.
- Sessions use random 256-bit tokens. Only the token's hash is stored, and sessions expire after
  30 days with "remember me" or 12 hours without it.
- Player progress (XP, points, gems, trials, achievements, map discoveries) is saved to
  IndexedDB after every change.
- WebCrypto needs a secure context, so open the app over **HTTPS or `localhost`**.

To sync accounts across devices, replace `src/services/auth.ts` and `src/services/db.ts` with a
backend (for example Supabase or Firebase) that implements the same exports.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run preview      # serve the production build
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm test             # game rules, data integrity, account security
```

### Install on a phone

- **As a PWA**: deploy `dist/` to any HTTPS host (the GitHub Pages workflow below does this),
  open it on your phone and choose *Add to Home Screen*.
- **As a native app** (requires Android Studio / Xcode):

  ```bash
  npx cap add android      # or: npx cap add ios
  npm run cap:sync
  npx cap open android
  ```

### Deploy to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes the app whenever `main` is updated. To turn
it on, open the repository **Settings → Pages** and set **Source** to **GitHub Actions**.

## Project structure

```
src/
  app/          router (hash-based, native-style transitions), shell, boot, screen registry
  screens/      one file per screen
  games/        mini-game engines (code-split) + shared contract
  components/   UI kit (glass, buttons, cards, badges…), FX, nav, toasts, credits
  data/         suits, 20 trials, map zones, achievements, rivals
  state/        session, progress, rewards rules, settings, toasts
  services/     auth (PBKDF2), IndexedDB, Web Audio engine, haptics
  styles/       design tokens, global styles, effects
  assets/art/   generated artwork (see tools/art)
tools/
  art/          procedural art generators + renderer (npm run art)
  shoot.mjs     phone-sized screenshot tool for any route
docs/
  ARCHITECTURE.md   design + engineering brief
  reference.jpg     art-direction reference
```

Regenerate the artwork with `npm run art`. This needs Chromium, Playwright and ImageMagick.

## Credits

**Created by IMRAN.** Concept, direction and game design.

Typefaces: Orbitron, Rajdhani, Inter and Share Tech Mono (SIL Open Font License). Icons: Lucide
(ISC License).
