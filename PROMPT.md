# Build Prompt: "ArrowGO!" by ImranO

Copy everything below the line into your AI coding assistant (Claude Code, Cursor, etc.).

---

## Role and working mode

You are a senior mobile game developer and product designer. You are going to build a complete,
polished, playable puzzle game called **ArrowGO!** published by **ImranO**. The author of this
project (me) is the owner of ImranO.

**Time budget: work continuously for at least 2 hours. This is important.** Do not stop after a
first draft. Plan the work in phases, implement every phase, test each one in a real browser, fix
every bug you find, then polish visuals, animations, sounds and copy until the game feels like a
real published app. If you think you are finished before 2 hours, you are not: run through the
acceptance checklist at the end, play 20 levels yourself, and improve whatever feels rough.
Commit after each phase with a clear message.

## The game to recreate (concept reference: "Amaze GO!")

The reference app is an arrow-untangle puzzle. Recreate the concept, not the brand:

1. **Board.** A square grid. Each puzzle piece is an *arrow*: a snake-like path of 2 to 8 grid
   cells drawn as one thick rounded line, with an arrowhead at one end. Arrows never overlap.
2. **Move.** Tap an arrow. It slides forward along its own path and then straight on in the
   direction of its head until it leaves the board, where it fades out and is removed.
3. **Block.** If another arrow lies in its way, the tapped arrow slides up to the obstacle, bumps
   it, bounces back to its place, flashes red and the player loses one **water drop** (life).
   Three drops per level. Losing all three shows an "Out of drops" screen with Retry.
4. **Win.** Remove every arrow. The level is cleared.
5. **Levels.** Infinite, procedurally generated but deterministic (same level number always gives
   the same puzzle). Every generated level must be guaranteed solvable: generate arrows one at a
   time and only accept an arrow whose exit path does not cross any arrow placed before it, then
   the reverse placement order is a valid solution. Difficulty ramps: level 1 is a 4x4 grid with
   2 arrows; grid size and arrow count grow slowly to about 9x9 with 30+ arrows.
6. **Hint.** A hint button highlights an arrow that can currently leave the board.

## Screens to build (match this flow)

- **Splash:** "ImranO Games" wordmark animates in, then the ArrowGO! logo with a rotating tip line
  ("Play for 10 minutes daily, your focus will thank you.  — ArrowGO!").
- **Daily Streak (once per day on launch):** a hexagonal badge with a water drop, big streak
  number, "Daily Streak" title, a 7-day row (TUE WED THU ... with a check on days played), an
  encouraging line ("You are ready for a great week!") and a Continue button. Streak rules:
  playing on consecutive calendar days increases the streak, missing a day resets it to 1.
- **Home:** horizontal card carousel (Bronze League "Unlock Lv.11", Daily Challenge with today's
  date "Unlock Lv.20", Themes, Premium), the game title, a big Play button showing "Level N",
  a streak chip and a settings gear.
- **Game:** back arrow, "Level N" title, theme (palette) button, settings button, three blue water
  drops, the board centered, a hint button at the bottom.
- **Result:** three stars with confetti, "Flawless!" (0 mistakes) / "Great!" / "Cleared!",
  a stats card (Difficulty, Time mm:ss, Score with an A/B/C grade pill, Today's Levels), a row with
  accuracy %, mistakes count and hints used, then a "Next Level" button.
- **Premium (demo only):** an "ImranO Premium" page listing benefits (no ad breaks, unlimited
  hints, instant drop refill, all themes, leagues and daily challenge unlocked early), monthly and
  yearly plan cards. **No real payment.** Clearly label it "Demo: no payment is processed".
  Because I am the author, tapping Subscribe must unlock Premium instantly, show a celebratory
  toast ("Author build: Premium unlocked"), and persist in localStorage. Also provide a
  "Cancel Premium (demo)" switch so I can test both states.
- **Fake ad break:** for non-premium players, every third cleared level shows a 3-second
  "Ad break" interstitial with a "Remove ads with Premium" link. Premium skips it.
- **Bronze League:** weekly leaderboard with deterministic rival names and scores plus the
  player's weekly score. Locked until level 11 unless Premium.
- **Daily Challenge:** one larger puzzle seeded by today's date, completion marked with a trophy.
  Locked until level 20 unless Premium.
- **Themes:** Cream (default), Night, Ocean, Forest; two of them Premium-only.
- **Settings:** sound on/off, vibration on/off, reset progress (with confirm), About ImranO.

## Branding

- Company: **ImranO** (publisher splash reads "ImranO Games"). Never use the reference brand name.
- **Logo:** same concept as the reference (nested arrows forming a maze) but a new design: a
  rounded-square tile with a deep indigo-to-teal gradient and three nested L-shaped arrows in
  coral, amber and cream spiralling toward the centre. Deliver it as SVG and use it for the
  favicon, PWA icon, splash and home screen.
- Palette: warm cream background (#F5EBD8), cocoa text (#5C3F26), terracotta primary (#C77A3A),
  sky-blue drops (#4DA3F0). Rounded 20px cards, soft shadows, friendly rounded sans-serif.

## Technical requirements

- Vanilla HTML, CSS and JavaScript (no build step) so it runs from any static host or GitHub Pages.
- Mobile-first, 100% touch friendly, no horizontal scroll, works at 360px wide and on desktop.
- SVG board, requestAnimationFrame animations, WebAudio-synthesised sounds (no audio files),
  navigator.vibrate haptics.
- Persist everything in localStorage: level, premium, streak, played dates, today's level count,
  hints, theme, settings, weekly score, daily challenge completion.
- PWA: manifest.json, SVG icon, service worker that caches the app for offline play.
- Clean code split into index.html, styles.css, app.js (+ levels.js for the generator). Comment
  the generator and the slide/collision logic.

## Acceptance checklist (verify every item before you stop)

- [ ] Levels 1 to 30 all generate and are solvable by following the generator's solution order.
- [ ] Tapping a free arrow slides it off smoothly; a blocked one bumps, bounces and costs a drop.
- [ ] Clearing a level shows the result screen with correct time, score, grade, stars and counters.
- [ ] Streak screen appears once per day; streak increments on consecutive days and resets after a gap.
- [ ] Premium Subscribe unlocks instantly, persists after reload, and can be cancelled from the demo switch.
- [ ] Non-premium players see the ad break every 3rd level; premium players never do.
- [ ] League and Daily Challenge are locked at the right levels and unlocked by Premium.
- [ ] Themes apply everywhere and premium themes are gated.
- [ ] No console errors; Lighthouse PWA installable; works offline after the first load.
- [ ] Everything is committed and pushed.
