# Al Ameen Academy, Badarpur – school app upgrade (v5.0 → v6.0)

The file you uploaded was the installed Android app exported as three "split" APKs.
Inside, the app is a small Android shell (made with Dream ERP) that opens one web page,
`assets/index.html`, and that page loads your school data (dashboard, accounts, profile,
alerts, tutorials) from the school's ERP server after the student signs in.
Everything below was done to that page and to the APK packaging. The Android code,
the server connection, notifications and all your data are untouched.

## What you get

| File | What it is |
| --- | --- |
| `app/Alameen_Academy_Badarpur-6.0.apk` | **One complete, installable APK** (the three split files merged, version 6.0, signed). |
| `index.html` | The new single-file page (HTML + CSS + JavaScript together) that is inside the APK. |
| `assets/` | The 5 vendor files the ERP server pages need (Bootstrap theme, jQuery, icon fonts). Unchanged. |
| `android/` | Signing key, rebuild script and instructions for future updates. |

## 1. Futuristic / modern look
- Dark theme by default with neon green + cyan glow accents, and a **light mode toggle**
  (header button and a switch in the menu). The choice is remembered on the phone.
- **Glassmorphism** everywhere: frosted-glass header, menu drawer, bottom navigation, cards,
  inputs and buttons (also applied to the pages that come from the server).
- **Animations**: splash with spinning glow ring, page content fades/slides in with a stagger,
  skeleton shimmer while a page loads, button press and hover glow, animated drawer and
  bottom bar, pulsing "live" badges, smooth theme change.
- **Google Fonts**: Inter (text) + Space Grotesk (headings), loaded without blocking rendering
  and falling back to the system font when offline.
- **Animated background**: soft moving gradient orbs plus a very light particle canvas
  (~30 fps, 18–46 particles depending on screen size, pauses when the app is in the background,
  switched off when the phone asks for reduced motion).

## 2. Everything works
- Menu, refresh, back and page links now work without reloading the whole page (smooth AJAX
  navigation with proper browser history, so the Android back button steps back through pages).
- Native viewers used by the server (PDF, video, YouTube, audio, image, download, share)
  are passed through to the Android shell exactly as before.
- Friendly error card with a **Try again** button instead of plain "Server Connection Failed" text.
- Online/offline banner rewritten (the old one was obfuscated code); shows "No internet
  connection" and "Your internet connection is back".
- Removed dead code: duplicated dark-mode handlers, invalid CSS comments (`// …`), the unused
  template script (`app.js`) and the duplicate Popper library (Bootstrap already includes it).
- **New Exam Routine page** (menu → Exam Routine, header calendar button, bottom bar "Exams"):
  - **Search** bar: subject, class, date ("12 Oct", "Monday", "tomorrow"), room, note.
  - **Filter by class** (chips – the student's choice is remembered) and **by date**
    (All / Today / Upcoming / Past, or pick an exact date).
  - **Today's exams highlighted** with a glowing "TODAY" tag; finished exams are dimmed.
  - **Live countdown** (days : hours : min : sec) to the next exam, "Happening now" while an
    exam is running, plus today / upcoming / total counters.
  - **Print / Save as PDF** button (opens the print dialog with a clean A4 sheet) and
    **Copy as text** (paste into WhatsApp / Notes).
- Verified in a headless Chrome at 320 px, 390 px and 1280 px: **0 console errors,
  0 failed requests, no horizontal scrolling**.

## 3. Mobile friendly
- Thumb-sized 44–54 px buttons, a 5-item bottom navigation bar (Home, Accounts, Exams,
  Alerts, Menu), safe-area padding for notched phones, no sideways scroll, inputs sized 16 px
  so Android does not zoom when typing.

## 4. Kept
- School name "Al Ameen Academy, Badarpur", logo, all menu items (Home, Accounts, My Profile,
  Alerts, Tutorial), the ERP server address, the device/token handling, the floating action
  button styles, the sign-in flow – nothing was removed.
- One single HTML file for the app page. The only other files are the 5 vendor files the
  server pages require (they were already in the app).
- No new libraries added. Total page: ~120 KB including the embedded logo.

## Important notes (please read)

1. **Install:** the new APK is signed with a new key, so Android will not install it over the
   old vendor-signed app. **Uninstall the old app first**, then install
   `app/Alameen_Academy_Badarpur-6.0.apk`. Students sign in again afterwards.
2. **Exam routine data:** the APK did not contain any exam dates (all school data lives on the
   ERP server behind the login), so the routine page ships with a clearly marked
   **SAMPLE routine**. To publish the real one, open `index.html`, find `EXAM_ROUTINE` near the
   top of the script and add one line per exam, e.g.
   `{ cls: 'Class 10', subject: 'Mathematics', date: '2026-11-03', start: '09:00', end: '12:00', room: 'Hall A' }`,
   then rebuild the APK (see `android/README.md`). The sample disappears automatically once
   real exams are entered.
   Optional: set `ROUTINE_URL` to a public JSON file (for example on GitHub Pages) and the app
   will download the latest routine every time it opens – no rebuild needed for changes.
3. **Printing inside the app:** Android WebView apps cannot talk to a printer. In the app the
   button opens a clean print view with **Copy as text**; in any browser (or if you set
   `ROUTINE_WEB_URL` to a hosted copy of this page) the same button opens the normal
   Print / Save as PDF dialog.
4. **Push notifications** still use the vendor's Firebase project. They normally keep working
   after re-signing; if they stop, the Firebase console needs the new certificate fingerprint
   listed in `android/README.md`.
