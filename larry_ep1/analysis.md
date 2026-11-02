# Reference analysis: `ref/reference.mp4`

Method: I ran `ffprobe`, pulled frames at 1 fps (`ref/frames1s/`, 98 frames) and every 0.25 s (`ref/frames025/`, 391 frames), and made contact sheets (`ref/sheet_01–05.jpg`). I OCR'd the caption band (y 830–1210) of every 0.25 s frame with tesseract (`ref/ocr_raw.txt`, `ref/ocr_changes.txt`), then checked colored words and noisy OCR lines against the frames by eye.

## Format
| Property | Value |
|---|---|
| Size | 720 × 1280 (vertical 9:16) |
| Frame rate | 30 fps, H.264 |
| Duration | 97.73 s (video), 97.87 s (AAC 44.1 kHz stereo) |
| Narration | Calm, deadpan male narrator over very quiet music |

## Story beats and timing
Each beat is a goal plus a countdown ("30 days to the reunion") followed by a list of failed attempts.

| Time (s) | Scene / place | Narration (OCR) | Joke / visual |
|---|---|---|---|
| 0.0–4.7 | Bedroom (gamer room) | "Thirty days. That's how long James has until his high school reunion." | Title banner "30 DAYS TO THE REUNION" under the HUD |
| 4.7–13.0 | Bedroom | "Look at him. James is a chud. Headset on. Cheeto dust up to the elbow. He hasn't seen sunlight since the last patch." | Arm raises, a sparkle on the dust, monitor shows "UPDATING 99%" |
| 13.0–21.5 | **Phone chat** (purple vignette) | "Then Sarah texts. Not a Sarah. *The* Sarah. Prom Sarah. And this man reads it with Cheeto dust on the screen." | iMessage-style screen; contact subtitle "Prom Queen 2015"; orange fingerprints appear on the screen |
| 21.5–25.3 | Bedroom | "Thirty days to fix everything. Where do we even start?" | Recap shot |
| 25.3–35.0 | Bathroom / mirror | "First stop: mirror. The teeth. The skin. The hairline… packing a suitcase… fogs up out of embarrassment." | Close-up in the mirror; the mirror fogs and writes "pls no" |
| 35.0–42.7 | Kitchen | "Next, the kitchen. One energy drink, half a cold nugget, and a sticky note on the fridge that just says NO." | A "NO." sticky note slams in |
| 42.7–50.4 | Street | "So he goes outside. The sun hits him like a jumpscare. A dog walks by, sniffs him and files a complaint." | The sun gets an angry face; a "COMPLAINT FILED" tag |
| 50.4–67.0 | Store ("FRESH MART") | Self-care aisle, a face wash "for normal skin", he puts it back, asks where the deodorant is, the employee "doesn't point. He walks him there personally." | Product close-up, employee walks him over |
| 67.0–73.3 | Park | "…sees himself in a puddle for the first time. He doesn't look away. **The puddle does.**" | Reflection turns away, "hmph." (the best reversal joke) |
| 73.3–85.3 | **Phone chat** | "Back home… reply to Sarah… deletes it… types again… and sends… K. Thirty days. And that's his opening move." | Long draft typed then deleted; sends "k"; she replies "lol ok" |
| 85.3–97.7 | **Poll** | "So here's where you come in. Brush his teeth or wash his sheets? One of them changes his life today. Vote now. Day two starts with your choice." | Split screen, VOTE NOW button |

- **Scene cadence:** a new place every ~8–10 s (bedroom, phone, bedroom, bathroom, kitchen, street, store, park, phone, poll), with close-ups inside longer scenes.
- **Joke cadence:** one joke every 3–4 s, roughly one per sentence, each landing on the last word ("…the last **PATCH**", "…files a **COMPLAINT**").

