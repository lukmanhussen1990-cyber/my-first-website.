# Border Trials — architecture & build brief

Border Trials is an original, fan-made survival-challenge game app (dark mystery / strategy
atmosphere). **Created by IMRAN.** It is a mobile-first PWA (React 19 + TypeScript + Vite 8)
that also packages as a native Android/iOS app through Capacitor.

> Never copy characters, logos, scenes, names or assets from any existing franchise. Playing-card
> suits and ranks are public-domain motifs; everything else is original.

## Visual language (match the reference key art)

The reference sheet lives at `docs/reference.jpg`. It shows 10 phone screens:
loading · welcome/login · dashboard · card selection · card details · number puzzle ·
heart choice scenario · city map · leaderboard · profile.

- **Palette**: near-black surfaces (`--bg-1` #09090b, panels `--bg-2/3`), one hot accent —
  crimson `--red` #e3121f with neon bloom. White primary text, grey secondary. Gold only for
  the crown currency / 1st place / achievements; green = completed, amber = available.
- **Type**: `--font-display` Orbitron for the wordmark, credit and big numerals;
  `--font-ui` Rajdhani (bold, UPPERCASE, wide tracking) for headings, labels, buttons, tabs;
  `--font-body` Inter for sentences; `--font-mono` Share Tech Mono for terminal / timer flavour.
- **Surfaces**: dark glass panels (`.glass` or `<Glass>`) — 1px hairline border
  `--line-2`, soft top highlight, 12–16px radius, backdrop blur. Selected / critical items
  get the crimson hairline + glow (`.neon-border`).
- **Buttons**: primary = solid crimson slab, 48–54px tall, 11px radius, uppercase Rajdhani;
  secondary = dark glass slab with hairline border; tertiary = ghost text.
- **Imagery**: cinematic, painterly, rain-soaked abandoned city; red moon; playing-card motifs.
  Backgrounds sit behind gradient shades so text is always readable.
- **Motion**: smooth and weighty (`--ease-out`), short (150–450ms). Glitch bursts are
  accents, not constant noise. Respect `useSettings().reduceMotion` and
  `prefers-reduced-motion` for anything continuous.
- **Spacing**: 18px side gutter (`--gutter`), 12–16px gaps, generous vertical rhythm.
  Section headings use the global `.section-title` class.

## Layout rules

- The app renders inside a fixed-size container (a phone frame on desktop, full-screen on
  mobile). **Never use `position: fixed`** — use `position: absolute` relative to the app.
- Every screen returns a `<Screen>` (`src/components/ui/Screen.tsx`): it handles background
  art + shade, safe areas, a fixed `header` slot (use `<TopBar>`), a scrolling body and an
  optional sticky `footer` (CTA). Pass `nav` on tab screens (home, games, map, rankings,
  profile) so content clears the bottom tab bar.
- Design for a 360–430px wide viewport; nothing may overflow horizontally at 360px.
- Touch targets ≥ 44px. Visible focus states (global `:focus-visible` exists).

## Code conventions

- TypeScript strict, `erasableSyntaxOnly` (no `enum`, no `namespace`, no constructor
  parameter properties), `verbatimModuleSyntax` (use `import type` for types).
- Styling: one CSS Module per component/screen (`Foo.module.css`), reading tokens from
  `src/styles/tokens.css`. No inline hex colours except inside art/SVG gradients.
- No new npm dependencies. Available: react 19, motion (`import { motion, AnimatePresence } from 'motion/react'`),
  zustand, lucide-react icons, idb.
- Default-export each screen from `src/screens/<Name>Screen.tsx` with signature
  `(props: ScreenProps) => JSX.Element` (`ScreenProps` from `src/app/screens.tsx`).
- Feedback: call `audio.play(sfx)` (`src/services/audio.ts`) and `haptic(kind)`
  (`src/services/haptics.ts`) on meaningful interactions. `<Button>`, `<IconButton>`,
  `<Tabs>` and `<BottomNav>` already do this.

## Module map

| Area | Path | Notes |
| --- | --- | --- |
| Router | `src/app/router.ts` | `navigate(path, { replace?, transition? })`, `back(fallback)`, `useRoute()`. Transitions: push · pop · tab · fade · glitch · none |
| Screens registry | `src/app/screens.tsx` | lazy + preloadable; `preloadAllScreens()` |
| Cold start | `src/app/boot.ts` | `finishBoot(signedIn)` — loading screen calls this when done |
| Shell | `src/app/App.tsx` | screen stack animation, auth guard, bottom nav, toasts, grain |
| Domain types | `src/data/types.ts` | Challenge, GameConfig, GameResult, PlayerProgress, Zone, Achievement… |
| Data | `src/data/{suits,zones,achievements,rivals}.ts`, `src/data/challenges/*` | 20 ranked trials + 8 practice runs, `getChallenge(id)`, `GAME_TYPES` |
| Rules | `src/state/selectors.ts` | `levelInfo`, `globalRank`, `winRate`, `challengeStatus`, `zoneStatus`, `suitProgress`, `nextChallengeForSuit`, `currentMissions`, `formatNumber`, `formatClock`, `formatDuration` |
| Rewards | `src/state/rewards.ts` | `applyResult()` — rewards, streaks, achievements |
| Progress store | `src/state/game.ts` | `useGame` (`progress`, `recordResult`, `setAvatar`, `setPlayerName`, `scanMap`, `lastSummary`), `useProgress()` |
| Session store | `src/state/session.ts` | `useSession` (`status`, `user`, `register`, `login`, `playAsGuest`, `logout`, `deleteAccount`) |
| Settings | `src/state/settings.ts` | `useSettings` (`sound`, `music`, `haptics`, `reduceMotion`, `volume`, `set`) |
| Toasts | `src/state/toasts.ts` | `toast({ kind, title, body })` |
| Auth service | `src/services/auth.ts` | PBKDF2 accounts; `validateUsername`, `passwordStrength`, `AuthError` (`code`, `retryAfterMs`) |
| Audio | `src/services/audio.ts` | `audio.play(sfx)`, `audio.startAmbience(kind)`, `audio.stopAmbience()` |
| Art | `src/assets/art/index.ts` | `ART.*`, `SUIT_CARD_ART`, `SUIT_SCENE`, `AVATARS`, `avatarUrl(id)`, `AVATAR_NAMES`, `PRELOAD` |
| UI kit | `src/components/ui/*` | `Button`, `IconButton`, `Screen`, `TopBar`, `Glass`, `ProgressBar`, `Stars`, `StatRow`, `Pill`, `Divider`, `Tabs`, `Logo`, `GlitchText`, `Avatar`, `Badge`, `SuitIcon`, `Currency`, `Sheet` |
| Credit | `src/components/AuthorCredit.tsx` | `<AuthorCredit variant="compact" \| "stacked" />`, `AUTHOR`, `APP_VERSION` |
| Games | `src/games/types.ts`, `src/games/index.ts` | `GameProps` contract + lazy registry |

## Navigation map

```
/ (loading) ──► /welcome ──► /register | /login | guest ──► /home
/home ─► /cards (choose your card) ─► /cards/:suit (card details) ─► /challenge/:id ─► /play/:id
/games (mini-game hub) ─► /challenge/practice-<type> ─► /play/practice-<type>
/map ─► zone sheet ─► /challenge/:id
/rankings · /profile ─► /settings ─► /about (credits) · /info (app information)
```

## Game rules summary

- Levels: XP to next level = `250 × level + 250`. Trials unlock by level and (for hidden
  zones) by map scan. Each trial grants points (crown), XP and gems; replays pay less.
- Ranks: playing-card rank shows difficulty (3 ★1 · 6 ★2 · 9 ★3 · Q ★4 · K ★5).
- Four suits: ♠ Spade physical (reaction, stamina) · ♥ Heart psychological (choice, memory) ·
  ♦ Diamond logic (number order, logic test) · ♣ Club team strategy (pattern, escape).

## Verifying your work

- Type-check: `npx tsc -p tsconfig.app.json` (other agents may have work in progress — fix only errors in your files).
- Lint: `npx oxlint src/<your files>`.
- A dev server normally runs at `http://localhost:5173/`. Screenshot any route at phone size:
  `node tools/shoot.mjs /home shots/home.png --seed 6` (see the header of `tools/shoot.mjs`
  for options: `--fresh`, `--click`, `--eval`, `--wait`). If the server is down, start your
  own on another port (`npx vite --port 51xx --strictPort &`) and pass `--base`.
- Look at your screenshots (they are PNGs you can open) and compare with `docs/reference.jpg`.
