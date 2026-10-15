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

## Check 15 — Claude Special skin (v15a)
Requested: "Add another skin Claude Special, make it better". The seventh skin, and the first one that is
alive on the rail:
- Warm terracotta clay with soft mottling, a cream label wrapped round the body that reads CLAUDE between
  two little sparks, and a cream hand-drawn 12-ray spark on its side (pressed into the clay; it glows
  under the lamp). A speech bubble sits on top.
- While you type the spark spins up and its rays pulse like a thinking indicator, and the bubble's three
  dots hop; idle, it slowly breathes. Every new line throws a small burst of sparkles from the spark.
- Its zaps, glows and flood are warm terracotta; picking it plays a soft rising C-major "hello" (levelled
  with the other skin sounds, −29 dBFS short-term RMS).
- Skins can now have animated parts (skin.overlay, drawn each frame and cross-faded on a change); the tray
  swatch and the share picture get the still version. The capsule label uses the typewriter font, so the
  sprites are redrawn once the font has loaded.
- The tray fits all seven skins in one row from 375 px up (two rows below that).
Checked: default look unchanged on the replay; skintest (now seven skins), functest, imetest, hinttest,
focustest, reviewfix, tiptest, r12test, reducedtest and ctrls pass; share picture with the new skin.
**Check 15 done. Next: a short demo of the new skin, then deliver the updated single file.**

# Big upgrade (8 hours, started 10:21 UTC)

## Check 16 — control panel, papers, ribbons, bell, sound packs, drafts, pages, goals (v16a, 10:38)
Added: a control panel (new slider icon next to the arrow) styled like an old machine's panel — brass name
plate, typewriter keys, bakelite switches — with a skin carousel, four papers (Cream, Old Parchment,
Blueprint, Black Paper with white ink), four ribbons (black, red, blue, sepia), sound packs (Electric
Frankenstein = the recording, Classic Typewriter, Spooky Halloween with wind/creak/owl/thunder ambience),
volume, music on/off, margin bell, vibration, lamp, word goal and writing sprint, and a shortcut list.
The arrow now opens Drafts (new, open, rename, delete with undo, export). Full pages tear off by themselves
and stay with the draft; New page keeps the old page too; drag or wheel the paper to read back through
earlier lines and pages (a page tag shows where you are). Print / PDF of a whole draft. Quick keys strike
lighter. Margin bell 4 letters before the end of a line. Shortcuts: Ctrl+L, Ctrl+S, Ctrl+P, Ctrl+O,
Ctrl+, , Ctrl+Shift+Enter, Ctrl+M, Ctrl+Shift+S, Esc.
Bugs found and fixed: typing in the rename box was pulled into the page; Undo toast sat under the panel's
scrim; the auto page break was undone by the input handler (now deferred); new code drew random numbers that
shifted the machine's own randomness.
Compared with the recording replay: identical except the new icon and the lighter fast-typed letter.
Check 16 done. Next: new skins (Brass, Steampunk Copper, Space), ghost float, vampire wings, then graphics.

