# QC report — GRACE IN MOTION · THE SKY

## Format
- video h264 1080x1920 @ 30 fps, yuv420p; audio aac 48000 Hz 199 kb/s
- duration 74.19 s (target 65–80) → PASS

## Loudness
- integrated -14.2 LUFS (target −14), true peak -2.1 dBTP (limit −1) → PASS

## Contact sheet
- `out/qc_contact.jpg`: one frame every 2 s, reviewed by eye (faces vs text, safe zone, floating feet).

## Blank frames
- 2224 frames scanned; flat/black frames: 0 → PASS
- largest frame-to-frame mean-luma jump: 68.3/255 at 13.03 s (cuts are dissolves; flashes are lightning)

## Caption sync (caption reveal = word start from TTS durations; measured against acoustic onsets)
- 21 pause-preceded words checked; median offset +2 ms, 90th pct |offset| 60 ms, max 74 ms → PASS (±80 ms)
- worst: S3:already -74ms, S10:love, -62ms, S11:PRISON. -60ms, S13:all -55ms

## Scripture (KJV, word for word)
- JEREMIAH 29:13 · KJV: “And ye shall seek me, and find me, when ye shall search for me with all your heart.” → MATCH
- JOHN 20:29 · KJV: “Blessed are they that have not seen, and yet have believed.” → MATCH

## Safe zone (x 60–960, y 220–1500)
- 297 frames × all visible text elements checked; violations: 0 → PASS

**Overall: PASS**
