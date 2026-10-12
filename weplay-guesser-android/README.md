# WePlay Drawing Guesser AI

A floating AI overlay for WePlay "Guess My Drawing". It captures the screen, sends frames to a Claude
vision model, and shows ranked guesses in a draggable window above the game.

## Install
1. Copy `release/WePlayDrawingGuesserAI-1.6.0.apk` to your phone (Android 10+) and open it.
   Allow "Install unknown apps" for your file manager or browser when asked.
2. Open the app, paste your Anthropic API key (console.anthropic.com), and tap **Test connection**.
3. Allow **Display over other apps**. Notifications and Usage access are optional; Usage access lets the AI sleep when WePlay is closed.
4. Tap **Start AI** and accept the screen-sharing prompt. WePlay opens with the overlay on top.

## Using the overlay
- Drag it anywhere. In the panel, **–** folds it into the mini bar and **✕** stops the assistant.
- Tap a guess to copy it, then paste it in the game chat. **Next Guess** drops the top answer and copies the next one.
- Hold a guess when it was correct. The drawing and answer are saved, and that answer ranks higher in later rounds.
- **Settings** has the model (Haiku 5.5 by default, then Sonnet 5.5, Opus 5.5, or a custom ID), fast mode, accuracy boost, capture speed (1/2/5 s), your own word list, window size (Mini / Compact / Large), API base URL, and the game package.

## What's new in 1.7.0
A quality pass: fixes, less wasted work, and tests that play the app end to end. Answers still come only from the AI.
- **Fewer wasted requests:** a long hint that scrolls across the bar no longer counts as a change, so a drawing nobody touches is not re-sent every second (45–60 → 2 requests a minute). Rate limits now really slow the app down (40 → 5 requests in 40 s of 429s), and it picks up the normal pace as soon as the API answers again. A stalled connection is given up after 8–20 s instead of a minute, and a stale frame is never re-sent.
- **Steadier rounds:** a scrolling hint read with its start cut off ("ds 9 letters|Organ") no longer starts a false new word that wiped your Next-Guess choices. The ✓ on a copied answer no longer carries into the next word.
- **Clear problems:** a key or model that stops working is shown right in the mini bar ("⚠ Invalid API key — check Settings"); tap it to retry, or fix it in Settings and the AI resumes by itself. An address without https:// or an empty custom model ID is explained instead of failing every second.
- **No crash on phones with a broken secure storage:** the key is then kept until the app closes, and Home and Settings say so.
- **Smoother screens:** headings are readable again (they were black on the dark background), large system fonts no longer cut the overlay's answers, Settings chips and Home buttons fit narrow phones, and the app scan and word list load off the main thread.
- **Privacy and storage:** the history keeps only the drawing (never a whole screenshot with the chat), never pairs a word with another word's drawing, and keeps pictures for the newest 300 rounds.
- **Accessibility:** overlay buttons and Settings switches are named for screen readers; switch titles are tappable.

## What's new in 1.6.0
- **Mini window (new default):** one slim row under the drawing with the AI's top 3 answers as chips. Tap a chip to copy it, hold it to mark it correct, **»** for the next answer, **⌄** to open the panel; **–** in the panel folds it back. The chat and the answer box stay free for typing. Change the size in Settings → Overlay → Window size (Mini / Compact / Large).
- **Much less lag:**
  - The screen mirror only runs for the moment a frame is grabbed (about once a second) instead of redrawing the whole screen continuously. On phones that don't support this, it switches back automatically.
  - Every frame goes into one reused buffer at 1280 px instead of new full-screen images.
  - Change detection samples the canvas in place.
  - The window has no endless animations.
  - App switches are checked incrementally.
- **Faster replies:** the AI returns 6 answers with very short reasons instead of 10.
- Answers still come only from the AI.

## What's new in 1.5.0
- **Only the AI's answers:** every guess in the window is exactly what Claude returned through your API key, with its own confidence. The app no longer adds word-list guesses or reshapes answers.
- **Nothing hidden:** answers that fit the hint come first. Ones that don't fit are still shown after them, marked ⚠.
- **The AI shapes answers to the hint itself:** "2 words 9 letters" → "Heart Beat", not "Heartbeat"; "Snails"; "A Bike". It also reads scrolling hints like "2 words 9 letters|Organ".
- The word list and your confirmed answers are still sent to the AI as hints; the AI decides.

## What's new in 1.4.0
- **Accuracy boost:** Haiku answers instantly, and Claude Sonnet 5.5 double-checks the drawing every few seconds; its answers count for more. Turn it off in Settings → Model. It costs a little more per round.
- **Window stays off the drawing:** the AI can't see strokes under the floating window, so when you drop it on the canvas it slides just below. It starts there too. Turn this off in Settings → Overlay.
- **Looks before guessing:** the AI first writes a short description of what's on the canvas, spreads its 10 guesses over different ideas, and is told which answers you already rejected.
- **No junk suggestions:** the word list is only mentioned to the AI for distinctive hints (A, TV/GO/AC…, A Bike, Free Fire), not as random words for "4 letters".
- **Steady display:**
  - The list no longer reshuffles when two scores are close, or mid-answer.
  - The window keeps a fixed height.
  - The status line no longer flickers.
  - Answers about a previous word are thrown away.
- **Crash fix** when stopping the assistant during a capture.

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
./gradlew :app:testDebugUnitTest # JVM tests, including Robolectric journeys through the real app
./gradlew :app:testDebugUnitTest -Pscreenshots   # also writes screen and overlay images to app/build/outputs/roborazzi/
```
`ISSUE_LOG.md` lists what the 1.7.0 quality pass found and how each fix was checked.
Release signing reads `keystore.properties` (git-ignored). Without that file, the release build is signed with the debug key.
