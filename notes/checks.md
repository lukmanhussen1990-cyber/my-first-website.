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
An independent frame-by-frame visual review against the recording (60 fps re-capture, all 888 video
frames, full-resolution crops) found: webs too bright, cord-like with neat round loops instead of flat
folded tape, no float-up while typing, too little sag after the return, straight hanging threads, twice
the idle sway; idle zaps ~0.55 s late and irregular (the first one was re-rolled every frame); hint fading
with the paper instead of staying as ink under the light; glossy LEDs with halos (recording: flat discs
with a bezel); the T bar dropping for a frame and the carriage jumping at quick keys; lavender after-flash.
Fixed (v9g–v9i): folded-tape webs (straight runs, sharp folds, stiffer bending, 25 % dimmer, calmer,
lift while typing, deep V after the return, wavy threads, no coil); idle zaps at exactly the recording's
12.92 / 13.55 / 14.18 s (2.45 s after the last key, runs of three 0.633 s apart); 175 ms green phase,
silver after-flash, greener flood; two-ink hint (contrast within a few levels of the recording through
the whole lamp switch); flat measured LEDs; continuous strikes and gliding carriage at quick keys.
**Check 9 done. Next: capsule hardware (bolts, collars, slot lip, stem), lamp-on timing, light lag on
the return, dial details, then a second independent review.**

## Check 10 — capsule hardware, timing, second review (v10a–v10h)
Differences found: bolts, collars, slot and stem simplified; lamp-on paper fade and light growth off by
50–100 ms with a flicker the recording does not have; light lag on the return; dial colours; a second
independent review then found a few overshoots (dark paper, hint under the lamp, zap flood too green, right
web band too faint) plus light-mode shadow details.
Fixed: measured bolts/collars/slot/stem, ease-out-cubic paper fade fitted to every frame, smooth light
growth, light trailing the carriage by ~1.4 frames, dial greys, rail and capsule shadows profiled row by
row, T-web and rail knot from close-ups, specks sized at full resolution, crisp slot strip.
**Check 10 done. Next: final delivery (requested now).**

## Check 11 — capsule skins and picker (v11a)
The recording types "Testing halloween capsule skins", so this round adds them. Tap the capsule (or Tab to
it and press Enter) to open a small tray with six skins drawn from their real sprites: Frankenstein (the
recorded one, unchanged), Pumpkin (ribbed, carved face lit by a candle, glowing under the lamp, stem, leaf
and tendril), Vampire (satin crimson, gold trim, ruby crest, a perched bat, fangs with a drop of blood),
Mummy (frayed bandages, an eye peeking out of a gap, loose ends), Ghost (see-through to the pipe, a sweet
face, a little chain and ball) and Witch (stars and moon, belt and buckle, pointy hat, glowing potion).
Each skin brings its own spark, flood, halo and steam colours, a cross-fade under a zap when it is picked,
and a short sound (bonk, flutter, rustle and groan, "oooo", magic sparkle). The choice is remembered; the
tray never takes focus from the hidden textarea (the phone keyboard stays up), closes on typing, outside
taps or Escape, has arrow/Home/End keys, and fits phones down to 320 px (three columns). A one-time tip
appears after 40 s of idle use.
Checked: default skin pixel-identical to v10i on a deterministic replay (≤3 levels) except the capsule's
light-mode shadow tail, which was cut off by the sprite edge and now fades out like the recording's;
functest, imetest, hinttest, focustest, reviewfix, new skintest and tiptest pass; audio nodes bounded;
frame times unchanged.
**Check 11 done. Next: share as an image card, download .txt, a fresh page with a tear-off, sound modes
(all / effects only / off), haptics.**

## Check 12 — share picture, new page, sound modes, haptics (v12a)
Added, all outside the recorded opening (nothing changes until it is used):
- The share icon opens a small menu: Share text (Copy text where the browser cannot share), Share as image
  (Save as image where files cannot be shared), Save as .txt, and New page. The menu keeps the phone keyboard
  up, works with arrows / Home / End / Escape, and shows "Nothing to share yet" on an empty page.
- The picture is the app's own composition: dark top with the name, the cream paper with the same glyph
  jitter, ink and grain, the typed lines, the pipe with faint cobwebs and the capsule (in its current skin)
  under the last line, and the date. 1080 px wide (square for short pages); very long pages are scaled to
  stay under 6 Mpx (a full 3 000-character page: 789 × 7609, 3.3 MB instead of 13.6 MB). It is drawn a few
  lines at a time while the menu is open, so the machine keeps running.
