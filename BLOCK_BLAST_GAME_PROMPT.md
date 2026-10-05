# PROMPT: Build a "Block Blast" style puzzle game for Android and deliver a downloadable APK

Copy everything below this line and paste it to the AI coding agent.

---

## Time budget (strict)

You must work continuously on this task for **a little more than 4 hours (4h00m to 4h15m of active work)**.
- Do **not** stop before 4 hours have passed, even if you think the game is finished. Use any remaining time for polish, bug fixing, testing on an emulator, and improving animations.
- Do **not** go past about 4 hours 15 minutes. At that point, finish whatever is in progress, build the final APK, commit, push, and deliver.
- Note the start time in your first message and the elapsed time at every milestone so I can verify it.

## What to build

Build a full clone of the mobile game **"Block Blast"** (the 8x8 block puzzle game). It must look and feel like the original, including the same colors, layout and animations:

### Screens
1. **Splash screen 1**: plain white background with the app icon (a rounded square containing red, blue, yellow and green blocks). Show for about 2 seconds.
2. **Splash screen 2**: blue gradient background (top #2F6BE0 to bottom #1F4FBF) with a studio logo text in the center, then the game logo "BLOCK BLAST" in bubbly yellow/pink/blue 3D letters with a small gold crown on the letter "O" and the subtitle "ADVENTURE MASTER". Small yellow blocks animate while loading.
3. **Game screen** (the main screen):
   - Dark navy/blue background (#2E4A8E style, slightly lighter than the board).
   - Top left: gold crown icon + the **best score** in yellow text.
   - Top right: a **settings gear icon** with a small red notification badge.
   - Center top: the **current score** in big white bold numbers.
   - Center: an **8x8 board** with a dark blue background (#1C2F62), subtle grid lines, rounded corners and a dark shadow.
   - Bottom: a **tray with 3 random pieces** shown at about 60 percent of the board cell size, evenly spaced.

### Gameplay rules (must match the original exactly)
- The board is 8 columns by 8 rows.
- Three pieces appear in the tray. The player **drags** a piece from the tray onto the board. While dragging, the piece grows to full cell size and floats slightly above the finger so the player can see it. A **ghost preview** shows where it will land; cells that would be cleared glow in that piece's color.
- A piece can only be dropped where every one of its cells lands on an empty board cell. If dropped on an invalid spot it animates back to the tray.
- When a **full row or full column** is filled, it clears with a flash and particle burst animation. Multiple lines can clear at once.
- When all 3 tray pieces are used, 3 new random pieces appear.
- **Game over** when none of the remaining tray pieces can fit anywhere on the board. Show a game over popup with the final score, best score, and buttons "Play Again" and "Home".
- Piece shapes (each in one random color from: red, orange, yellow, green, light blue, dark blue, purple):
  - 1x1 single block
  - 1x2, 1x3, 1x4, 1x5 straight lines (horizontal and vertical)
  - 2x2 square, 3x3 square
  - L shapes (2x2 and 3x3, all 4 rotations)
  - T shape (all 4 rotations)
  - S and Z shapes (both orientations)
  - 2x3 and 3x2 rectangles
  - Small corner (3 cells) in all 4 rotations
  - Diagonal 2-cell and 3-cell pieces
- Blocks are drawn as **glossy 3D beveled cubes** (lighter top-left edge, darker bottom-right edge, bright highlight) in the same style as the original.

### Scoring (match the original)
- Placing a piece: +1 point per cell of the piece.
- Clearing 1 line: +10 points. Each extra line cleared in the same move adds more (2 lines = 30, 3 lines = 60, 4 lines = 100, and so on).
- **Combo**: if the player clears lines on consecutive moves, show a big "Combo" text with a blue to white gradient on the board and multiply the line bonus by the combo count. Show the floating "+20" style points text near the score, and a label like "Good", "Great", "Amazing", "Excellent" for bigger clears.
- Best score is saved on the device and updated automatically.

### Settings popup
- Gear icon opens a popup with toggles for **Sound**, **Music**, **Vibration**, and buttons for **Restart** and **How to Play**. Persist the settings.

### Polish
- Smooth 60 fps drag and drop animations.
- Satisfying sound effects: pick up, drop, line clear, combo, game over. Light haptic vibration on line clear.
- Portrait only. Support all phone screen sizes (the layout must scale by screen width).
- The app icon must be the rounded square with red, blue, yellow and green blocks.
- App name: **Block Blast**.

## Technical requirements

- Use **Flutter** (preferred) or **native Android with Kotlin**. If neither SDK can be installed in your environment, use **HTML5 Canvas + Capacitor** as a fallback, but the final result must still be a real installable APK.
- Target Android 8.0 (API 26) and above. Package name: `com.myapps.blockblast`.
- Build a **signed release APK** (create a keystore in the project, do not use a debug build). The APK must install directly on a phone when downloaded.
- Put the source code in a git repository. Commit regularly with clear messages.
- Write a short `README.md` explaining how to build the APK.
- Test the game on an Android emulator (or at least run all logic unit tests for: piece placement validation, line clearing, scoring, combo, and game over detection) and fix every bug you find.

## Delivery (mandatory)

At the end of the 4 hours you must give me:
1. A **direct download link to the APK file** (upload it as a GitHub Release asset, or any public file host). The link must work without login.
2. The link to the source code repository.
3. A short summary: what works, what was tested, known issues, and the total time spent.

Do not ask me questions during the task. If something is unclear, make the choice that is closest to the original Block Blast game and keep working. Do not finish early. Do not deliver a web link instead of an APK.
