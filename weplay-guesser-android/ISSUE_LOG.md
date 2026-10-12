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
