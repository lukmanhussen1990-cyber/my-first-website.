# Check log

Each check compares the page with the reference recording side by side (Playwright replays the
recording's exact keystroke timeline with a virtual clock, then frames are diffed, measured and
viewed next to the video frames).

## Check 1 — layout (v1)
Differences found: carriage started at x=0 (init tween); light fan too bright at the edges; capsule
corners too round, bolts oversized, stitches too faint; counter/hint/placeholder too heavy; share icon
proportions.
Fixed: carriage init, light model fitted to the video (least squares), capsule redrawn from sampled
colours, thin captions via glyph erosion, share icon geometry.
**Check 1 done. Next: typing mechanics (strike, slide, wrap, carriage return).**

## Check 2 — typing (v2)
Differences found: strike curve shape, slide easing, carriage return timing, paper feed, missing
caret dot, big zap phases.
Fixed: strike 50/35/50 ms + dip, slide ease-out-sine 100 ms after the strike, return 267 ms
ease-out-sine, T drop + exponential recovery, spring feed, zap = 150 ms green phase + decaying flash,
blinking green caret dot, idle zaps, input queue for autocorrect/predictive text.
**Check 2 done. Next: cobwebs, sparks, glow.**

## Check 3 — webs, sparks, glow (v3)
Differences found: webs too few/too stiff, no rail coil, green glow too weak in lamp mode, no steam.
Fixed: Verlet ribbons with lagging rest length + bending stiffness + jolts + carriage-return fling,
rail coil, collar fans, hanging threads with spiders, screen-blended teal flood measured from the
video, steam column from the top bolt, elliptical capsule corners.
**Check 3 done. Next: lamp transition, light fan, sliders.**

## Check 4 — lamp mode (v4)
Differences found: stage timings, light growth/flicker, fan shape at the edges, slider label weight.
Fixed: transition timeline measured per element (capsule instant, paper 0.15+0.45 s, slot 0.5 s,
light 0.62+0.42 s), light model refitted on 3 frames (median error 1.7 grey levels), light trails
the carriage, idle-only steam, thinner labels.
**Check 4 done. Next: sound effects and music.**

## Check 5 — sound (v5)
Differences found: mix too hot (peak 0.68 vs 0.41), kick dominant.
Fixed: master/kick/hum levels rebalanced (long-term spectrum within ±4 dB per octave band of the
video), 113–114 BPM verified from the recording.
**Check 5 done. Next: phone input, keyboard, sizes, performance.**

## Check 6 — phone + performance (v6)
Differences found/bugs: counter collided with the speaker icon at 4-digit counts, landscape too
wide, per-frame shadow blurs, ribbon allocations.
Fixed: composition-aware input, emoji filtering, keyboard-safe viewport shift, landscape/desktop
column, sprites instead of per-frame blur, incremental glyph rendering (≈2–3 ms/frame at 4× CPU
throttle), speaker icon moved.
**Check 6 done. Next: frame-by-frame polish against the video.**

## Check 7 — polish (v7a–v7e)
Differences found: rail highlight 2 px low, shadow too long, stem too glossy, dial has 10 rays (not
8), text baseline/size/glyph offset, line spacing 24.67 px with a first-line offset, sparks too
neon, flash column too white, right web band too deep, paper specks 4× too sparse, cream slightly
dark, new line during the paper feed should rise from below.
Fixed: all of the above, measured numerically (median profiles, IoU template matching, row
tracking during the wrap).
**Check 7 done. Next: final checks, edge cases, audio fidelity, cleanup.**

## Check 8 — final checks (v8a–v8h)
Differences found: click too long/low (the recording's clicks decay in 3–6 ms, weighted to
4–14 kHz), music contour/harmony generic, light ramp too slow at the slot, caret dot missing in
light mode, bolts/stitches simplified, slider labels 3.5 px off, music bed too thin, levels off.
An independent adversarial code review found 12 issues (spark buzz ignoring its volume, sounds
queued on a paused clock, huge pastes building off-screen canvases, tap blur/refocus, desktop
resize while focused, Android keyboard avoidance, loop dying on an exception, emoji left in the
textarea, first line not typed out, keyboard access, carriage hop on quick backspace, unsaved
recent typing).
Fixed: all of the above, each with a regression test; 3-minute soak (no errors, flat 4 MB heap,
steady frame cost), audio-node leak check, levels per segment within ~10 % of the recording.
**Check 8 done. Next: side-by-side comparison video, final regression pass, delivery.**

## Check 9 — music and sound against the recording (v9a–v9f)
Differences found: the music bed was much darker than the recording (−10 to −27 dB above 1 kHz, nothing
continuous in the top end), the harmony did not follow the recording's bass line (measured per beat:
C C | G G | F | Am | G), the bass was plucked instead of held on the off-beats, the lead's vibrato was too
shallow and slow, and the carriage return lacked the recording's short wooden clunk (400–1500 Hz).
Fixed: new chord loop and off-beat bass, eighth-note hats, sixteenth shaker, a soft hiss bed, kick beater
click, brighter room, plucks an octave up, three-partial theremin with ±60 cents at ~6 Hz and scoops into
long notes (third-octave mean difference 6.9 → 3.3 dB, loudness per segment within ~1–2 dB); return clunk
added, ratchet and low thump softened, ding kept soft. Robustness: the lead voice is rebuilt every loop so
automation never piles up, the bed has its own long noise buffer, copy fallback keeps the keyboard up.