## Art style
- Flat 2D vector cartoon with thick dark outlines and no gradients on characters. Backgrounds are simple geometric rooms and streets with soft vignettes.
- Main character is a front-facing puppet: a big head with glasses and a red/black gaming headset, skin spots, a stained grey-green T-shirt that is too short, a hairy belly, orange tube arms, grey pants and white sneakers.
- Gross-out decoration: flies orbiting the head, green wavy stink lines, small green stink clouds.
- Animation is minimal. The body is static, there is an occasional arm raise, and the face changes for a beat (open mouth, teeth). There are no blinks or squash and stretch, and the camera moves are few.

## Top HUD
- Two dark rounded "game UI" boxes at top-left, y ≈ 136–220 px, leaving the top 130 px for the platform UI.
  - Box 1: small white label **DAYS LEFT** over a large yellow **30**.
  - Box 2 (wider): label **GLOW-UP** over a green **0%**.
- **The values never change during the whole video.** A missed opportunity: the meter promises progress and never pays off.
- In the store scene a green "FRESH MART" store sign sits *above* the HUD (y 0–100) and never overlaps it.

## Captions
- Condensed heavy sans (Anton/Bebas style), uppercase, white with a dark outline and a soft drop shadow, about 60–70 px cap height.
- 1–3 words per chunk; each chunk stays about 0.5–1.3 s and is replaced by a **hard cut** (checked frame by frame at 4.5–5.0 s: no scale or fade animation).
- Position: centered about y ≈ 920 (over the character's legs) in scenes, and y ≈ 1150 under the phone in chat scenes.
- Key words are colored: yellow (THIRTY DAYS, REUNION, TEETH), pink (SARAH, PROM SARAH), green (CHUD, PATCH, ENERGY), blue (THE SKIN, DEODORANT, PUDDLE, SHEETS?), red (NO, EMBARRASSMENT, COMPLAINT, OPENING MOVE).

## Scene changes
- Hard cuts between places with no transitions. The background swaps under the same puppet.
- The phone screen is used twice as a "breather" between location scenes and carries the emotional thread (Sarah).

## Ending (last ~12 s, 85.3–97.7)
- Split screen: dark red on the left, dark green on the right, divided by a thin yellow line.
- Yellow header "COMMENT ONE WORD"; option titles **TEETH** (yellow) and **SHEETS** (blue) with small white sub-lines ("BRUSH THEM. PROPERLY." / "WASH THEM. FIRST TIME SINCE 2019.").
- Each half shows the character doing that option.
- A yellow pill **VOTE NOW** button appears around 92 s, then the small line "DAY 2 STARTS WITH YOUR CHOICE →" at the bottom.
- It ends on the static poll with no tease of what Day 2 is.

## What "Larry Poops Everywhere" keeps and upgrades
| Reference | Larry Ep. 1 |
|---|---|
| Static HUD (30 / 0%) | **DAYS LEFT 10 / POOP COUNT** that really counts: 3 in the hook, a "warm-ups don't count" reset, then 1→5, each with a pop animation and a sound effect |
| Static puppet | Squash and stretch, landing bounce, breathing, blinks, shaking and crossed legs when he needs to go, walk/run/kneel modes, about 12 expressions |
| Hard-cut captions | Each word pops in with a small scale animation as it is spoken (timed to the voiceover's words) |
| Few camera moves | Push-ins, snap zooms on punchlines, whip transitions, shakes on every count pop |
| Quiet music, few SFX | A synthesized SFX hit on every joke, a bouncy music bed that changes for the church and the poll, ducked under the voice |
| Poll ends static | Last second teases Day 2 (DAYS LEFT flips 10→9 plus a "Day 2" card) |
| Joke every 3–4 s | Same cadence, plus a visual gag on top of most narrated beats |

## Narration used for Larry Ep. 1 (uploaded `poop_larry.mp3`)
I transcribed it with faster-whisper (`small.en`, word timestamps). It is 104.0 s raw. I shortened 54 pauses (comedic beats kept longer) to fit 98.0 s with no speed change. Word timings drive the captions and every scene beat (`work/words_tight.json`).