## Check 17 — new skins and graphics (v17a, 10:47)
Added skins: Classic Brass (brushed brass, engraved bands, rivet rows, enamel maker's badge, knob), Steampunk
Copper (riveted plates, verdigris, a pressure gauge whose needle rises while you type, valve, gear) and Space
Capsule (white hull, mission stripes, a porthole of twinkling stars and a ringed planet, a blinking antenna,
a thruster that fires while you type). The Ghost now floats; the Vampire grew little bat wings that flutter
while you type. Every skin crackles in its own pitch and has its own pick-up sound. Ten skins in the tray
(two rows) and in the panel carousel.
Graphics: Frankenstein capsule wear (hairline scratches, rust round the bolts and running down, a soft
window reflection); under the lamp the T bar throws a soft shadow up the paper that moves with the strike
and the carriage, dust drifts through the beam, the bulb shimmers and stutters now and then; sparks bloom
and throw hot streaks that fall and fade; a spider lets itself down from the pipe on a thread; a moth finds
the lamp and circles it. All new motion waits until 20–35 s, so the recorded opening is unchanged.
Tests: full suite passes (skin test updated for ten skins); frame times 2–4 ms at 4× CPU throttle.
Check 17 done. Next: second pass on everything — panel polish, share picture with themes, phone checks.

## Check 18 — independent review of the upgrade (v18a, 11:12)
Fixed: a paste that filled the sheet left the page stuck (now it tears off too); earlier pages in scroll-back
kept their old size after a resize; spiders/moth shared the lightning's random stream (now their own);
a bad saved sound pack made every key throw (saved settings are validated); Undo of New page after
switching drafts copied the page into the other draft; Escape while renaming saved the name.
New effects now show from the first second; a test-only ?still switch removes them for the pixel replay,
which matches the recording except the deliberately lighter fast-typed letter and the new panel icon.
Also: soft reflections on glossy skins, Tab stays inside menus, back up / restore all drafts (.json).
Check 18 done. Next: phone pass (touch scroll, keyboard, panel), performance, more polish.

## Check 19 — one hour in (v18b–v18g, 11:20)
Tested again: typing, backspace, wrap, lamp, sliders, panel, drafts, pages, scroll-back (wheel and touch
drag), goals, packs, shortcuts, backup/restore, reduced motion, 20-minute ambience soak, 3-minute feature
soak (heap flat ~6.8 MB, no errors), phone emulation (tap focus, panel hides and restores the keyboard).
Main screen vs the recording (still replay): identical except the deliberately lighter fast-typed letter.
Weak spots found and fixed: frame cost had risen (sparks moved onto the scene canvas, cheaper dust:
4.0 ms vs 3.2 ms before the upgrade at 4× CPU throttle); creaks too loud; clogged letters looked like grey
dots (now filled eyes); fibres showed in the dark too (now multiplied, so only lit paper shows them).
New: breathing light shafts in the beam, fibre relief under the lamp, see-through ghost, first lightning
after ~1 min, three web substeps for steadier silk, Print in the share menu.
Check 19 done. Next: another independent review, then a fresh full-quality look at every screen.

## Check 20 (v19a)
Independent review pass 2, all findings verified and handled:
- Bugs fixed: keyboard-opened sheets left the app scrolled up (focus now uses preventScroll, scroll reset on close);
  a paste that overflows a sheet now carries the rest onto the next sheet, breaking at a word; counter refreshes
  after a tear-off; Save .txt / Copy / Share now export the whole draft (all pages); Tab in the share menu returns
  focus to the share button; draft names up to 60 chars.
- Scroll-back: earlier pages fade out before the rod instead of running over the capsule; page pill sits under the rod.
- Design: lamp dial turns light on Black/Blueprint paper; beam burns lower on dark papers so light ink stays readable;
  Blueprint title block filled (FRANKENWRITER MK I, drawing no., sheet); ink-clogged eyes rarer and smaller;
  share menu restyled in the panel's brass and walnut; darker red Delete? pill; bigger tap targets (✕ 38px, ✎/✕ 40px);
  320px layout: key rows drop under their label and fill the width; slider labels never below 10px;
  "Picture" renamed "Image"; ambience note says it plays with the Halloween pack.
- Tests: functest (updated for paste carry-over), imetest, hinttest, focustest, reviewfix, skintest, tiptest, r12test,
  reducedtest, ctrls, up16test, backup, mobile18 all pass, no console errors. ?still replay: identical to the reference
  except the gear icon.

Check 20 done. Next: performance re-profile after the review fixes, then more lamp-scene and skin polish.

## Check 21 (v19c)
- Sound: each skin's carriage-return ding is tuned to its own note (Frankenstein keeps the recorded C7; pumpkin lower
  and woodier, mummy lowest, ghost and space higher, witch a high tinkle). Checked with audio running on four skins, no errors.
- Lamp scene: the lamp's warm spill now catches the top of the rod beside the capsule (off in ?still).
- Tests: functest, skintest, r12test, up16test, reducedtest, mobile18, ctrls, backup, imetest, reviewfix all pass.

