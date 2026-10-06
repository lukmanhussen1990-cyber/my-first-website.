# ArrowGO! architecture

ArrowGO! (by ImranO) is an arrow-untangle puzzle game written in vanilla HTML, CSS and
JavaScript with no build step. The same web files run on GitHub Pages / any static
host (as an installable offline PWA) and inside the Android APK (a thin WebView shell).

## File layout

```
index.html          all screens (sections), loads levels.js then app.js
styles.css          design tokens, themes, layout, animations
levels.js           deterministic seeded level generator + geometry helpers (window.ArrowLevels)
app.js              game app: screens, board rendering, animation, audio, storage, premium, ads...
sw.js               service worker (offline cache of the app shell)
manifest.json       PWA manifest
icons/              logo.svg, favicon.svg, icon-192.png, icon-512.png, maskable-512.png,
                    apple-touch-icon.png, logo-mark.svg (arrows only, transparent)
android/            WebView wrapper (no Gradle) + build-apk.sh -> dist/ArrowGO.apk
tests/              node + playwright test scripts
dist/ArrowGO.apk    signed release-style APK built from the web files
```

## Coordinates and arrows

* The board is a square grid of `size x size` cells. A cell is `[r, c]` (row, column),
  `r` grows downward, `c` grows rightward, both 0-based.
* An arrow is `{ id, cells, dir }`:
  * `cells` is an ordered list of 2..8 orthogonally adjacent, distinct cells,
    **tail first, head last**.
  * `dir` is one of `'U' | 'D' | 'L' | 'R'` and always equals the direction of the last
    segment (`head - previous cell`). The arrowhead is drawn at the head cell pointing `dir`.
* Arrows never overlap: each cell belongs to at most one arrow.
* `DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] }`.

### Movement rule (the one rule everything depends on)

Tapping an arrow makes it move like a snake: the head advances one cell at a time in
`dir`, every body cell follows the cell in front of it. Therefore the only cells the arrow
can ever collide with are on the **exit ray**: the cells from the head (exclusive) straight
in `dir` to the board edge. The body only ever re-visits cells the head already passed.

* If every cell of the exit ray is empty the arrow leaves the board and is removed.
* Otherwise the first occupied cell on the ray is the **blocker**. The arrow slides
  `distance` cells (the number of empty ray cells before the blocker), bumps, bounces back
  to its original cells and the player loses one drop.

Removing an arrow never blocks another arrow, so "is the board solvable" can be decided
greedily: keep removing any free arrow; the board is solvable iff it becomes empty.

## `levels.js` API (`window.ArrowLevels`, also `module.exports` under Node)

```
ArrowLevels.DIRS                         // { U:[-1,0], D:[1,0], L:[0,-1], R:[0,1] }
ArrowLevels.levelParams(n)               // { size, arrows, minLen, maxLen } for level n >= 1
ArrowLevels.generateLevel(n)             // -> Puzzle (deterministic: same n => same puzzle)
ArrowLevels.generateDaily('YYYY-MM-DD')  // -> Puzzle, larger board seeded by the date
ArrowLevels.exitRay(arrow, size)         // -> [[r,c], ...] cells from head (exclusive) to edge
ArrowLevels.buildGrid(arrows, size)      // -> size x size array of arrow id or -1
ArrowLevels.findBlocker(arrow, grid, size) // -> null if free, else { id, distance, cell }
ArrowLevels.freeArrows(arrows, size)     // -> ids of arrows that can currently leave
ArrowLevels.solve(arrows, size)          // -> greedy removal order (ids) or null if stuck
ArrowLevels.verify(puzzle)               // -> true if puzzle.solution clears the board
ArrowLevels.mulberry32(seed), ArrowLevels.hashString(str)   // seeded RNG helpers

Puzzle = {
  key:      'L12' | 'D2026-10-06',
  level:    12 | null,
  size:     7,
  arrows:   [ { id: 0, cells: [[r,c],...], dir: 'U' }, ... ],   // ids are 0..k-1
  solution: [ ids in removal order ]   // = reverse of generation/placement order
}
```

### Generator contract

Arrows are generated one at a time. A candidate arrow is accepted only if its exit ray does
not cross any arrow placed before it (and not its own body). Consequently the reverse of the
placement order is a valid solution: the last placed arrow has a clear ray on the full board,
once it is gone the one placed before it has a clear ray, and so on.

Difficulty ramp (targets, the generator must hit them exactly):

| level   | size | arrows                         |
|---------|------|--------------------------------|
| 1       | 4    | 2                              |
| 2       | 5    | 4                              |
| 3-5     | 5    | 5..7                           |
| 6-12    | 6    | 7..11                          |
| 13-22   | 7    | 11..16                         |
| 23-35   | 8    | 15..22                         |
| 36-60   | 9    | 22..32                         |
| 61+     | 9    | 30..36 (seeded variation)      |
| daily   | 10   | 38..42                         |

## Android bridge (`window.AndroidBridge`, only inside the APK)

```
AndroidBridge.vibrate(ms)                 // haptic pulse
AndroidBridge.setSystemBars(hex, darkIcons) // status/navigation bar colour per theme
AndroidBridge.exitApp()
AndroidBridge.getAppVersion()             // "1.0.0"
```

The Activity forwards hardware back presses to `window.ArrowGO.handleBack()`; the page returns
`true` if it handled the press (closed a sheet, went back a screen) or `false` to let the app
close. It calls `window.ArrowGO.onPause()` / `onResume()` on lifecycle changes.
The APK serves the web files from `https://appassets.androidplatform.net/` (assets/www), so
`localStorage` works on a normal secure origin. The service worker is not registered inside
the APK (files are already local).

## Persistence

Everything lives in `localStorage` under the key `arrowgo.v1` (one JSON object): level,
premium, streak, played dates, today's level count, hints, theme, settings, weekly league
score, daily challenge completion, stats, tutorial flag.
