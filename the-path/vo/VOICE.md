# THE PATH — Voice-over (Phase 3)

**Result:** take **B** is edited only at its own pauses. All eight segments start exactly on their anchor frames and end before their limits. The stem measures **−16.0 LUFS** and **−1.5 dBTP**; the NumPy meter and FFmpeg `ebur128` agree. The timeline is now locked to the recording.

| Review file (git-ignored, rebuilt by the tools below) | What it is |
|---|---|
| `out/review/vo_animatic.mp4` | 60 fps timing animatic (not the film): scenes, word-by-word captions from the measured VO, events as they fire, the S6 reply waveform, all over the VO + SFX mix |
| `out/review/vo_sfx_preview.m4a` | The VO stem with all 114 SFX cues at their locked frames (no music yet) |
| `out/vo/vo_stem.wav` | The finished VO stem: 48 kHz, 24-bit, mono, 21.2 s, film time |
| `out/review/vo_stem.png` | The stem over the whole film, marked with anchors, limits, hero cues and room-tone fills |
| `out/review/vo_takes.png` | Both raw takes with aligned words, pauses and segment fit |

## 1. The takes

- **Request:** one request with two variations of the exact script.
  - Engine: ElevenLabs `eleven_v4`.
  - Voice: **Mira – Bright & Friendly Narrator** (`rdEyNni8e60Jlx1RsV9N`).
  - No direction tags.
- **Files:** `vo/takes/`, byte-identical to the delivery. Provenance and checksums are in [`takes.json`](takes.json).
- **Transcription:** ElevenLabs Scribe (`eleven_scribe_v1`) heard both takes **word for word as written**, including *day…* and *music…*. Word files: [`scribe/`](scribe/).

## 2. Choosing the take

Measured by [`tools/vo_analyze.py`](../tools/vo_analyze.py) → [`analysis.json`](analysis.json):

| | Take A | **Take B** |
|---|---:|---:|
| Length | 18.56 s | 16.40 s |
| Pace (words per second of speech) | 3.34 | **3.88** |
| Pitch: median, 5–95 % range | 217.5 Hz, 6.2 semitones | 216.0 Hz, **8.8 semitones** |
| Raw loudness / noise floor | −30.5 LUFS / **−63.8 dBFS** | −33.3 LUFS / −59.7 dBFS |
| Clicks outside words | 0 | 0 |
| Spectral jumps inside steady speech | 1 (the onset of *Five*) | 1 (the *p* release of *keep* into *alive*) |
| Stray sounds in pauses | 6: a breath after *takes.*, plus clicks after *takes.*, *math,* and *path,* | 1 click after *chess.* (the edit removes it) |
| Segments that fit their windows with pause-only edits | 5 of 8 | **8 of 8** (6 untouched, 2 with pause trims) |

Both spectral jumps are normal speech transitions; I checked each one on a zoomed spectrogram.

**Why B:**
- It is the only take that meets every hard limit the hero cues set without cutting speech.
- Take A's *a league you'll want to win,* runs 1.70 s with no pause inside it. From its anchor at 7.30 s, that runs 0.32 s past its limit, into the #1 chime at 8.70 s.
- In take A, *One word at a time,* also misses its 4.20 s limit (set by the *Excellent!* chime) by 12 ms.
- Take A's *and then, one day… you just talk.* cannot fit even with its pauses at their minimums.
- B is also the brighter read: faster, with a wider pitch range, which suits the creator brief.
- A's advantage is a quieter noise floor. B's floor and hum are treated in the chain (section 5).

**Pronunciation:** Scribe transcribed *Duolingo.* and *chess.* correctly in both takes. In B, *chess* has the expected shape: an affricate burst, a short 0.13 s vowel and a strong *s* at the end. I cannot listen, so please confirm both by ear.

## 3. The edit

Rules are in `brief/timeline.json` → `vo.edit_rules`; the planner is [`audio/voplan.py`](../audio/voplan.py).

- **Anchors:** a segment's first word starts exactly on its anchor frame, at sample = frame × 800.
- **Pauses:** an edited pause keeps the previous word's tail and the next word's lead-in, and its middle becomes the take's own room tone. Joins use 10 ms equal-power crossfades at zero crossings.
- **Limits on pause changes:**
  - A pause never shrinks below 45 % of its natural length.
  - It never shrinks below what its punctuation needs: 0.12 s for a comma, 0.30 s for an ellipsis.
  - It never grows past 160 %.
  - Changes under 10 ms are not made.
