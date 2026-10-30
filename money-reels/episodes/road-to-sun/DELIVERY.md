# Money Road to the Sun · delivery

## Files
- Reel: `out/money_road_to_the_sun.mp4` (1080×1920, 30 fps, H.264 + AAC, ~55 s)
- Cover: `out/cover.png` (1080×1920)

## Instagram caption

If you laid Elon Musk's money out in $1 bills, end to end, the road would reach the SUN. ☀️💵

🚶 You ($10,000): 1.56 km, a 20-minute walk
⚽ Ronaldo ($1.2 billion): 187,200 km, almost halfway to the Moon
🔫 MrBeast ($2.6 billion): 405,600 km, past the Moon
🚀 Elon (~$1 trillion): 156,000,000 km, all the way to the Sun

Driving Elon's road at 100 km/h would take 178 years. 👴🚗

How far would YOUR money road go? Tell me in the comments 👇

(One $1 bill = 15.6 cm. Net worth = public estimates, Oct 2026.)

#ElonMusk #MrBeast #Ronaldo #MoneyFacts #NetWorth #SpaceFacts #MindBlowing #Reels

## Number check (km = dollars × 0.000156)
| Who | Dollars | Road | Reference |
|---|---|---|---|
| You | 10,000 | 1.56 km | ~20 min walk at 4.7 km/h |
| Ronaldo | 1,200,000,000 | 187,200 km | 48.7% of 384,400 km to the Moon |
| MrBeast | 2,600,000,000 | 405,600 km | 21,200 km past the Moon |
| Elon | 1,000,000,000,000 | 156,000,000 km | 6.4 million km past the Sun (149.6M km) |
| Drive at 100 km/h | | 1,560,000 h | 178.0 years (2026 → 2204) |

Elon's road reaches the Sun only above $959 billion (149,600,000 / 0.000156). At $1 trillion the line "all the way to the Sun" holds.

## How it is built
- `tools/vo_prep.py`: tightens pauses in the supplied voiceover (voice speed untouched) and builds word-timed captions
- `tools/cutout.py`: cleans GPT images (real alpha, painted checkerboards, magenta) into `public/img`
- `tools/icons.py`: tracker face icons
- `tools/audio.py`: music (115 BPM), sound effects and the -14 LUFS / -1 dBTP mix
- `src/`: Remotion + Three.js scenes; `src/data/timeline.json` is the shared timeline
- Render: `npx remotion render src/index.ts MoneyRoad out/money_road_to_the_sun.mp4 --crf=18`
