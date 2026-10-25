# QC report — GRACE IN MOTION · THE SKY

## Format
- video h264 1080x1920 @ 30 fps, yuv420p; audio aac 48000 Hz 199 kb/s
- duration 74.19 s (target 65–80) → PASS

## Loudness
- integrated -14.1 LUFS (target −14), true peak -0.8 dBTP (limit −1) → FAIL

## Contact sheet
- `out/qc_contact.jpg`: one frame every 2 s, reviewed by eye (faces vs text, safe zone, floating feet).

## Blank frames
- 2222 frames scanned; flat/black frames: 0 → PASS
- largest frame-to-frame mean-luma jump: 68.5/255 at 13.17 s (cuts are dissolves; flashes are lightning)

## Caption sync (caption reveal = word start from TTS durations; measured against acoustic onsets)
- 10 pause-preceded words checked; median offset -158 ms, 90th pct |offset| 211 ms, max 227 ms → CHECK
- worst: S17:or -227ms, S2:right? -209ms, S16:and -203ms, S14:Jesus -162ms

## Scripture (KJV, word for word)
- JEREMIAH 29:13 · KJV: “And ye shall seek me, and find me, when ye shall search for me with all your heart.” → MATCH
- JOHN 20:29 · KJV: “Blessed are they that have not seen, and yet have believed.” → MATCH

## Safe zone (x 60–960, y 220–1500)
- 297 frames × all visible text elements checked; violations: 0 → PASS

**Overall: NEEDS ATTENTION**