- **Speech is never touched:** no cuts inside words, no time-stretch, no pitch-shift.

| # | Segment | Lands (frame) | Ends | Limit | Inner pauses changed |
|---:|---|---:|---:|---:|---|
| 1 | Five minutes a day, that's all it takes. | 0.500 s (f30) | 2.280 s | 2.70 s | none |
| 2 | One word at a time, | 2.950 s (f177) | 4.070 s | 4.20 s | none |
| 3 | a streak you'll want to keep alive, | 4.600 s (f276) | 6.158 s | 7.15 s | none |
| 4 | a league you'll want to win, | 7.300 s (f438) | 8.593 s | 8.68 s | none |
| 5 | and then, one day… you just talk. | 9.050 s (f543) | 11.420 s | 11.42 s | *then,* 0.255 → 0.162 s · *day…* 0.690 → 0.438 s |
| 6 | Languages, math, music… even chess. | 11.667 s (f700) | 14.249 s | 14.68 s | *music…* 0.415 → 0.300 s |
| 7 | One path, every skill. | 14.933 s (f896) | 16.450 s | 16.45 s | *path,* 0.348 → 0.229 s |
| 8 | Duolingo. | 17.333 s (f1040) | 17.918 s | 18.05 s | none |

- **Where the limits come from:** each limit is the brief's must-end-before time, or the next anchor minus a sentence gap (0.25 s after a full stop, 0.12 s after a comma), whichever is earlier. That keeps *talk.* clear of *Languages*.
- **Between segments:** the pauses are rebuilt with room tone to put each segment on its anchor, which ranges from 0.25 s to 1.14 s.
  - The longest is the breath before *a league*: the drop hits in it, at 7.20 s.
  - The one stray click, after *chess.*, falls inside a rebuilt pause, so the edit removes it.
- **Room tone source:** 10 clean pauses of the take, 3.74 s of unique material, read consecutively, so neighbouring fills never share material.

**Course words (segment 6).** The brief gives Math 12.42 s, Music 12.98 s and Chess 13.70 s.

- **Math:** no real pause follows *Languages,* (only 50 ms), so *math* lands where the take puts it.
- **Music and chess:** *music… even chess* needs at least 1.04 s from *music* to *chess* in this read, even with the ellipsis pause at its 0.30 s minimum. Chess cannot land 0.72 s after Music without cutting speech.
- The solver brought all three as close as the pause limits allow:

| Word | Brief | Locked | Change |
|---|---:|---:|---:|
| Languages | 11.67 s (f700) | 11.667 s (f700) | 0 |
| math | 12.42 s (f745) | 12.374 s (f742) | −3 frames |
| music | 12.98 s (f779) | 12.844 s (f771) | −8 frames |
| chess | 13.70 s (f822) | 13.932 s (f836) | +14 frames |

Each node lights on the frame its word is spoken. The camera is nearly still at all three frames (1.2, 0.7 and 0.5 px/frame).

## 4. Word timings and verification

[`words.json`](words.json) has all 43 words in film time (onset, vowel nucleus and end, with frames). The times are the take's measured word times carried sample-exactly through the edit.

- **Detector:** Scribe identifies each word on its 40 ms grid. An energy-onset detector at 2.5 ms resolution then snaps the boundaries to the waveform.
  - Scribe and the waveform differ by a median of 35 ms.
  - Stop releases belong to their own word: the *d* burst of *Duolingo* starts the word, and the *k* of *talk.* ends it.
- **Re-measure:** the finished stem was measured again independently. The 14 words that start after a pause agree within 1.7 ms. All eight anchors are on frame, and every segment ends in time.

## 5. VO chain

[`tools/vo_edit.py`](../tools/vo_edit.py) + [`audio/dynamics.py`](../audio/dynamics.py) + [`audio/loudness.py`](../audio/loudness.py):