Check 21 done. Next: finish the ?still replay + perf check for v19c, then skin-picker naming and more Halloween details.

## Check 22 (v19d)
- Capsule tray restyled in the panel's brass and walnut (gold ring on the chosen skin); each tray button shows the
  skin's full name as a tooltip (the tray keeps the short labels, the panel the full names; screen readers get the full name).
- Halloween: two carved jack-o'-lanterns glow among the graves in the wide-screen night backdrop.
- Tests: full suite and ?still replay re-run for this version (results in Check 23).

Check 22 done. Next: confirm the suite for v19d, then another look at sound packs and the celebration burst.

## Check 23 (v19e) – graphics only from here on (user: "Continue polishing graphics only")
- Full-resolution look at all 10 skins in light and lamp mode: all clean.
- Page tear-off, frame by frame: the sheet now curls back in 3D as it flies off (perspective rotateX), a soft shade
  along the torn edge and a light catch on top; nine paper scraps flutter down past the pipe, turning over as they fall;
  the "Page N is full" note waits until the sheet has cleared the top bar instead of sitting on it.
- Tests: functest, skintest, r12test, up16test, reducedtest, mobile18, reviewfix pass; ?still replay unchanged (gear only).

Check 23 done. Next: graphics – fresh sheet roll-in, word-goal celebration burst, drafts sheet visuals.

## Check 24 (v19f) – graphics
- Word-goal celebration: after the capsule's burst, two firework rings open over the page (skin colour, then gold),
  an outer ring and a slower inner one, drifting down with little gravity. On light paper they are drawn as glowing
  colour (additive light was invisible on cream); under the lamp / on dark paper they stay additive light.
- Tests: functest, up16test, reducedtest, r12test pass; ?still replay unchanged.

Check 24 done. Next: graphics – fresh sheet roll-in, drafts sheet visuals, skin swap transition.

## Check 25 (v19g) – graphics
- Skin swap: a double shockwave ring in the new skin's halo colour expands out of the capsule while the old skin melts
  away under the zap (0.5 s, off with reduced motion).
- Tests: skintest, functest, reducedtest, r12test pass.

Check 25 done. Next: graphics – fresh sheet roll-in, drafts sheet visuals.

## Check 26 (v19h) – graphics
- Drafts sheet: every draft row has a small paper thumbnail (current paper theme, its first lines as ink strokes,
  torn-off pages stacked behind with a soft shadow); tapping it opens the draft. The age ("1 h ago") never breaks
  across lines.
- Tests: up16test, backup, functest pass.

Check 26 done. Next: graphics – fresh sheet roll-in, then another full-screen look in every paper theme.

## Check 27 (v19i) – graphics
- Fresh sheet after a tear: its top edge visibly rises from the pipe to the top of the page (a thin light edge with a
  soft shadow under it), together with the grain sliding up; off with reduced motion and in ?still.
- Tests: functest, reducedtest, up16test, mobile18 pass; ?still replay unchanged.

Check 27 done. Next: graphics – a full-screen look in every paper theme and ink, light and lamp.

## Check 28 (v19j) – graphics
- Every paper × ink, light and lamp: under the lamp a coloured ribbon is now never lighter than half the darkened
  sheet (keeping its hue), so sepia on Old Parchment and red/blue on Cream stay readable outside the beam
  (sepia on parchment had been lighter than the paper and vanished). Default black ink unchanged.
- Tests: up16test, functest, skintest pass; ?still replay unchanged.

Check 28 done. Next: graphics – share-card picture in every skin/paper, then the lamp-mode capsule shading.

## Check 29 (v19k) – graphics
- Share picture checked on Blueprint/space, Black/vampire, Parchment/mummy (long page): the Blueprint title block no
  longer collides with the date (left out of the picture), and a dark sheet's rounded edge catches a faint light line
  so it separates from the background, as in the app.
- Tests: r12test, up16test, functest pass.

Check 29 done. Next: graphics – lamp-mode capsule shading per skin and the cobweb look on dark papers.

