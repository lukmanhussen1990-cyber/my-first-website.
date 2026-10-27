# Master prompt — Idea 49: The Sunset Rule (verbatim)

Saved exactly as sent, so every later phase follows the same rules. Part 1 came in the first message (it was cut off after "CAMERA"); part 2 (from "CAMERA" to the end) came in the follow-up message.

**Owner's later instructions (these override the brief below):**
- **MODE is CODE.** "Don't make image prompts, and don't use GPT Image or any other AI image generator. This video must be made 100% with code … Build all the 3D scenes with code (Blender with Python, or Three.js), and render every frame." The GPT Image plan was thrown away; skip every step marked [GPT IMAGE ONLY] and follow [CODE ONLY].
- **Voice:** use the owner's ElevenLabs file `audio/voice_elevenlabs.mp3` (72 s, the full script) as the voiceover. Do not generate a voice.
- Subtitles, labels ("yellow labels"), sound effects and music are made in code.
- **Before the full render, show one still frame from each scene** for the owner to check.

---

```
=== GRACE IN MOTION · MASTER REEL PROMPT · IDEA 49: THE SUNSET RULE ===

MODE: GPT IMAGE      (change this word to CODE if you want 100% code this time)
TOPIC: The Sunset Rule: Jesus got angry, so is anger a sin? (Mark 3:5, John 2:15–16, 1 Peter 2:23, Luke 23:34, Ephesians 4:26)
VOICE: calm, warm male storyteller (use the SAME voice as my earlier reels if it is saved in the project)
LENGTH: 70–85 seconds
(Write AUTO after the topic if you don't want to approve the script first.)

WHO YOU ARE
You are my senior art director, character animator, motion designer, Remotion + Three.js engineer, sound designer and careful Bible scriptwriter. I run the Instagram account @GraceINMotion616. Make ONE finished, ready-to-post Instagram Reel. Voice, music, sound effects, captions and all the animation are made by you in code. No stock footage, no downloaded images or music, no AI video tools.

HOW THE MODE WORKS
- MODE: GPT IMAGE → you write GPT Image prompts, I make the characters, props and backgrounds in ChatGPT, and you animate my images. Follow every step, including the ones marked [GPT IMAGE ONLY].
- MODE: CODE → you draw everything yourself in code (SVG/canvas textures + a low-poly Three.js world). Skip the steps marked [GPT IMAGE ONLY] and follow the ones marked [CODE ONLY].
- Keep this episode in its own folder, grace-reels/episodes/sunset-rule/.
- Reuse what already works in the grace-reels project: the voice settings, the audio tools, the caption and label system, the end card, and the rig code. In GPT IMAGE mode, if Jesus images already exist from an earlier GPT Image episode (for example episodes/friend/assets/gpt/char_jesus_*.png), reuse them so Jesus looks the same across my reels, and only ask me for the new images.

============================================================
FIRST 3 SECONDS RULE (most important)
============================================================
The reel OPENS ON JESUS, in action. No slow start, no title card, no fade from black.
- The temple courtyard at bright noon, with a high sun in the sky. In slow motion, a heavy wooden table flips over. Coins burst into the air and spin, catching the sunlight, and doves explode up into the sky. Jesus stands strong in the middle with a cord in one hand and a serious face. (He drives out animals; no person is ever hit.)
- The camera does a fast push-in that slows down into slow motion (a speed ramp) on His face.
- The hook title punches in over the action.

THE BIG IDEA OF THIS REEL: THE SETTING SUN
- From frame 1 to the end, the sun slowly sets across the WHOLE reel, in every scene and every location: noon → afternoon → golden hour → sunset → dusk. Sky color, sun height, light color and shadow length all follow ONE global function, sunTime(frame).
- Don't point it out until the reveal. A small sun icon on a thin line under the captions slides slowly from left to right like a countdown, with no label.
- The reveal (line 14): "Did you notice? The sun has been setting this whole time." This is the "aha" moment that makes people rewatch and share.

============================================================
PHASE 1 — WATCH THE REFERENCE VIDEOS FIRST (do not skip)
============================================================
- The reference videos are in grace-reels/reference/ (any .mp4 there). If that folder is empty, stop and ask me to add them.
- Pull 1 frame every second with ffmpeg into reference/frames/. Look at the frames yourself, carefully.
- Write (or update) reference/style_notes.md covering:
  - Characters: head-to-body ratio, eye shape, nose, outline color and thickness, colors, hands and feet, poses.
  - World: palette, light, haze, shadows, low-poly density.
  - Text: captions, labels, verse cards, pacing and transitions.
- Our goal: the SAME style (flat paper-cut people + warm low-poly diorama world + italic serif captions), but better in every way: sharper characters, cinematic light, better animation and sound. Copy the style only. Never copy their characters, brand name, logo, series title, colors or script lines.
- [GPT IMAGE ONLY] Save 3 clean frames as style references: episodes/sunset-rule/style_refs/style_ref_1.png, style_ref_2.png and style_ref_3.png (a close-up, a wide scene and a group shot, with no text if possible).

============================================================
PHASE 2 — SCRIPT, SHOT LIST (and GPT IMAGE PROMPTS)
============================================================
A) SCRIPT (already checked; polish the flow only if needed and keep every fact and quote exact. *word* = keyword)
1. Jesus got *angry*. So… is anger a *sin*?
2. In a synagogue, a man stood there with a withered hand. And some people watched Jesus, hoping to catch Him breaking the rules.
3. The Bible says Jesus "looked round about on them with *anger*…"
4. But read the rest of that verse: "…being *grieved* for the hardness of their hearts."
5. He was angry and heartbroken… at the same *time*.
6. Then He healed the man *anyway*.
7. Another time, He made a whip of cords and *flipped* the tables in the temple.
8. "Make not my Father's house an house of *merchandise*."
9. But notice who He got angry *for*: God's house, and hurting people. Never for *Himself*.
10. When they mocked Him and hurt Him, "when he was reviled, reviled not *again*."
11. Instead He said: "Father, *forgive* them; for they know not what they do."
12. Angry about what hurt others. *Forgiving* about what hurt Him.
13. And the Bible gives anger a *deadline*: "Be ye angry, and sin not: let not the *sun* go down upon your wrath."
14. Did you notice? The sun has been *setting* this whole time.
15. Is there someone you need to forgive before it goes down? Just type *TODAY*.

EXACT KJV QUOTES (word for word; "…" means part of the verse is left out)
- Mark 3:1: "And he entered again into the synagogue; and there was a man there which had a withered hand."
- Mark 3:2: "And they watched him, whether he would heal him on the sabbath day; that they might accuse him."
- Mark 3:5: "And when he had looked round about on them with anger, being grieved for the hardness of their hearts, he saith unto the man, Stretch forth thine hand. And he stretched it out: and his hand was restored whole as the other."
- John 2:15: "And when he had made a scourge of small cords, he drove them all out of the temple, and the sheep, and the oxen; and poured out the changers' money, and overthrew the tables;"
- John 2:16: "…make not my Father's house an house of merchandise."
- 1 Peter 2:23: "Who, when he was reviled, reviled not again; when he suffered, he threatened not; but committed himself to him that judgeth righteously:"
- Luke 23:34: "Then said Jesus, Father, forgive them; for they know not what they do…"
- Ephesians 4:26: "Be ye angry, and sin not: let not the sun go down upon your wrath:"
- James 1:19 (optional, for the caption): "…let every man be swift to hear, slow to speak, slow to wrath:"
- Lamentations 3:22–23 (optional, for the loop and caption): "…his compassions fail not. They are new every morning…"

B) SHOT LIST (real timing comes from the voice timeline later; the sun keeps setting through all of it)
S1 HOOK (noon): the table flip in slow motion (see FIRST 3 SECONDS RULE). Hook title "JESUS GOT ANGRY" punches in, then flies into the caption spot. The tiny sun icon starts its slow slide.
S2 THE SYNAGOGUE (late noon): a stone interior with light beams from high windows. A thin man in a plain grey robe stands with his right hand curled and weak (shown gently). People on the benches watch Jesus with folded arms and side-eyes. Label "MARK 3:2".
S3 WITH ANGER: a close-up of Jesus' face as His eyebrows lower and He looks around at them. Label "WITH ANGER · MARK 3:5". A soft red glow around Him.
S4 AND GRIEVED: the SAME face; His eyebrows lift into sorrow and His eyes shine with a tear. A soft blue glow mixes into the red until both glow together. Label "AND GRIEVED".
S5 HEALED ANYWAY: "Stretch forth thine hand." Light flows into the man's curled hand, which slowly opens and becomes strong. He stares at it in joy.
S6 THE TEMPLE (afternoon): wide shot of the busy temple courtyard market with money tables, dove cages, sheep and oxen. A quick close-up of Jesus' hands braiding small cords. Then He drives out the sheep and oxen, tables flip, coins pour, cage doors open and doves fly. (No person is hit; people jump back.) Label "JOHN 2:15".
S7 CARD: floating card for John 2:16 with "MERCHANDISE" in gold, over the settling dust.
S8 BUT NOTICE: freeze frame. A clean graphic appears beside Jesus: "ANGRY FOR: GOD'S HOUSE · HURTING PEOPLE" on a red-gold tag, and below it "ANGRY FOR HIMSELF:" with a tag that stamps "NEVER".
S9 WHEN HE WAS HURT (golden hour): a crowd points, laughs and mocks Jesus, who stands calm and quiet. Shown gently, with no violence. Floating card for 1 Peter 2:23 with "REVILED NOT AGAIN" in gold.
S10 FORGIVE (late golden hour): the cross on a hill, seen from far away, with the sun low behind it. Card for Luke 23:34 with "FORGIVE" in gold.
S11 SPLIT SCREEN: left, the table flipping (warm red tone) with the tag "ANGRY FOR OTHERS"; right, the distant cross (gold tone) with the tag "FORGIVING FOR HIMSELF". Line 12.
S12 THE DEADLINE (sunset): the camera pulls back wide over the land. The sun touches the horizon. Full-screen card for Ephesians 4:26 with "SIN NOT" and "SUN" in gold.
S13 THE REVEAL: quick flashbacks of S1, S3, S6 and S9 side by side as small frames, each with its sky color, so you can see noon → afternoon → golden hour → sunset. The sun icon reaches the end of its line. Caption: "Did you notice? The sun has been setting this whole time."
S14 TODAY (dusk): a modern person in a room at dusk, in the same art style, holds a phone with an unsent message ("I forgive you" / "I'm sorry"). As the last sliver of sun disappears, they press send, and a warm light fills the room.
S15 CALL TO ACTION: a dusk sky with the first star. A comment box types "TODAY 🙏" with floating hearts.
S16 END CARD, then the loop: the sky jumps to a fresh sunrise (Lamentations 3:22–23 feeling: "new every morning") that flows into the noon temple shot of S1.

C) [GPT IMAGE ONLY] ASSET LIST + GPT IMAGE PROMPTS
- About 20–30 images in total (fewer if Jesus images can be reused). Mark each MUST-HAVE or NICE-TO-HAVE.
- Start every prompt with the same STYLE BLOCK written from style_notes.md: flat 2D paper-cut illustration, clean dark brown outline, simple shapes, matte flat colors with one soft shadow tone, warm biblical palette, minimal faces (almond eye with dark pupil, small nose, usually no mouth), high detail but clean, cinematic lighting, no text, no letters, no watermark, no frame, no border.
- CHARACTER BIBLE (repeat each description word for word in every prompt for that character):
  - Jesus: shoulder-length dark brown hair, short beard, warm brown skin, off-white robe with a soft blue-grey sash, simple sandals, no halo, no realistic face. (Reuse existing images if they exist.)
  - The man with the withered hand: thin, middle-aged, plain grey robe, short beard. One version with his right hand curled and weak, one with his hand open and strong.
  - The watchers in the synagogue: generic men in plain robes, arms folded, side-eye looks, with no symbols of any group.
  - Merchants and money changers: generic traders in colorful simple robes behind tables.
  - The mocking crowd: generic people pointing and laughing, with no symbols of any group.
  - The modern person: a young adult in a hoodie holding a phone, in the same flat style.
- New Jesus poses needed (only if they don't already exist): looking around with anger, the same face grieving with a tear, reaching out to heal, braiding cords, driving animals with a cord raised (no person in front of Him), standing calm while being mocked.
- For any new main character, ask for a turnaround sheet, a parts sheet for animation (head, torso, upper arms, forearms with hands, legs, and hair/beard/robe hem as separate pieces with overlap at the joints) and a poses sheet.
- Animals: sheep, oxen, and doves (sitting and flying poses).
- Props: wooden market tables (upright and tipped), silver and bronze coins (front and side), dove cages, a braided cord whip, benches, oil lamps, the cross (seen far away on a hill), a phone with a blank screen (you add the text in code).
- Backgrounds as layers (sky, far, middle, near): the synagogue interior, the temple courtyard market, the hill with the cross, a wide landscape for the sunset, and a modern room at dusk with a big window. Skies: make ONE sky layer for each time of day (noon, afternoon, golden hour, sunset, dusk, sunrise), so you can blend between them.
- Characters and props: 1024×1536 or 1536×1024 with a TRANSPARENT background PNG. Fallback: "plain solid flat magenta background (#FF00FF), no shadow on the background".
- Tell me which style_ref images (and which existing Jesus image) to attach in ChatGPT for each prompt.
- Exact file names, for example char_withered_hand_man_poses.png, char_watchers.png, prop_table.png, prop_coins.png, bg_temple_far.png, bg_temple_mid.png, sky_noon.png, sky_sunset.png.
- Save everything to episodes/sunset-rule/GPT_IMAGE_PROMPTS.md, and show it in chat as a numbered list. Each item has the file name, size, transparent yes/no, MUST/NICE, which refs to attach, and the full prompt in its own copy box. Show the script (part A) above the list too.
- Tell me to put the images into episodes/sunset-rule/assets/gpt/ with those exact file names.
>>> [GPT IMAGE ONLY] STOP HERE. Wait until I type "DONE". <<<

[CODE ONLY] Show me the script as plain text with a one-line plan for each scene, then wait for "OK" or my changes (skip the wait if I wrote AUTO).

============================================================
PHASE 3 — [GPT IMAGE ONLY] CHECK MY IMAGES
============================================================
- Open and look at every image yourself. Check for: the right file name, a transparent background (or a clean magenta key), clean edges without halos, the same style and the same Jesus design across images, correct hands (no extra fingers) and no text.
- Auto-fix what you can (remove magenta, clean halos, trim empty space, match color and brightness).
- If something can't be fixed, give me a short redo list with an improved prompt for each, then STOP and wait for "DONE" again. Otherwise keep going.

============================================================
PHASE 4 — VOICE, MUSIC AND SOUND (all made in code)
============================================================
VOICE
- Use the same voice as my earlier reels if its settings are saved in the project.
- Best: if ELEVENLABS_API_KEY is set, use ElevenLabs "/v1/text-to-speech/{voice_id}/with-timestamps" with model eleven_multilingual_v2, and pass previous_text / next_text.
- Free fallback: edge-tts with en-US-AndrewMultilingualNeural (backup en-US-ChristopherNeural), rate "-5%", boundary="WordBoundary".
- Make each sentence a separate clip, then join them with your own pauses: 0.3 s between sentences, 0.6 s after "at the same time", 0.8 s before "But notice", 0.8 s before "Did you notice?", and 0.6 s before the last line.
- Save timeline.json with every word's start and end time, keyword flag, sentence id and scene id. Never use the robotic browser voice.
MUSIC + SOUND
- Write a Node synth that renders 48 kHz WAV: soft pads, felt piano, low strings, a gentle pulse and long reverb. It starts tense (D minor) and resolves into a warm D major at "Father, forgive them", softest and warmest at the sunset.
- Sound effects:
  - Table flip: a heavy wood crash, a cascade of coin jingles, a dove wing burst.
  - Synagogue: stone room tone, quiet murmurs (no words).
  - Anger and grief: a low red rumble, then a soft sad chime as the tear shines.
  - Healing: a gentle rising shimmer.
  - Temple market: bustle, sheep and oxen hooves, cords swishing (no impact sounds on people).
  - "NEVER" stamp: a firm stamp hit.
  - Mocking: crowd laughter texture (no words), then near silence around Jesus.
  - Cross: wind on the hill.
  - Sunset reveal: a big warm swell, and a soft "tick" each time a flashback frame appears.
  - Phone send: a soft "whoosh" and a warm chord.
  - Dusk: crickets and a single bright note for the first star.
- Line big hits up with the animation, to the frame. Effects never cover words.
- Mix into ONE file, audio/final_mix.wav, with the music ducking about 8 dB under the voice. Normalize to −14 LUFS, true peak −1 dB (ffmpeg loudnorm, two passes).

============================================================
PHASE 5 — BUILD AND ANIMATE
============================================================
Stack: Node 20+, latest Remotion + @remotion/three + three, postprocessing (bloom, depth of field, ambient occlusion, god rays, SMAA), and @remotion/motion-blur for fast shots only. Fonts from npm (@fontsource/cormorant-garamond, @fontsource/inter). Video: 1080×1920, 30 fps. Everything must be a pure function of the frame number (useCurrentFrame): no timers, no Date.now(), no Math.random() (use a seeded random).

THE GLOBAL SUN (build this first)
- One function, sunTime(frame), goes from 0 (noon) to 1 (dusk) across the reel, using the timeline. Every scene reads it for: sky color (blending the sky layers in GPT IMAGE mode, or a procedural sky in CODE mode), sun position, key light color (white-gold → orange → red → deep blue), shadow length and direction, and the color grade.
- It must feel smooth and continuous across cuts, as if the whole reel is one afternoon.

[GPT IMAGE ONLY] 2.5D WORLD AND RIG FROM MY IMAGES
- Place the background layers as planes at different depths with a long-lens camera for real parallax. Add code-made haze, light beams, dust, and soft blurred silhouette shadows under characters that lengthen with sunTime.
- Rig method 1 (best): cut the parts sheets into pieces, set pivots at the joints (shoulder, elbow, hip, knee, neck), and animate a 2D bone rig.
- Rig method 2 (if the parts don't line up): animate from the pose images with a soft mesh warp, and cross-switch poses on fast moves with a 2-frame smear.
- Blinking (an eyelid patch in the matching skin color), breathing, and swaying robes, hair and beards with seeded springs.

[CODE ONLY] CHARACTERS AND WORLD IN CODE
- Characters: flat paper-cut figures drawn as clean SVG vector parts on high-resolution textures (at least 1024×2048), with a constant on-screen outline of about 5 px, two-tone cel shading that matches the sun direction (it changes with sunTime), fabric folds, hair and beard strands, and mitten hands with thumbs. Y-axis billboards with shadows that follow their shape (alphaTest + customDepthMaterial).
- World: a crafted low-poly Three.js world (bevelled stone, color variation on each face, rich set dressing with InstancedMesh), with soft shadows, ambient occlusion, height fog and filmic tone mapping.

ACTING (both modes)
- Jesus: strong and controlled in the temple (anger with purpose, never wild). His face shifts from anger to grief in S3–S4. He is gentle while healing, and perfectly calm while mocked.
- The man with the withered hand: shy and hunched, then an amazed joy as his hand opens.
- The watchers: stiff, arms folded, eyes narrowing.
- The modern person: hesitating, thumb hovering over send, a deep breath, then send.
- Use the 12 principles: anticipation (the table tips back before it flips), follow-through on robes, cords and hair, arcs, ease in and out with holds, subtle squash and stretch on the coin bounces, secondary action (doves, dust, animals), and clear staging (Jesus is the focus).

EFFECTS
- Coins: a metallic shine, spin, bounce and settle, with motion blur on the burst.
- Doves: a flight rig with a flap cycle and banking turns.
- Glows: soft red (anger) and blue (grief) light auras that mix in S3–S4. Healing light flows into the hand.
- Dust and light beams in the synagogue and temple, and the sun disc with bloom at sunset.

CAMERA
- A speed-ramp push-in (S1), slow push-ins on the faces (S3–S4), a close macro on the hand opening (S5), a big tracking shot through the market chaos (S6), a freeze (S8), a slow tilt from the mocking crowd to Jesus' calm face (S9), a long-lens shot of the distant cross with the low sun (S10), a split screen (S11), a giant pull-back over the land at sunset (S12), a flashback grid (S13), and a slow push on the phone (S14).
- Add a tiny seeded handheld drift, and parallax foreground objects (columns, cages, branches).

TEXT AND GRAPHICS (HTML/SVG on top — never put text inside images or WebGL)
- Header (y ≈ 150 px): small gold logo + "GRACE IN MOTION" on the left; "THE SUNSET RULE" on the right. Inter SemiBold 22 px caps, letter-spacing 0.18em, 75% opacity.
- Captions (y ≈ 240–600 px, 72 px side margins, left aligned, max 3 lines): Cormorant Garamond Medium Italic, 66 px, line-height 1.15. Words appear in sync with the voice (fade + rise 8 px over 120 ms, next word as a 25% ghost 150 ms early). Keywords: UPPERCASE, Cormorant Garamond Bold, gold, with a tiny pop. Use a soft scrim behind the text so it's always readable.
- The sun line: a thin line about 600 px wide under the captions (y ≈ 650 px), with a small glowing sun icon that slides along it with sunTime. It turns from white-gold to orange to red as it goes. No label until the reveal.
- Hook title (0–1.8 s): "JESUS GOT ANGRY" in huge text (110–130 px), then it flies into the caption spot.
- Tags in S8 and S11: clean rounded tags in Inter SemiBold caps. The "NEVER" stamp is deep gold with a rough stamped edge.
- Labels: a small near-black tag (#141210, 90%) with white caps (Inter SemiBold 24 px, letter-spaced) and a thin 2 px leader line that sticks to the character during camera moves.
- Scripture cards: warm cream paper (#F3ECDF), quote centered in italic serif 60 px, keywords in deep-gold caps, the reference in small letter-spaced caps (e.g. "EPHESIANS 4:26 · KJV"). Hold 4–6 s with slow movement.
- Phone screen (S14): a generic clean chat screen, no real app names or logos.
- Instagram safe zones: nothing important below y = 1450 px or right of x = 960 px.
- End card (last 3 s): dark warm background (#14100D), our logo draws itself (a slim gold cross with three short motion lines on its left), "GRACE IN MOTION", "@GraceINMotion616", tagline "Hard questions. Bible answers." Then the sunrise loop back to S1.
- Brand colors: cream #F3ECDF, ink #1E1A16, bright gold #F2B544 (on dark), deep gold #9A5B0C (on light), red #C0392B only for the anger glow accents.

SPECIAL RULES
- Jesus never hits a person. In the temple He drives out the animals and flips tables; people only jump back.
- No blood, no violence, no crucifixion close-ups. The cross is only seen from far away.
- God the Father is never shown as a person, only as light. Jesus is a simple, dignified figure, no halo, no realistic face.
- Never blame any group of people. The watchers, merchants and crowd are generic. Keep the message personal and kind.

============================================================
PHASE 6 — CHECK, THEN RENDER
============================================================
1. Animatic: 540×960, heavy effects off, full audio. Save it as out/animatic_sunset-rule.mp4. Watch it yourself. Are the first 3 seconds gripping? Does the sun set smoothly and believably across ALL scenes? Does the reveal land? Fix the timing and anything that drags.
2. Render 10 stills at full quality with `npx remotion still` (the table flip, the synagogue, anger, grief, the healed hand, the market chaos, "NEVER", the distant cross, the sunset reveal grid, the phone). Look at each one and fix rig seams, halos, overlapping text, anything outside the safe zones, and sky colors that don't match sunTime.
3. Final render: `npx remotion render` (--codec=h264 --crf=18). Use --gl=angle with a GPU or --gl=swangle without one. If Remotion can't download its browser, use --browser-executable.
4. ffprobe check: 1080×1920, 30 fps, H.264 yuv420p, AAC 48 kHz, 60–90 s, about −14 LUFS.
5. Check every KJV quote and reference one last time against the list above.

============================================================
PHASE 7 — DELIVER
============================================================
- In out/: reel_sunset-rule.mp4, cover_sunset-rule.png (Jesus beside a flipped table with coins flying and a big sun low in the sky; text "JESUS GOT ANGRY. IS ANGER A SIN?") and caption_sunset-rule.txt (hook line, 2–3 short lines, James 1:19 as a closing line, "Type TODAY 👇", 3–5 hashtags).
- Add "The Sunset Rule" and its episode number to ideas_used.md, with the mode used.
- Finish with a short summary in simple English: where the files are, which voice you used, which mode and rig method you used, and 3 ideas to make the next reel even better.
```