1. **Hum notches at 60 Hz and 120 Hz.** The take carries a steady mains-style hum, 24.5 dB and 31.7 dB above the noise around it.
2. **90 Hz high-pass at 24 dB/octave.** The voice's pitch stays above about 172 Hz.
3. **Gentle compression:** 2.5:1 above −14 dBFS (10 ms RMS), 5 ms attack, 80 ms release. It reduces by at most 4.6 dB and by more than 1 dB only 22 % of the time.
4. **Expander for the room tone between phrases:** at most 10 dB, opening 5 ms early and holding 60 ms, so word edges stay intact.
5. **Loudness to −16.0 LUFS integrated,** then a look-ahead true-peak limiter at −1.5 dBTP (at most 0.8 dB of limiting).

**Result:**

| Measure | Value |
|---|---|
| Integrated loudness | −16.0 LUFS |
| True peak | −1.5 dBTP |
| Loudness range | 4.8 LU |
| Room tone inside the fills | −52.1 dBFS |

The music bed will sit well above that room tone. The mix in Phase 4 keeps the music at least 12 dB under every word.

## 6. What moved in the timeline

The animation follows the recording. Events tied to a word carry a `vo_lock`; cues and text windows that hang off an event carry `follows`. `tools/vo_edit.py` rewrites their frames from `words.json` on every run.

| Item | Was | Now |
|---|---:|---:|
| `math` node + `math_light` cue | f745 | f742 |
| `music` node + `music_light` cue | f779 | f771 |
| `chess` node + `chess_light` cue | f822 | f836 |
| `knight_land` cue | f834 | f848 |
| `every_skill` + `line2_split` cue (text starts rising 8 frames before the spoken *every*, f947) | f930 | f939 |
| `baseline_drop` event + cue | f920 | f929 |
| `merge_back` event + cue | f956 | f965 |
| Legibility of Math / Music / Chess / *every skill.* | f749 / f783 / f826 / f948 | f746 / f775 / f840 / f951 |

**Legibility:**
- *Chess* stays fully legible for 0.73 s; the minimum for single words is 0.6 s.
- *every skill.* rises with a 1-frame letter stagger instead of 2, so it stays legible for 1.02 s; the minimum for phrases is 1.0 s.

**Unchanged:**
- Every given scene time, the slam, START, *Excellent!*, the drop, #1, the landing, *Duolingo.* (f1040) and the fanfare.
- The camera keys: the camera report shows no problems.

## 7. S6 reply waveform

**Plan:** the Spanish reply (*¡Muy bien! Pedí un café en español.*) was going to be generated once, as a control signal for the waveform only, never mixed.

**What happened:**
- ElevenLabs rejected that third request. It said the account's free-tier access had been disabled for "unusual activity", and that a proxy or VPN can trigger this; requests from this cloud session go through one.
- Both takes and both transcriptions were already done, so nothing else was affected.

**The substitute:** the waveform now follows the sentence's own 11 syllables and stress (¡Muy BIEN! Pe-DÍ un ca-FÉ en es-pa-ÑOL), keyed to the caption's word reveals. The model is in [`audio/reply.py`](../audio/reply.py). In the animatic it plays under *one day… you just talk.*

## 8. Licensing note (ElevenLabs free plan)

ElevenLabs' help center says content made on the free plan:
- has **no commercial license**;
- when published, must credit ElevenLabs with **"elevenlabs.io" or "11.ai" in the title**.

For a portfolio spec, that means putting the credit in the video's title when you post it. To use the film commercially, regenerate the voice on a paid plan. Source: ElevenLabs help center, *Can I publish the content I generate on the platform?* Check the current wording before you publish.

## 9. Rebuild

```
.venv/bin/python -I tools/vo_analyze.py   # both takes -> vo/analysis.json, out/review/vo_takes.png
.venv/bin/python -I tools/vo_edit.py      # take B -> out/vo/vo_stem.wav, vo/edit.json, vo/words.json, locks brief/timeline.json
.venv/bin/python -I tools/vo_review.py    # out/review/vo_stem.png, vo_sfx_preview.m4a, vo_animatic.mp4
.venv/bin/python -I tools/plan_brief.py   # regenerates the BRIEF.md tables and diagrams from the locked timeline
```

All four are deterministic. [`edit.json`](edit.json) holds the full edit decision list: every take span and room-tone fill with its source and film times, the chain settings and the measured results.