## Check 30 (v19l) – graphics
- Cobwebs on Blueprint and Black paper: the silk is drawn pale (as under the lamp) instead of the cream sheet's grey,
  which had almost vanished on dark paper.
- Tests: up16test, functest pass; ?still replay unchanged.

Check 30 done. Next: graphics – desktop backdrop at large sizes, then moth/bat detail at full resolution.

## Check 31 (v19m) – graphics
- Moth at full resolution: swept-back forewings with a darker band and an eye-spot, rounder hindwings, a furry thorax,
  a banded abdomen and feathery antennae; under the lamp it throws a soft shadow on the sheet, away from the bulb.
- Tests: up16test, functest, reducedtest, ambient soak pass.

Check 31 done. Next: graphics – bats and lightning at full resolution, then the spider.

## Check 32 (v19n) – graphics
- Bats at full resolution: the wing membrane is a little see-through and stretched over finger bones fanning from the
  wrist to each point of the scalloped edge, so the silhouette reads as a bat at every point of the flap.
- Spider checked at 3x: clean, unchanged.
- Tests: up16test, functest, ambient soak pass.

Check 32 done. Next: graphics – lightning flash and the wide-screen night, then the control panel's previews.

## Check 33 (v19o) – graphics
- Lightning on the wide night (1280x800) checked frame by frame: bolt, lit sky and silhouettes read well; unchanged.
- T strike checked at 3x frame by frame: matches the recording; unchanged on purpose.
- Control panel paper tiles hint at their sheets: scattered grain on Cream, soft tea stains on Parchment, faint
  fibres on Black (Blueprint already showed its grid).
- Full suite + perf re-run for the graphics round (results in Check 34).

Check 33 done. Next: confirm the suite/perf, then more graphics – ghost and witch details in lamp mode.

## Check 34 (v19p) – graphics (independent graphics review)
Full suite + perf for v19o passed (p50 ≈ 3.7 ms, p90 ≈ 8 ms on a quiet machine; an earlier 10 ms p90 was measured
while the review agent was running in parallel).
A graphics-only review at 390x844@3x and 1280x800 found 12 items. Kept on purpose: the lamp-mode webs, steam
streaks, spark look and the Frankenstein capsule's lamp shading (all measured from the recording, which turns the lamp
on in its first second), and the raised "°" (also from the recording). Fixed:
- Witch skin: the crescent moon is one closed path through the two circles' crossing points (cutting out a whole disc
  had left a ragged sliver of rim).
- Desktop: a soft shadow around the app column, and the night backdrop dims as the lamp comes on.
- Desktop moon: shaded from the upper left and darker toward its rim, soft-edged maria clipped to the disc.
- Share picture: the date moves to the left when the capsule (and whatever hangs from it) is above its usual spot.
- Control panel capsule thumbnails: drawn at their own scale (no stretching), with the indicator lights and a soft
  contact shadow, so they match the live capsule.
- Drafts: the rename pencil is a line icon in the same weight and gold as the other icons.
- Tests: functest, skintest, r12test, up16test, reducedtest, mobile18, backup, ambient soak, share cards pass;
  ?still replay unchanged (gear only).

Check 34 done. Next: graphics – Black paper sheet body (slight lift and grain), skin rim light under the lamp for the
non-recorded skins.

## Check 35 (v19q) – graphics
- Under the lamp, the nine non-recorded skins get a warm rim light along the top of the body (the bulb in the slot)
  and the glossy ones keep a dimmer, warmer reflection, so brass/copper/ghost/vampire no longer go flat and muddy.
  Frankenstein keeps its measured lamp look.
