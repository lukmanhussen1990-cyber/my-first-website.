# my-first-website.

**Claude Runner** — a Chrome-dino-style endless runner, in a single self-contained
HTML file. No build step, no dependencies, no network calls: open `index.html` in
any browser and it runs.

## Play

- **Space** / **↑** — jump (hold for a higher jump, tap for a hop)
- **↓** — duck, and fast-fall when airborne
- **P** pause · **M** sound · **R** restart
- On touch devices: tap to jump, tap near the ground to duck, or use the
  on-screen **JUMP** / **DUCK** buttons.

## What's in it

- The runner is drawn from geometry sampled directly out of the source artwork,
  so the sprite is pixel-accurate to the original character.
- A four-beat leg cycle — each leg plants for 60% of the stride and swings
  forward through an arc for the rest — plus distinct jump, duck, idle and
  wiped-out poses.
- Cacti in two sizes and three shapes, and birds at three flight bands: one you
  must jump, one you must duck, and one you simply run under.
- Speed ramps from 7 to 15.5 px/frame; obstacle spacing is derived from how far
  a full jump actually carries the runner, so the rhythm stays constant in time.
- Day/night cycle every 700 points, dithered pixel clouds, a moon that changes
  phase, scrolling ground detail, landing dust and a screen shake on death.
- High score persists in `localStorage`. WebAudio square-wave blips, mutable.
- The logical viewport narrows on phones instead of shrinking, so the runner
  stays the same size on a small screen.

## Hosting

It's one file, so anything that serves static files works. To publish with
GitHub Pages: **Settings → Pages → Deploy from a branch**, pick the branch and
the root folder.
