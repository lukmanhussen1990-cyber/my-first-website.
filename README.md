# JARVIS - a voice assistant for Android (by Imran)

A real Android app (Kotlin, Jetpack Compose, Material 3). Talk to it in **Hindi or English**, and it answers
out loud and can operate the phone: open apps, call, WhatsApp, YouTube/Google search, flashlight, alarms and
timers, volume, Wi-Fi/Bluetooth screens, time, battery, and read your notifications.

- Package name: `com.imran.jarvis` - Min Android 8.0 (API 26) - Target Android 17 (API 37) - Dark theme only
- The "brain" is the AI service you choose in Settings: **Gemini**, **OpenAI** or **Claude**, with **your own API key**.

## Get the APK on your phone (no computer needed)

1. Open this repository on GitHub in your phone's browser and tap the **Actions** tab.
2. Tap the newest run named **Build JARVIS APK** (a green tick means it worked; the first build takes ~5-8 minutes).
3. Scroll to the bottom to **Artifacts** and tap **JARVIS-debug-apk**. A `.zip` file downloads.
   (If you do not see "Artifacts", switch the browser to *Desktop site*.)
4. Open the zip with the **Files** app (tap it, then *Extract*). Inside is **app-debug.apk**.
5. Tap **app-debug.apk**. Android will ask you to allow "Install unknown apps" for the app you used
   (Files or Chrome) - allow it, then tap **Install**.
6. Open **JARVIS**.

To start a build by hand: **Actions** > **Build JARVIS APK** > **Run workflow**.

## First-time setup (2 minutes)

1. Get an API key from the provider you like:
   - Gemini: <https://aistudio.google.com/apikey> (has a free tier)
   - OpenAI: <https://platform.openai.com/api-keys>
   - Claude: <https://console.anthropic.com/settings/keys>
2. In JARVIS tap the gear icon, choose the **AI provider**, paste the key and tap **Save API Key**.
   The key is stored encrypted on your phone only.
3. Choose **Language** (Hindi/English) and **Voice** (Male/Female). You will hear a short sample.
4. Go back, tap the big mic, allow the microphone, and talk. Examples:
   - "JARVIS, YouTube kholo" - "Rahul ko call karo" - "WhatsApp pe Amit ko message bhejo"
   - "Torch on karo" - "Kal subah 6 baje ka alarm lagao" - "10 minute ka timer" - "Battery kitni hai?"
   - "Mere notifications padho"

## Always on

Settings > **Always On** keeps JARVIS ready all the time:

- A quiet **"JARVIS is on - Tap to talk"** notification stays in your notification shade. Tap **Talk** from anywhere.
- Add the **JARVIS tile** to Quick Settings (swipe down twice, tap the pencil, drag JARVIS in) for one-tap talking.
- After each answer JARVIS **keeps listening** for your next sentence; just stay quiet to stop.
- It comes back by itself after the phone restarts.
- If your phone still closes it (common on Xiaomi, Oppo, Vivo, Samsung), tap the hint in the card and set JARVIS to
  *Unrestricted* / *Don't optimize* battery use.

JARVIS never records in the background: the microphone is only used while JARVIS is on screen.

## Notes

- **Speech recognition and the AI need internet.** Hindi/English voices come from Google's speech services on your phone.
- **Hindi voice missing?** Phone Settings > Languages > Text-to-speech > Google > install the Hindi voice data.
- **Male/Female voice** depends on the voices installed on your phone; if none can be told apart, JARVIS changes the pitch instead.
- **Reading notifications:** switch on *Notifications* in JARVIS Settings, then turn on JARVIS in "Notification access".
  If that switch is greyed out ("Restricted setting"): Settings > Apps > JARVIS > top-right **(...)** menu > **Allow restricted settings**.
  Notification text is read out on the phone and is **not** sent to the AI.
- **Calls** need the Phone + Contacts permission, asked when you switch on *Calls* or the first time you ask for a call.
- **Models:** each provider defaults to its fast, low-cost model (Gemini 3.5 Flash-Lite, GPT-6 Luna, Claude Haiku 5.5).
  Settings > *AI Model* lets you pick a smarter one or type any model name (AI companies rename models over time).

## Build it yourself (optional)

```
./gradlew assembleDebug        # APK: app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest    # unit tests
```

Needs JDK 17+ and the Android SDK (API 37). `.github/workflows/build.yml` does exactly this in the cloud.

## Where things are

| Folder (`app/src/main/java/com/imran/jarvis/`) | What it does |
|---|---|
| `ui/` | The three screens (Home, Listening, Settings), the animated orb, sound wave, buttons, theme |
| `voice/` | Speech-to-text (`SpeechRecognizer`) and text-to-speech |
| `ai/` | System prompt, the Gemini / OpenAI / Claude clients, reply parser, 10-message memory |
| `actions/` | Everything JARVIS does on the phone (apps, contacts, flashlight, alarms...) |
| `data/` | Settings and the encrypted API-key store |
| `service/` | Notification reader |
| `i18n/` | Sentences JARVIS says by itself (errors, time, battery) in Hindi and English |

Font licence: see `THIRD_PARTY_NOTICES.md`.
