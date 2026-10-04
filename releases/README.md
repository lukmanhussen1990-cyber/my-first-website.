# Last Mile — Android builds

| File | What it is |
|---|---|
| `LastMile-preview-0.9.0.apk` | **Preview build** — opens to the live Home dashboard (ticking exam & going-home countdowns, tappable daily missions, sample study plan). Other screens arrive in the full 1.0 build. |

**Install:** download the `.apk` on your Android phone (Android 7.0+, 64-bit), open it, and allow
"Install unknown apps" for your browser / file manager when prompted.

SHA-256 `LastMile-preview-0.9.0.apk`: `ef662464c17fddbf38c508ffc112731ec376ebbd11df8a894496e3ed4d0c4ccf`

Builds are signed with the standard debug key (fine for sideloading). Play Store builds use
`eas build -p android --profile production`.
