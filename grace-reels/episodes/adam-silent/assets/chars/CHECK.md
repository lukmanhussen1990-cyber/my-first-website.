# Phase 3 check: character pictures

All pictures are real transparent PNGs with clean edges (no halos). The style matches the reference, the faces stay consistent, and there's no text.

| # | File | Status | Notes |
|---|---|---|---|
| 1 | char_adam_close.png | ✅ OK | faces right, looking down; garment covers shoulders and chest |
| 2 | char_eve_close.png | ✅ OK | faces left; flower present |
| 3 | char_adam_eve_reach.png | ⚠️ REDO (quick edit) | garments end mid-thigh; the rule is knee-length. Working copy is in use until the redo |
| 4 | char_adam_eve_blame.png | ⚠️ REDO (quick edit) | same garment length issue (raw/…_alt.png is the 2nd version) |
| 5 | char_jesus_close.png | ✅ OK | no halo |
| 6 | char_jesus_stand.png | ❌ missing (MUST) | |
| 7 | char_jesus_kneel.png | ✅ OK | hands correct |
| 8 | char_man_close.png | ❌ missing (MUST) | attach char_man_point.png as the face reference |
| 9 | char_man_phone.png | ❌ missing (MUST) | attach char_man_point.png as the face reference |
| 10 | char_man_point.png | ✅ OK | hands correct; crew neck, clean-shaven |

The code fix for the garment length (`tools/extend_hem.py`) was tried and left blocky hems, so it isn't used.
Backup in the animation: in full-body shots, foreground leaves cover the thighs anyway.
