# Final QC: `What_If_Mars_Appeared_in_Earths_Sky.mp4`

All checks were measured on the delivered MP4 by `src/qc.py`.

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Length exactly 45.0 s; at least 1080×1920, 9:16 | **PASS** | 45.000 s; 1,350 frames at 30 fps; 1080×1920; H.264 High; 16.0 Mbps; yuv420p, BT.709 |
| 2 | English voiceover audible and matches the script | **PASS** | An independent speech-recognition pass on the final audio reproduces the full script in order, with no missing or extra phrases. Its 12.4% word error rate is only spelling and word-split artifacts ("fly by", "in land"). Voice loudness during speech is −14.0 LUFS. |
| 3 | Subtitles burned in and synced within 100 ms | **PASS** | Words were re-aligned on the final audio. Highlights are within 60 ms at worst and 26 ms early on average, which is deliberate. Pages hold 3–6 words, use at most 2 lines, and are at most 775 px wide. |
| 4 | Music and SFX mixed in, voice clear, about −14 LUFS | **PASS** | −14.0 LUFS integrated; true peak −2.9 dBTP; music sits 19.4 dB under the voice and ducks 8 dB; voice peaks −5.7 dBFS. On a phone-speaker band simulation the voice still leads by 19.5 dB (a measurement, not a listening test). |
| 5 | All text inside Instagram-safe zones | **PASS** | All 7,626 text boxes logged across every frame show 0 violations: top 270 px, bottom 420 px, 64 px sides, and 140 px on the right in the lower half. The phone-UI mock overlay was checked. |
| 6 | Mars angular sizes correct, shown against the Moon | **PASS** | On screen Mars measures 1.011° against the Moon's 0.518° (ratio 1.95). A Moon-outline scale ladder shows 25″, 0.039°, 0.39° and 1.0°. |
| 7 | Assumptions and uncertainties shown on screen | **PASS** | Tags used: ASSUMPTION (flyby and speed); ESTABLISHED (sizes, tide scaling, brightness, bending); UNCERTAIN (flood heights, quakes, the Moon, long-term climate); POSSIBLE (harbour flooding); EXAGGERATED (tide bulge, Earth's nudge). |
| 8 | No exploding Earth, no unsupported disaster | **PASS** | The harbour shows water rising about 3 m, tagged POSSIBLE/UNCERTAIN. There is no damage and no casualties. |
| 9 | Hook in the first 2 s; new visual info at least every 3 s | **PASS** | Mars, the Moon and the hook text are on screen from 0.0–0.35 s. The longest gap between new visual events is about 2.2 s. |
| 10 | Ends with the comment question | **PASS** | "Would you stay and watch, or move inland?" plus a COMMENT BELOW pill. The last 1.0 s is a static hold (pixel-identical). The voice ends at 44.26 s. |
| 11 | Science Notes file included | **PASS** | `SCIENCE_NOTES.txt` |

**Changes from the brief, for accuracy and timing:**
- The visual style is cartoon, as requested mid-production.
- VO line 2 says "at the Moon's distance" instead of the spoken number. The number, 384,000 km, stays on screen.
- "About one degree" became "just over one degree"; the computed value is 1.30°.
- The brief's "bigger than 0.39° for about a day" was corrected to about 2.1 days in the notes.
