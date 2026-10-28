# 3 Times a Day: script and scene plan

The voice is the owner's ElevenLabs recording (`audio/voice_elevenlabs.mp3`, 70.4 s). It follows the script word for word, so the words are unchanged. The only polish is the timing.
`tools/build_timeline.py` cuts it into sentences and re-joins them with the brief's pauses:

| where | pause |
|---|---|
| between sentences | 0.3 s |
| before "But notice" | 0.8 s |
| after each "as he did aforetime" | 0.6 s |
| before the last line | 0.6 s |

Two pauses are longer for the picture:

| where | pause | why |
|---|---|---|
| after line 1 | 1.05 s | to hold "3 TIMES A DAY" like the reference |
| after "Put the phone down" | 1.2 s | for the match cut |

The reel is 73.0 s (2190 frames), with the voice ending at 67.9 s.

## Script (*word* = gold keyword)
1. Daniel prayed *3* times a day.
2. Studies say many of us check our phones over *100* times a day.
3. So why is prayer so *hard*?
4. Most people say: "I'm too *busy*."
5. But notice who Daniel was. One of three leaders over a hundred and twenty princes. The *busiest* man in the kingdom.
6. Then his enemies got a law signed: pray to anyone but the king… and you go to the *lions*.
7. And Daniel? "He kneeled upon his knees three times a day, and prayed, and gave *thanks* before his God, as he did *aforetime*."
8. As he did aforetime. He didn't start praying because of trouble. He was *already* praying.
9. Prayer isn't hard because we're busy. It's hard because something else got our *attention* first.
10. Jesus made it simple: "Enter into thy closet, and when thou hast shut thy *door*, pray to thy Father which is in secret."
11. Shut the door. Put the phone *down*.
12. David said: "Evening, and morning, and at noon, will I pray… and he shall *hear* my voice."
13. He shall hear. Every single *time*.
14. So be honest: how many times did you pray today? Just the *number*.

KJV check (repeated in Phase 6):
- Line 7 is exactly Daniel 6:10.
- Line 10 is exactly Matthew 6:6. The card starts at "…enter", in the middle of the verse.
- Line 12 is Psalm 55:17, with "…" standing in for "and cry aloud:".
- Lines 5–6 restate Daniel 6:1–3 and 6:7, and the labels cite those verses.

## Scene plan (one line each, times from the voice timeline)
| scene | time | plan |
|---|---|---|
| S1 | 0.0–2.9 s | Old Daniel (deep-blue robe, short white beard) kneels at an open lattice window in a gold god-ray full of dust, under a slow push-in. Gold **1 · 2 · 3** slam in on "Daniel / prayed / three", each with a chime and a light pulse, and "TIMES A DAY" lands on "times". |
| S2 | 2.9–8.6 s | A **hard cut** on "Studies" to a young person in a grey hoodie slouched on a sofa at night, face lit cold blue, with a slight push. A blue odometer races 0 → 37 → 86 → **100+** (landing on "100") over a flood of tiny pings. "TIMES A DAY 📱" appears, then silence and **WHY IS PRAYER / SO HARD NOW?** |
| S3 | 8.6–11.4 s | A whip-fast montage of about 0.6 s per shot: notifications stacking up, calendar pages flipping, a coffee cup, traffic lights, the phone buzzing on a table. The caption reads "I'm too BUSY", and the scoreboard (PRAYER: 3 / PHONE: 100+) slides in under it. |
| S4 | 11.4–18.1 s | A crane-up through a low-poly Babylon throne hall: Darius on the throne, rows of princes, and Daniel among the 3 leaders at the top. A quick "120 PRINCES" counter, and the label "DANIEL 6:3 · OVER THE WHOLE REALM". |
| S5 | 18.1–23.6 s | Generic officials whisper in a shadowed corner with narrowed eyes. Then a low angle as the decree is signed and a lion wax seal thumps down. Then a two-second glimpse of a dark den with calm glowing eyes, no lions shown. Label "DANIEL 6:7". |
| S6 | 23.6–32.4 s | A tracking shot as Daniel walks home, pushes the shutters open toward a faraway Jerusalem, and kneels slowly, at peace, while two spies watch from the street below. The Daniel 6:10 card floats in, with THANKS and AFORETIME in gold. |
| S7 | 32.4–38.1 s | A locked-off time-lapse at the same window: young Daniel, then middle-aged, then old (same robe), while the seasons cycle outside (blossom → summer → autumn → snow). Label "ALREADY PRAYING". |
| S8 | 38.1–43.2 s | A split screen: Daniel in gold light on one side, the modern person scrolling in blue light on the other. Thin glowing lines pull from the phone into their eyes like a magnet. Tag "ATTENTION". |
| S9 | 43.2–50.6 s | The person walks into a small quiet room, and the door shuts toward us, seen from inside, with a click. The Matthew 6:6 card shows DOOR in gold. |
| S10 | 50.6–54.1 s | The phone goes face-down on a little table with a thunk, its glow dies, and the room turns warm. The person kneels at the window, then a **match cut** lands the same pose and window line on Daniel in S1. |
| S11 | 54.1–60.5 s | The Psalm 55:17 card holds over a sky that sweeps from evening to morning to noon, the sun stopping at 3 points along its arc. |
| S12 | 60.5–63.9 s | S1's gold beam now falls on the kneeling modern person, with dust drifting and a slow push-out. The scoreboard's PRAYER number glows. |
| S13 | 63.9–69.4 s | A dark warm screen with the scoreboard big in the middle: "PRAYER: ?" / "PHONE: 100+". A comment box types "3 🙏" and hearts float up. |
| S14 | 69.4–73.0 s | The end card: the logo draws itself, then "GRACE IN MOTION", "@GraceINMotion616", "Hard questions. Bible answers." Then it flows back into Daniel's beam for the loop. |

## How it's built (CODE mode)
- **Reused from *The Sunset Rule*:**
  - the paper-cut rig (characters drawn in code, about 5 px outline, two-tone shading toward the light, standing in the 3D world on camera-facing cards with true shadows)
  - the sun and light system, post effects, low-poly kit, captions, labels, cards, end card and audio tools
  - the restart-proof frame render
- **New for this episode:**
  - Daniel at 3 ages, Darius, the officials and the hoodie person
  - six sets: the upper room and its window, the throne hall, the street, the den mouth, the living room and the small room
  - the gold and blue counters, the scoreboard, the montage, the split screen and attention lines, the season cycle, and the evening→morning→noon sky