- Black paper lifted a touch (#1e1d1b → #22201d) so the sheet separates from the near-black surround.
- Tests: functest, skintest, up16test, r12test pass.

Check 35 done. Next: graphics – a pass over every toast/HUD/pill for consistent styling, then the hint line.

## Check 36 (v19r) – graphics
- Toasts restyled to match the goal pill and the brass menus: warm dark body, a fine brass hairline, soft drop shadow,
  rounder corners.
- Tests: functest, reviewfix pass.

Check 36 done. Next: graphics – the scroll-back view and page pill, then the spark particles' colours per skin in light mode.

## Check 37 (v19s) – graphics
- Flying sparks on a light sheet: like the fireworks, every spark that flies off the bolts is now drawn as glowing
  colour (soft halo + darker streak in the skin's spark colour) instead of added light, which vanished on cream.
  Under the lamp / on dark paper they stay additive.
- Tests: functest, reducedtest, skintest pass; perf p50 4.2–4.6 ms, p90 7–7.4 ms; ?still replay unchanged.

Check 37 done. Next: graphics – scroll-back view and page pill, then a fresh full-screen pass of every skin on dark papers.

## Check 38 (v19t) – graphics
- Scroll-back: the break between pages is a faint perforation across the sheet, broken around a small "page N"
  label (was a bare "— page N —").
- Tests: up16test, mobile18, functest pass.

Check 38 done. Next: graphics – every skin on Blueprint and Black paper, light and lamp.

## Check 39 (v19u) – graphics
- Every skin on Black paper: dark props (the vampire's perched bat, the witch's hat, fangs, flask) get a faint
  light halo on dark sheets so they no longer vanish; the capsule sprites are rebuilt when the paper changes.
- Tests: functest, skintest, up16test, r12test pass; ?still replay unchanged.

Check 39 done. Next: graphics – every skin on Blueprint; desktop wide layout at 1920x1080.

## Check 40 (v19v) – electric graphics (user: "More better graphics of the electric")
New layers on top of the recorded arc (off in ?still and with reduced motion, so the replay stays comparable):
- forks: on a strong discharge one or two jagged branches split off the main arc and die out in the air;
- plasma at both bolt heads: a fan of short, flickering jagged rays pointing away from the capsule;
- persistence: last frame's arc lingers faintly, so the discharge seems to dance;
- creeping arcs: after a big zap little arcs crawl along the capsule's top and bottom edge;
- the arc lights its surroundings: a pool of the skin's spark colour on the pipe and paper (additive under the lamp);
- every extra is drawn as halo + coloured body + white-hot core; on cream the body is a deeper shade of the spark
  colour so the white core reads.
- Checked frame by frame on Frankenstein (light + lamp), Pumpkin (light) and Witch (lamp).
- Tests: functest, skintest, reducedtest, up16test, r12test, mobile18 pass; perf p50 4.4–5.4 ms, p90 7–9 ms;
  ?still replay unchanged (gear only).

Check 40 done. Next: electric – idle micro-crackles between keystrokes and a stronger carriage-return zap.

## Check 41 (v19w) – electric graphics
- On a strong zap the current sometimes leaps out along the metal pipe from one end of the capsule (a jagged arc,
  halo + coloured body + white core).
- St. Elmo's fire under the lamp: the bolt heads keep a faint, restless glow in the skin's spark colours, with the odd
  tiny crackle, between discharges.
- Tests: functest, skintest, reducedtest, up16test, ambient soak pass; perf p50 4.7–5.1 ms, p90 8.2–8.6 ms;
  ?still replay unchanged.

Check 41 done. Next: electric – share picture gets a frozen arc; the tray swatches spark on hover.

## Check 42 (v19x) – electric graphics
- Share picture: a discharge frozen mid-crack between the bolt heads (arc, one fork, plasma fans at both heads),
  as if the picture was taken in the flash.
- Tests: r12test, functest, up16test pass.

Check 42 done. Next: electric – sparks in the skin tray swatches on hover, then the celebration's electric finale.

## Check 43 (v19y) – electric graphics
- Reaching a word goal: for 0.9 s long jagged arcs lash out of both bolt heads in all directions (fading), under the
  capsule bursts and before the firework rings.
- Tests: functest, up16test, reducedtest pass.

Check 43 done. Next: graphics rounds continue (Blueprint skins, lamp on every paper, 320px sheets, 1920 lamp).
