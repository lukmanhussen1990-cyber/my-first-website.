# WePlay Drawing Guesser AI

A floating AI overlay for WePlay "Guess My Drawing". It captures the screen, sends frames to a Claude
vision model, and shows ranked guesses in a draggable window above the game.

## Install
1. Copy `release/WePlayDrawingGuesserAI-1.3.0.apk` to your phone (Android 10+) and open it.
   Allow "Install unknown apps" for your file manager or browser when asked.
2. Open the app, paste your Anthropic API key (console.anthropic.com), and tap **Test connection**.
3. Allow **Display over other apps**. Notifications and Usage access are optional; Usage access lets the AI sleep when WePlay is closed.
4. Tap **Start AI** and accept the screen-sharing prompt. WePlay opens with the overlay on top.

## Using the overlay
- Drag it anywhere. **–** minimizes it to a bubble and **✕** stops the assistant.
- Tap a guess to copy it, then paste it in the game chat. **Next Guess** drops the top answer and copies the next one.
- Hold a guess when it was correct. The drawing and answer are saved, and that answer ranks higher in later rounds.
- **Settings** has the model (Haiku 5.5 by default, then Sonnet 5.5, Opus 5.5, or a custom ID), fast mode, capture speed (1/2/5 s), your own word list, compact/normal window, API base URL, and the game package.

## What's new in 1.3.0
- **Reads WePlay's real hint format:** `4 letters|A state` (letter count plus category clue). The clue is shown under the count in the window and given to the AI.
- **Uses the answer the game shows:** when the top bar shows the word (you guessed it) or the round-over popup says "Word: fear", it's pinned as **✓ Answer** (tap to copy) and saved to the learning history automatically, once per round.
- **No leftovers between rounds:** a round ends at the popup, at a new hint/clue, or when the game shows the answer. Guesses from the previous word (e.g. Crab/Lamp before "fear") no longer carry over, even when both words have 4 letters.
- **Steady guesses:** guesses add up over the round and fade slowly when a frame misses them, so a good guess like "Halwa" stays near the top instead of disappearing after one bad frame.
- **Correct crops:** the canvas and hint positions are measured from real WePlay screenshots. The app only re-learns them from a normal guessing screen (never a popup), and only after seeing the same new layout twice.
- **Better prompting:** canvas clues written as partial spellings ("halw_" → Halwa) or Hindi/Hinglish ("DAR" → Fear) are decoded and fitted to the hint.

## What's new in 1.2.0
- **Sharper hint reading:** after one whole-screen look, the app sends close-ups of the top bar (the hint) and the canvas instead of a shrunken full screen. The AI is told never to count words written on the canvas or in the chat.
- **Steady word count:** a new reading must be seen twice in a row before it replaces the current one.
- **Fix the hint yourself:** tap the hint in the window and use +/- for words (W) and letters (L). 🔒 shows it's locked until the next word; "Auto" goes back to the AI's reading.
- **Plurals and "A":** near misses are reshaped to fit the hint: Snail → Snails, Bike → A Bike (a 1-letter word is "A"), Fire Fly → Firefly.
- **More word hints:** 708 entries, adding "A …" answers, common plurals, and Indian games, foods, festivals and brands.
- **Better change detection:** only the canvas and the hint are watched, at a finer grid, so thin new strokes trigger a fresh guess and chat or timer changes don't.
- **Refresh** now re-reads the hint from scratch with a whole-screen look.

## What's new in 1.1.0
- **Faster:** Claude Haiku 5.5 is the default, with thinking off. Replies stream, so the first guess appears as soon as it is written. Up to two frames are analysed at once, and captures run on a fixed beat. If your key can't use Haiku, the app switches to Opus 5.5 by itself.
- **Word list:** common answers grouped by hint shape (1 letter → A; 2 letters → TV, GO, AC, CD, DJ; 2 words • 8 letters → Free Fire; …). The AI is told which ones fit the hint, and they fill the list when the AI runs short. Add your own words under Settings → Word list (`Free Fire|90` ranks a word higher).
- **Compact window:** about a quarter of the screen. Tap a guess to copy it (a ✓ marks it); Next / Refresh / Pause sit on one row.

## Build
```
./gradlew :app:assembleRelease   # needs Android SDK 35; JDK 17+
./gradlew :app:testDebugUnitTest
```
Release signing reads `keystore.properties` (git-ignored). Without that file, the release build is signed with the debug key.
