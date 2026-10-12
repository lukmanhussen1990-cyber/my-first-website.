# QA / performance session — issue log

Session clock (UTC): start 2026-10-12 06:19:42, deadline 12:19:42 (21,600 s). Final 20 minutes reserved for verification and handoff.

## Baseline (06:24 UTC, commit 1a6d0f2, release 1.6.0)

| Check | Result |
|---|---|
| Unit tests (`./gradlew :app:testDebugUnitTest`) | 73 passed, 0 failed (5.4 s test time) |
| Lint (`:app:lintDebug`) | 0 errors; 13 warnings (12 GradleDependency "newer version available", 1 DataExtractionRules) |
| Clean build: tests + lint + release APK | 265 s |
| Release APK size | 17,762,596 bytes |
| Device / emulator run | Not available: the container has no KVM, so no Android emulator. UI and app flows are exercised on the JVM with Robolectric instead (see below). |

Main user journeys:
1. First run: Setup (API key, test connection) → Permissions (overlay, notifications, usage access) → Home.
2. Start AI: Home → screen-capture consent → foreground service → floating window over WePlay.
3. In game: capture loop → AI guesses in the window → tap to copy, » next, hold = correct, hint editor, expand/collapse, pause, refresh, close.
4. Settings: key, endpoint, model, speed, word list, window size, toggles, test connection.
5. History: learned drawings, clear.

## Issues

Priority: P1 crash / broken / data loss / security · P2 performance, lag, excess work, inconsistent state · P3 navigation, error/empty states, usability, accessibility · P4 small improvements.

| # | Pri | Issue | Evidence | Change | Verification |
|---|---|---|---|---|---|
| 1 | P1 | App crashes on Setup → Continue (and on any Settings change) when the Android Keystore fails | New Robolectric journey test (no Keystore available) crashed: `KeyStoreException: AndroidKeyStore not found` thrown from `KeyCipher.encrypt` ← `SettingsRepository.save` ← Continue click on the main thread. On phones the same path is hit by keystore errors after backup/restore or a keystore reset. | `KeyCipher` implements a new `SecretCipher` interface whose calls never throw; a damaged key entry is regenerated once. If encryption still fails, the key is kept in memory only (never written in plain text), `SettingsRepository.keySaved` turns false, Home shows "API key: Until app closes" and Settings explains why. An unreadable stored key is dropped instead of being carried forward. | `FirstRunJourneyTest` (Setup → Permissions → Home) passes; it failed with the crash before. `SettingsRepositoryTest`: broken keystore keeps the key in memory and no pref value contains the key. |
| 2 | P2 | Every settings change re-encrypted the API key through the Keystore on the main thread, even when the key had not changed (each keystroke in "custom words", model ID, base URL, every toggle) | Measured with a counting cipher: one Settings visit (4 toggles + typing 21 characters) = **25** Keystore encrypt calls. | `SettingsRepository` keeps the stored ciphertext and only encrypts when the key itself changes (or a previous attempt failed). | Same scripted visit after the fix: **0** encrypt calls (`SettingsRepositoryTest` asserts 1 total, for the key entry). Real-device latency per Keystore call (binder round trip) was not measurable here; the improvement is expected, the call count is measured. |
| 3 | P2 | A scrolling (marquee) hint made every capture look "changed", so a still drawing was re-sent to the AI on every beat: more API cost, both request slots busy, guesses churning | The user's own screenshot shows the hint mid-scroll ("ds 9 letters\|Organ"). Simulating that scroll on the real screenshot with the app's fingerprint maths: 60 requests/min (static hint: 1). Same with real rendered pixels through `FrameTools.fingerprint` on Robolectric: 45–60 requests/min at 5–150 px/s. | New `ChangeGate`: canvas and hint are judged separately; a hint that changed on two captures in a row is treated as animating and only the canvas counts until it settles (motion judged on a finer threshold so slow scrolls are caught). One-off hint changes still trigger at once. Also drops a per-capture array concat. | `MarqueeHintTest` (real pixels): **45–60 → 2** requests/min with a still drawing, at 5/20/60/150 px/s. New strokes under a scrolling hint still go out on the same beat; an answer replacing the marquee goes out one beat later. `ChangeGateTest`: static screens, one-off and rapid hint changes send exactly as before. |
| 4 | P2 | A scrolling hint read with its start cut off ("ds 9 letters\|Organ" → 1 word, 9 letters) started a false "new word": guesses re-blended from scratch, the user's Next-Guess rejections were forgotten, in-flight answers dropped; a solved word became unsolved after one such reading | 3 new `RoundTrackerTest` cases failed before the fix (round id changed 1 → 2; `solved` became false). The user's screenshot shows exactly this cut-off hint. | `HintPattern.cutOffReadingOf`: same letter count and same clue but a different word count is the same word; the tracker keeps the higher word count (a cut only loses words) and does not vote for a new word. | The 3 tests pass; all earlier hint rules (one misread ignored, two different readings switch, popup ends the word) still pass. Known limit: two consecutive words with the same clue and letter count but a different word count, with the round-over popup missed, are not split (rare; Refresh fixes it). |
| 5 | P2 | Main-thread work when opening screens: Settings scanned every launcher app on the phone (`loadLabel` per app) and parsed the 708-entry word list on the UI thread each time it opened; Home re-ran the same scan on every resume while no WePlay package was stored | Code path: `SettingsViewModel.wePlayApps by lazy { findWePlayApps }` read during the first composition; `HomeViewModel.detectGame()` from `LifecycleResumeEffect`. Counting the built-in words also evicted the session's cached word bank. | Both scans run on `Dispatchers.IO`; Settings shows the list (and the "not found" note) only once the scan has finished; Home ignores repeat resumes while a scan runs. Word count reads the built-in list size directly. | `HomeSettingsJourneyTest` (fake WePlay installed): Home stores the package found in the background; Settings lists "WePlay" and the word count, with no "not found" flash; Back returns Home. Jank reduction on a phone is expected, not measured (no device). |