- New page: the sheet is torn off just above the pipe (ragged edge, loose fibres, the lamp light baked in)
  and flies away with a rip and a whoosh; the carriage rolls back with its return; "New page · UNDO" for 5 s
  brings the old page back (ignored once typing has started on the new sheet).
- The speaker cycles music + effects → effects only → off (remembered); its icon and label follow.
- Light haptics on Android phones (keys, space, return, backspace, skin change, new page), silent when the
  sound is off.
Checked: the default look is unchanged on the deterministic replay (refactors of the glyph, grain, rail and
text drawing are pixel-identical); new r12test (menu, .txt, picture, keyboard, tear + undo, sound modes,
haptics) and the full suite pass; reviewfix/audioleak updated for the three sound modes.
**Check 12 done. Next: rare distant lightning with thunder under the lamp, a backdrop for wide screens,
reduced-motion support, small UI polish.**

## Check 13 — ambience, backdrop, reduced motion (v13a)
Added (none of it can happen in the first minute, so the recorded opening is untouched; it uses its own
random stream, so the machine's own randomness is unchanged):
- Rare distant lightning (first after ~1.5–2 min, then every ~1.5–4 min, waiting for a pause in typing):
  the room flashes in two or three flickers, the lamp dips with the surge, thunder rolls in 0.7–2.7 s later
  (closer = sooner, louder, with a crack) and the webs tremble.
- Now and then one to three bats flap across the page.
- Wide screens (desktop, landscape): the machine stands in front of a night window — a dim moon veiled by
  cloud, faint stars, hills, a castle with two lit windows, a dead tree, a few graves and a fence, drifting
  fog; lightning lights the whole sky with a bolt and shows the silhouettes. The column gets a soft shadow.
- prefers-reduced-motion: no flashes, no bats, no fog drift, instant menus; the torn page fades instead of
  flying away.
- Hover: the top-bar icons brighten under a mouse (the dial stays as recorded).
Found and fixed while testing: the bats' wing sound could ask for a zero gain, which throws — and since
the launch was rescheduled after the call, it would have retried every frame. The envelope helper now
clamps, and both ambient events are rescheduled before they run. New sounds were levelled against a key
clack (thunder −26/−34 dB, tear −32, skin sounds −27…−31, wings −47 dBFS short-term RMS).
Checked: default look identical on the replay; ambsoak (20 virtual minutes: 8 strikes, ≥ 90 s apart, first
at 98 s, overlays end hidden, no errors), reducedtest, the full suite, perf and audio-node counts.
**Check 13 done. Next: final regression against the recording, a new demo video showing the new features,
then the final single-file delivery.**

## Check 14 — independent review of the new features, fixes, demo (v13b–v14a)
A second, independent review of everything added in v11–v13 (reproduced in headless Chromium) found six
real problems, all fixed and re-checked with the reviewer's own reproductions:
1. A shared picture could lose most of its text after New page → Undo (the picture is drawn in steps and
   read the live page meanwhile): it now draws from a snapshot of the page and skin taken when it starts;
   a failed picture is no longer kept.
2. Width-only window resizes did not redraw the night backdrop: they do now.
3. The one-time tip could appear at 40 s and replace "New page · UNDO": it now waits until after the
   first minute and never covers another message.
4. Escape after opening the tray/menu with the mouse took focus from the textarea (the next Enter reopened
   the tray instead of typing a newline): focus now stays where it was.
5. With the phone keyboard up the tray could open under it (up to 100 % hidden on a 320 × 568 phone): it
   now opens above the capsule when there is no room below.
6. The Undo button stayed focusable after its toast had gone (Enter could bring an old page back much
   later): hidden toasts drop their button; toasts are announced (role="status").
Smaller: a page of only spaces/newlines can be torn off; the capsule button uses aria-controls instead of
a menu popup; Ctrl/Cmd+S saves the page as .txt.
A 3-minute soak with skins, pictures, new pages + undo, lightning and bats: heap flat at ~6 MB, DOM nodes
constant, no errors. New 30 s feature demo recorded (picture and sound replayed from one storyboard, clicks
within 10 ms). Default look identical to v10i on the replay (except the longer, more faithful shadow tail).
**Check 14 done. Next: final delivery of the single file and the list of improvements.**
