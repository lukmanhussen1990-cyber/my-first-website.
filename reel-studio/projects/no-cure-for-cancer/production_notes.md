# FILE No. 03: WHY IS THERE NO CURE FOR CANCER? (production notes)

Same series look as FILE No. 01 and 02:
- paper and X-ray looks;
- Anton titles: the dark line, then the red line 0.45 s later;
- typewriter labels and the procedural sound kit;
- the **@speciman.files** watermark, which comes from the engine and so matches the snail reel exactly.

Almost everything is drawn in code (`engine/js/cells.js`): normal, cancer and immune cells, the virus, DNA and its copy errors, the WANTED poster, the ID card, the fake badge, the treatment wave, the counters, the trial track, the tool tray and the route circle. Only 7 images come from GPT Image; the magnifier is reused from FILE No. 02.

## Length
- The three [OPTIONAL] scenes (S05, S12, S19) were cut and never recorded.
- The voice is never sped up; only long pauses are trimmed to 0.34 s.
- That leaves 19 scenes and about 2:15, which is longer than the 100–115 s target because the script itself is about 2 minutes of speech.

## Voice
- ElevenLabs "Viraj – Calm Devotional Narrator", Eleven v4, in 6 parts (`audio/elevenlabs_raw/part1–6.mp3`).
- There is no "सोचो" and no slow intro; the reel starts directly with S01.
- Audio tags keep Parts 1–3 serious and make Parts 4–6 more hopeful from S13.
- Whisper writes numbers and English words in digits or Latin script ("97 लाख", "2018", "HPV vaccine"). Every scene was checked word by word against the script; nothing is missing.
- S16 and S18 say "दो हज़ार छब्बीस" (2026). A plain transcript of Part 5 wrote "चब्बीस", so the word was re-transcribed on its own: it is "छब्बीस", and the same narrator pitch (about 135 Hz) as Parts 1–3 and 6.

## Facts on screen (all from the brief's checked list)
| Scene | On screen | Source |
|---|---|---|
| S03 | 9.7 MILLION DEATHS A YEAR, 9,700,000, CANCER DEATHS, WORLD, 2022 | IARC GLOBOCAN 2022 |
| S04 | 100+ (drawers: breast, lung, mouth, blood, brain, skin, liver, cervix) | more than 100 diseases |
| S10–S11 | fake "DON'T ATTACK ME" badge = PD-L1; 2018 · NOBEL PRIZE IN MEDICINE | Allison & Honjo, 2018 |
| S14 | HPV VACCINE → CERVICAL CANCER, HEPATITIS B VACCINE → LIVER CANCER, IN USE TODAY | brief |
| S15 | SCOTLAND, 2024 · PUBLIC HEALTH SCOTLAND, WOMEN VACCINATED AT 12–13, CERVICAL CANCER CASES 0 | PHS, 22 Jan 2024 |
| S16 | 28 FEB 2026, GIRLS AGE 14 · ONE DOSE, FREE HPV VACCINE, INDIA HAS ~25% OF THE WORLD'S CERVICAL CANCER DEATHS | brief |
| S17 | a vaccine made from your own tumor | brief |
| S18 | PHASE 3, MELANOMA (SKIN CANCER), 1,137, AUG 2026: SUCCESS, NOT APPROVED YET | INTerpath-001 (intismeran); approval re-checked before rendering: not approved as of 25 Oct 2026 |
| S20 | surgery, chemo, radiation, immunotherapy, vaccines; MANY CANCERS CAN BE CURED IF FOUND EARLY | brief |
| S21 | NO TOBACCO, HPV VACCINE FOR GIRLS, GET CHECKED EARLY; A LUMP / A WOUND THAT WON'T HEAL / UNUSUAL BLEEDING → SEE A DOCTOR | the only advice in the reel |

The NexCAR19 prices were only in S19, which was cut.

## Respect rules followed
- No gory tumours, no real patients, photos or names: cells are clean stained-plate drawings and the body is an anatomy chart turned into an X-ray.
- Nothing says "a cure has been found". S18 says the trial worked and approval is still pending.
- S09 is an example, not a statistic, and keeps the small "EXAMPLE" note.
- There is no map of India; India appears on a case-file card only.
- The medal is a plain, generic gold medal with no portrait and no Nobel design.
- The ending is hopeful: "THE FIGHT GOES ON", with the warm music from S13.

## Images (GPT Image, one chat)
- moon_plate, anatomy_body, specimen_cabinet, vaccine_vial, gold_medal, tobacco_leaf, plus magnifier from FILE No. 02.
- The first anatomy prompt was refused; the "skeleton and organs inside a glass outline" prompt worked.
- The drawer grid of the cabinet and the lung position on the body are measured in `geometry.json`.
