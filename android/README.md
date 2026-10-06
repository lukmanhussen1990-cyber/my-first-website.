# Rebuilding the app after editing `index.html`

The APK in `../app/` is the vendor's Android shell with **one file replaced**:
`assets/index.html` (the page in the root of this repository). To ship a change
(for example the real exam routine), edit `index.html`, then rebuild and re-sign:

```bash
# 1. Android build-tools (zipalign + apksigner). Any recent version works:
#    https://developer.android.com/tools/releases/build-tools
export BUILD_TOOLS=/path/to/Android/Sdk/build-tools/37.0.0

# 2. the keystore password you received with the first build
export KS_PASS='...'

# 3. rebuild: takes the current signed APK, swaps index.html, aligns and signs
./android/rebuild_apk.sh app/Alameen_Academy_Badarpur-6.0.apk index.html app/Alameen_Academy_Badarpur-6.1.apk
```

Notes

- The keystore `keystore/alameen-release.jks` (alias `alameen`) is what students' phones
  will trust from now on. **Keep it and its password safe**; an app signed with a
  different key cannot be installed over this one. The password is *not* stored in the
  repository (the file `keystore/password.txt` is ignored by git).
- Certificate fingerprint of this key (needed only if Firebase push notifications must
  be re-registered in the Firebase console):

  ```
  SHA-256: 43:6F:9A:2F:4B:4D:16:25:D7:53:C9:E7:82:ED:7B:EF:D4:7B:0A:E8:2A:F6:BB:15:81:D4:48:2D:1F:76:68:92
  ```

- The version number inside the APK (6.0 / versionCode 6) lives in the binary
  AndroidManifest. It was bumped with [APKEditor](https://github.com/REAndroid/APKEditor)
  (`java -jar APKEditor.jar d -i app.apk`, edit `AndroidManifest.xml`, `java -jar APKEditor.jar b -i app_decoded`).
  Changing it is optional for side-loaded installs.
- The original upload (three split APKs) was merged into this single universal APK with
  `java -jar APKEditor.jar m -i <folder with the 3 apks> -o merged.apk -clean-meta`.

## Updating the exam routine without rebuilding

1. Create a JSON file with the same fields as `EXAM_ROUTINE` in `index.html`:

   ```json
   {
     "title": "Half-Yearly Examination",
     "session": "2026-27",
     "exams": [
       { "cls": "Class 10", "subject": "Mathematics", "date": "2026-11-03", "start": "09:00", "end": "12:00", "room": "Hall A" }
     ]
   }
   ```
2. Host it at a public address (GitHub Pages of this repository works: Settings → Pages).
3. Put that address in `ROUTINE_URL` in `index.html` and rebuild **once**. From then on the
   app downloads the newest routine whenever it opens and keeps the last copy for offline use.
