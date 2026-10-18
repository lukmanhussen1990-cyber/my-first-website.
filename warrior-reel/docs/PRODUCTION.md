# The Warrior Who Couldn't Forgive — production notes

Vertical 9:16 (1080×1920, 30 fps) animated reel, ~60 s. Low-poly / voxel-inspired medieval game look,
rendered procedurally (Three.js in headless Chromium). Original story; same character types as the reference
series (Jesus + a medieval knight), with the knight's sword visible in the opening, throughout the dialogue
and in the ending.

## Script (exact spoken lines — subtitles match word for word)

| # | Speaker | Line | Delivery |
|---|---|---|---|
| L01 | KNIGHT | When I find him... he will pay. | tense, quiet (hook) |
| L02 | JESUS | You've been gripping that sword since sunrise, my friend. | warm |
| L03 | JESUS | Why do you carry so much anger? | gentle |
| L04 | KNIGHT | The man I trusted most betrayed me. He opened our gates to the enemy. | bitter, restrained |
| L05 | KNIGHT | Every day since... I've sharpened this blade for him. | quiet, tense |
| L06 | JESUS | Any man can defeat his enemy with a sword. | soft |
| L07 | JESUS | True strength is ruling the anger inside you... and choosing what is right. | warm |
| — | — | *(the knight looks at his sword, slowly lowers it and sets its point on the ground)* | music only |
| L08 | KNIGHT | So I'm supposed to pretend it never happened? | hesitant |
| L09 | JESUS | No. Forgiveness doesn't pretend the wrong never happened. | gentle |
| L10 | JESUS | It means you refuse to let hatred rule the rest of your life. | warm |
| L11 | KNIGHT | I've let him rule me long enough. | exhale, softer |
| L12 | JESUS | Then today... you've won the greatest battle of all. | warm, soft |
| End card | — | "One who is slow to anger is better than the mighty; one who rules his spirit, than he who takes a city." — Proverbs 16:32 (WEB, public domain) · *True strength forgives.* | text |

## Voices (keep identical for every future episode)

| Character | ElevenLabs voice | voice_id | Model | Notes |
|---|---|---|---|---|
| JESUS | LAUKYS Voice (deep, warm baritone, natural) | `9Ni5tnvWT8WRgVNQLU3c` | eleven_v4 | tags used: [warmly] [gently] [softly] |
| KNIGHT | Rob – Tough, Calloused, British | `2ajXGJNYBR0iNHpS4VZb` | eleven_v4 | tags used: [tense] [quietly] [bitter] [hesitant] [exhales] |

The two voices are clearly different (American deep baritone vs. gravelly British). Every take was verified
word-for-word with speech recognition (faster-whisper) and the word timestamps drive subtitle reveal and
mouth animation. Per-character labelled dialogue stems are produced in `out/audio/stems/`
(`dialogue_JESUS.wav`, `dialogue_KNIGHT.wav`) so the voices can be replaced or re-recorded independently and
dropped back in at the same timings (`timeline/timeline.json` → `cues[].fileStart`).

## Timing
`timeline/timeline.json` is the single source of truth (built by `timeline/build_timeline.py` from the
measured speech boundaries of each take). Key beats: hook 0.0 s · establishing/title ~3.6 s · Jesus arrives
~7.4 s · sits ~9.4 s · sword moment ~32–36 s (point touches the grass ~35.3 s) · warm dissolve to the
golden ending ~50.2 s · end card ~55.6 s · end ~60.4 s.

## Shot list
1. **Hook** – across the river, low: the armoured knight on his mossy rock gripping his raised sword; slow push-in to the helmet ("When I find him... he will pay.").
2. **Establishing** – high wide crane over river, hills, misty castle; Jesus walking in along the bank. Title card.
3. **Follow shot** – from behind Jesus as he walks up to the knight ("You've been gripping that sword...").
4. **Frontal wide two-shot** (reference-style, river in the foreground) – Jesus sits down beside him ("Why do you carry so much anger?").
5. **Knight close-up**, low angle, slow push (betrayal).
6. **Over Jesus's shoulder** – the knight turns the blade and stares at it ("...I've sharpened this blade for him.").
7. **Jesus close-up**, slow push-in ("Any man can defeat his enemy... True strength is ruling the anger inside you...").
8. **Knight reaction** – helmet turns to Jesus, then down to the sword.
9. **The sword** – low, close: the blade descends and its point meets the grass; hands come to rest on the hilt.
10. **Knight medium** – posture softened ("So I'm supposed to pretend it never happened?").
11. **Over the knight's shoulder** onto Jesus ("No. Forgiveness doesn't pretend...").
12. **Jesus close-up** ("It means you refuse to let hatred rule the rest of your life.").
13. **Knight close-up** – the exhale; the light begins to warm ("I've let him rule me long enough.").
14. **Golden ending** – dip through warm light; from the sunlit side, they stand together on the bank, the knight's sword point-down in his right hand, Jesus's hand resting on his shoulder ("Then today... you've won the greatest battle of all.").
15. **Final** – behind them, rising crane toward the sunlit river and castle; end card.

## Rebuild
```bash
npm install                                  # three.js + playwright-core
python3 timeline/build_timeline.py           # timing (only if takes change)
python3 audio/build_all.py                   # music, ambience, foley, dialogue stems, mix, mouth.json
python3 render/subtitles.py                  # out/subs/film.ass (+ .srt)
render/render_final.sh                       # picture: 1080x1920, 3 headless renderers, resumable 3 s segments (~100 min)
render/assemble.sh                           # burn subtitles + mux audio -> out/video/the_warrior_who_couldnt_forgive.mp4
```
Preview stills: `node render/shoot.mjs --q "entry=film" --times 1,10,35 --out out/previews/film/x`.
