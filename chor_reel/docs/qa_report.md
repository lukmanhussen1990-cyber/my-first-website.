# QA Report: v1 (composite over the original film)

File: `output/chor_reel_1080x1920.mp4`

## Verified

| Check | Result |
|---|---|
| Video stream | H.264 High, 1080×1920, 30 fps, 1,591 frames (53.03 s): the same frame count and frame rate as the source |
| Audio stream | HE-AAC, 48 kHz, stereo, 1,246 packets, 53.14 s: the same as the source |
| Audio identical to the original | **Yes.** The packet-stream MD5 of the output (`ad8dcc47c432b86671aa0d1811144395`) equals the source's. The track was stream-copied (`-c:a copy`), not re-encoded, retimed or regenerated. |
| Frame mapping | Output frame *n* is rendered from source frame *n*, so picture timing matches the audio exactly |
| Render integrity | All four lossless render chunks finished without errors and decode to 330 + 430 + 420 + 411 = 1,591 frames |
| Visual review | One frame per second (54 frames) was reviewed from the lossless render |

## Known issues in v1

- **Around 6.0–6.3 s**, while he stands up in the boat, the kneeling and standing poses cross-fade with a visible size jump and ghosting. A fix was written (`tools/reel_char.py`), but the re-render was cancelled when the plan changed, so the delivered v1 file still has this flaw.
- **Overall look:** compositing the painted Kerala character into the original's glowing-outline night style looks mismatched. The user flagged this, so v1 is now a draft and is superseded by v2.

## Not run on the final file

- The full `tools/qa_check.py` pass (brightness-sync correlation, frozen/black-frame scan, side-by-side sheets).

# QA Report: v2 (all-new Kerala-style film)

File: `output/chor_kerala_1080x1920.mp4`

| Check | Result |
|---|---|
| Video stream | H.264 High, 1080×1920, 30 fps, **1,591 frames**, 53.03 s, start 0.000 |
| Audio stream | HE-AAC, 48 kHz, stereo, 1,246 packets, 53.14 s, start 0.000 |
| Audio identical to the original | **Yes.** Packet-stream MD5 `ad8dcc47c432b86671aa0d1811144395` and decoded-PCM MD5 `d64174a75e596a2014d0c359c0c7f126` both equal the source's. The track was stream-copied, not re-encoded, retimed or regenerated. |
| Timeline | Output frame *n* corresponds to the original's frame *n*. Every story beat, cut and dissolve is placed on the original's frame numbers (see `v2_scene_breakdown.md`). |
| Render integrity | Four lossless chunks rendered with return code 0 and decode to 400 + 400 + 400 + 391 = 1,591 frames |
| Visual review | The encoded MP4 was sampled every 2 s (27 frames, start to end), and transitions (frames 281/282, 345–356, 1469/1470) and the ending were checked individually. All scenes render as designed. |

## Known differences from the original (by design)

- **Art style:** everything is in the Kerala video's painted style instead of the original's glowing-outline style. This was requested so the new character no longer looks pasted in.
- **Narrator:** the man of the house is the thin scribe from the Kerala video. In the original he is a glowing outline figure.
- **Symbols:** each line's "taken" item is redrawn as glowing gold line art in the same order and on the same words: scales, shadow, house, kite, chest, stars, wounds, fingerprint-galaxy, letters-to-birds and the lamp.
- **Title:** the title card (चोर / JUSTH) is cut from the original film and re-placed for the vertical frame.

# QA Report: v3 (the Buddha version)

File: `output/chor_buddha_v3_1080x1920.mp4`

| Check | Result |
|---|---|
| Video stream | H.264 High, 1080×1920, 30 fps, **1,591 frames** (decoded count), 53.03 s, start 0.000 |
| Audio stream | HE-AAC, 48 kHz, stereo, 1,246 packets, 53.14 s, start 0.000 |
| Audio identical to the original | **Yes.** Packet-stream MD5 `ad8dcc47c432b86671aa0d1811144395` and decoded-PCM MD5 `d64174a75e596a2014d0c359c0c7f126` both equal the source's, and the packet counts match (1,246 = 1,246). The track was stream-copied, not re-encoded, retimed or regenerated. |
| Timeline | Output frame *n* corresponds to the original's frame *n*. Each lyric item appears on its key word and is taken on "ले जा" (word timings measured from the original audio, see `tools/v3/v3_beats.py`). |
| Render integrity | Four lossless chunks finished with return code 0: 398 + 398 + 398 + 397 = 1,591 frames |
| Black and frozen frames | `blackdetect` (≥0.3 s) and `freezedetect` (≥1 s) flagged nothing |
| Visual review | One frame per second (54 frames) was sampled from the encoded MP4 and checked against the scene list in `v3_scene_breakdown.md`. Test frames from every lyric line were reviewed during production. |

## Known differences from the original (by design)

- **Art style:** the whole film is painted in the Kerala video's style, not the original's glowing-outline style.
- **House owner:** a slim Buddha drawn from scratch, at the user's request. He sits where the original's seated narrator sits and makes the same offering gestures.
- **Thief:** the round-bellied man from the Kerala video, in his natural colours.
- **Title:** the title card (चोर / JUSTH) is cut from the original film and placed where the thief stood.
