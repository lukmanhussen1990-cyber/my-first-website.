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

# v2 (all-new Kerala-style film): in progress

v2 keeps the story, scene order and timing, and the original audio, copied bit-exactly in the same way. Every scene is painted in the Kerala video's art style. Done so far: shots 1–3 (moon and river, the boat arrival, the house door opening). Preview: `docs/v2_preview.jpg`. Scripts: `tools/v2/`.
