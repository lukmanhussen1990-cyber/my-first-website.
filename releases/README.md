# Last Mile — Android builds

| File | What it is |
|---|---|
| `LastMile-1.0.0.apk` | **Version 1.0.0** — onboarding (Prepare → Complete → Go Home + finish-line setup), Home dashboard with live exam & going-home countdowns, Exam countdown & schedule, Study Planner (week/month calendar, daily missions, streak, subject progress), Subject details (Topics, Notes, Quizzes, PYQs), add/edit subjects, Achievements, dark theme, local reminders. AI Buddy, Journey, Journal, Stress control, Checklist and Settings show "coming in the next update" screens. |

**Install:** open the download link on your Android phone (Android 7.0+, 64-bit), open the `.apk`,
and allow "Install unknown apps" for your browser / file manager when prompted. It installs over the
0.9.0 preview.

SHA-256 `LastMile-1.0.0.apk`: `ec89fc618444df21da674fc5800e91d6059fbba67b03c96f9b32fb8a7d2e97a3`

Builds are signed with the standard debug key (fine for sideloading). Play Store builds use
`eas build -p android --profile production`.
