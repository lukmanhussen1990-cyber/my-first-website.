# WePlay Drawing Guesser AI

A floating AI overlay for WePlay "Guess My Drawing". It captures the screen, sends frames to a Claude
vision model, and shows ranked guesses in a draggable window above the game.

## Install
1. Copy `release/WePlayDrawingGuesserAI-1.0.0.apk` to your phone (Android 10+) and open it.
   Allow "Install unknown apps" for your file manager or browser when asked.
2. Open the app, paste your Anthropic API key (console.anthropic.com), and tap **Test connection**.
3. Allow **Display over other apps**. Notifications and Usage access are optional; Usage access lets the AI sleep when WePlay is closed.
4. Tap **Start AI** and accept the screen-sharing prompt. WePlay opens with the overlay on top.

## Using the overlay
- Drag it anywhere. **–** minimizes it to a bubble and **✕** stops the assistant.
- Tap a guess to copy it, then paste it in the game chat. **Next Guess** drops the top answer and copies the next one.
- Hold a guess when it was correct. The drawing and answer are saved, and that answer ranks higher in later rounds.
- **Settings** has model (Opus 5.5 / Sonnet 5.5 / Haiku 5.5 / custom), capture speed (1/2/5 s), API base URL, and the game package.

## Build
```
./gradlew :app:assembleRelease   # needs Android SDK 35; JDK 17+
./gradlew :app:testDebugUnitTest
```
Release signing reads `keystore.properties` (git-ignored). Without that file, the release build is signed with the debug key.
