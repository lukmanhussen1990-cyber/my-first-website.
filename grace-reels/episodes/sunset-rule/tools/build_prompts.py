"""Generate GPT_IMAGE_PROMPTS.md so every prompt repeats the style block and
character descriptions word for word.
usage: python3 -I tools/build_prompts.py GPT_IMAGE_PROMPTS.md  (run inside episodes/sunset-rule/)"""
import sys

STYLE = ("STYLE: flat 2D paper-cut illustration in the same art style as the attached style reference images "
         "(copy the style only, not their characters). Clean dark brown outline (#2A1A10) of even thickness around "
         "every shape, simple shapes, matte flat colors with one soft shadow tone, no texture noise. Warm biblical "
         "palette: sand, cream, terracotta, olive, warm brown, muted blue-grey. People are about 4.5 heads tall with "
         "thin tube arms and legs, rounded mitten hands with a small thumb and simple rounded feet. Minimal faces in "
         "side or 3/4 view: one almond-shaped white eye with a dark round pupil, a small pointed nose, usually no "
         "mouth. High detail but clean, sharp edges, cinematic soft lighting. No text, no letters, no numbers, no "
         "labels, no watermark, no logo, no frame, no border.")

KEY = ("BACKGROUND: transparent PNG. If transparency is not possible, use a plain solid flat magenta background "
       "(#FF00FF) with no shadow on it, and no pink or magenta anywhere in the drawing.")
SKY_KEY = ("SKY: fully transparent. If transparency is not possible, make the sky plain solid flat magenta (#FF00FF) "
           "and use no pink or magenta anywhere else.")
SHEET = ("Everything complete and inside the image (nothing cut off), evenly spaced with wide empty gaps, nothing "
         "touching or overlapping, all at the same scale. No ground, no floor shadow.")
SKY_EDIT = "Edit the attached sky. Keep everything exactly the same (same clouds, same shapes, same positions) and change only the colors to "

JESUS = ("Jesus: shoulder-length dark brown hair parted in the middle, a short neat dark brown beard, warm brown skin, "
         "an ankle-length off-white robe with long sleeves and a few simple fold lines, a soft blue-grey sash tied in "
         "a small knot at the center front, simple brown sandals. Calm, strong and dignified. No halo, no realistic "
         "face: simple style face with short dark eyebrows.")
MAN = ("The man with the withered hand: a thin middle-aged man with short dark hair, a short beard with a little grey, "
       "light warm-brown skin, a plain grey ankle-length robe with elbow-length sleeves and a darker grey rope belt, "
       "simple sandals, simple style face with short eyebrows.")
WATCHERS = ("The watchers: generic men in plain ankle-length robes in muted brown, ochre, dark olive and slate grey, "
            "some with simple plain head cloths, arms folded, side-eye looks, with no symbols of any group (no prayer "
            "shawls, no tassels, no special hats).")
MERCHANTS = ("The merchants: generic traders and money changers in colorful simple robes in terracotta, mustard, teal "
             "and plum, some with simple head wraps.")
CROWD = ("The mocking crowd: generic people in plain robes of mixed muted colors, pointing and laughing, with no "
         "weapons, no armor and no symbols of any group.")
MODERN = ("The modern person: a young adult with short dark curly hair and warm brown skin, wearing a mustard-yellow "
          "hoodie, dark blue jeans and white sneakers.")

L, P = "1536×1024 (landscape)", "1024×1536 (portrait)"
R1, R2, R3 = "style_ref_1.png", "style_ref_2.png", "style_ref_3.png"
TURN = "char_jesus_turnaround.png"
SAME_JESUS = ("match the attached turnaround exactly (same face, hair, beard, robe, sash, sandals, colors and "
              "proportions).")

A = []  # (file, size, transparent, priority, attach, used_in, body)
A += [("char_jesus_turnaround.png", L, "yes", "MUST", [R1, R3], "reference for every other Jesus image · MAKE THIS FIRST",
       f"Character turnaround sheet of ONE character. {JESUS} Show him 4 times, full body, standing relaxed with arms at "
       "his sides, in one row from left to right: 1) front view, 2) 3/4 view facing left, 3) side view facing left, "
       "4) back view. Exactly the same design, colors, proportions and outline thickness in all 4 views, feet on one "
       f"shared baseline. {SHEET} {KEY}")]
A += [("char_jesus_parts.png", L, "yes", "MUST", [TURN, R1], "the 2D bone rig (S1, S2, S5, S6, S9)",
       "Cut-out animation parts sheet for a 2D puppet of this exact character; match the attached turnaround exactly. "
       f"{JESUS} 3/4 view facing left. Draw every body part as a separate, complete piece, spread out on the sheet: "
       "1) head with face, beard and front hair; 2) back hair piece; 3) torso and upper robe down to the knees, with "
       "the sash; 4) lower robe and hem as one wide piece; 5) left upper arm with sleeve; 6) left forearm with sleeve "
       "end and hand; 7) right upper arm with sleeve; 8) right forearm with sleeve end and hand; 9) left lower leg with "
       "sandal; 10) right lower leg with sandal; 11) the two hanging sash ends. Every joint end is rounded and has a "
       "little extra overlap, so the pieces can rotate at the neck, shoulders, elbows, hips and knees without gaps. "
       f"No arrows, no guide lines. {SHEET} {KEY}")]
A += [("char_jesus_poses_temple.png", L, "yes", "MUST", [TURN, R1], "S1, S6, S8, S11, cover",
       f"Pose sheet of this exact character; {SAME_JESUS} {JESUS} Full body, 3/4 view facing left, 4 poses in one row: "
       "1) standing with head slightly lowered, both hands together at waist height braiding a few thin brown cords; "
       "2) standing strong and planted, feet apart, serious focused face with lowered eyebrows, a short whip of braided "
       "cords hanging low in one hand; 3) striding forward with purpose, the cord whip raised high in one hand, the "
       "other arm stretched forward to drive animals away, robe and sleeves swinging (nobody in front of him); "
       "4) leaning forward with both hands low and forward, as if overturning a heavy table (no table drawn). Strong "
       f"and controlled, never wild. Feet on one shared baseline. {SHEET} {KEY}")]
A += [("char_jesus_poses_ministry.png", L, "yes", "MUST", [TURN, R1], "S2, S5, S9",
       f"Pose sheet of this exact character; {SAME_JESUS} {JESUS} Full body, 3/4 view facing left, 4 poses in one row: "
       "1) walking calmly, mid-stride; 2) standing still and looking around with anger: eyebrows lowered, head turned "
       "a little toward the viewer, shoulders squared, hands at his sides; 3) reaching out gently to heal: one arm "
       "stretched forward at chest height with the palm open, kind calm face, leaning forward slightly; 4) standing "
       "perfectly calm and quiet while being mocked: hands loosely folded in front, head slightly lowered, peaceful "
       f"eyes, steady posture. Feet on one shared baseline. {SHEET} {KEY}")]
A += [("char_jesus_face_anger.png", P, "yes", "MUST", [TURN, "char_jesus_poses_ministry.png", R1], "S1 (end of push-in), S3, S13",
       f"Close-up of this exact character; match the attached images exactly. {JESUS} Head and shoulders, large in the "
       "frame (the head fills about half of the image width), 3/4 view facing left, eye looking left. Expression: "
       "controlled, righteous anger: eyebrows lowered and pulled together, eye slightly narrowed and focused, head "
       "steady. Keep the same simple flat style face as the full-body images (almond eye with a dark pupil, small nose, "
       "short dark eyebrows, no mouth). Hair and beard are clean flat shapes with a few strand lines. No glow, no halo. "
       f"Only the shoulders are cut off by the bottom edge. {KEY}")]
A += [("char_jesus_face_grief.png", P, "yes", "MUST", ["char_jesus_face_anger.png (same chat, right after #5)"], "S4",
       f"Edit the attached image of this character. {JESUS} Keep everything exactly the same (same size, framing, head "
       "shape, hair, beard, robe, colors and outline) and change only the expression to deep sorrow: the inner ends "
       "of the eyebrows lift up and together, the eye softens and looks slightly down, and one small shining tear sits "
       f"on the lower eyelid. Heartbroken, not angry. {KEY}")]
A += [("char_jesus_hands_braiding.png", L, "yes", "NICE", [TURN, R1], "S6 (quick close-up)",
       f"Close-up of only the hands of this exact character. {JESUS} Only his two hands and forearms are visible, with "
       "the ends of his long off-white sleeves at the wrists, braiding three thin brown cords together into a short "
       "whip, seen from the side. For this close-up the hands have simple rounded fingers: exactly four fingers and "
       f"one thumb on each hand. Clean flat shapes, one soft shadow tone. Hands and cords complete, not cut off. {KEY}")]
A += [("char_withered_hand_man_poses.png", L, "yes", "MUST", [TURN, R1, R3], "S2, S5",
       "Pose sheet of ONE new character, drawn in exactly the same style and size as the attached Jesus turnaround (but "
       f"a different man). {MAN} Full body, 3/4 view facing RIGHT, so his right hand is the hand nearest the viewer. "
       "4 poses in one row: 1) standing shy and hunched, head lowered, his right hand curled and weak with thin bent "
       "fingers, held close against his chest, shown gently; 2) stretching his right arm straight forward, the right "
       "hand still curled; 3) the right arm forward, the right hand now open and strong with fingers spread, staring at "
       "it in amazed joy, eyebrows raised, leaning back a little; 4) both hands raised in joy, head tilted up, eyes "
       f"closed happily. Feet on one shared baseline. {SHEET} {KEY}")]
A += [("char_withered_hand_closeup.png", L, "yes", "MUST", ["char_withered_hand_man_poses.png", R1], "S5 (macro on the hand)",
       f"Close-up of only the right hand and forearm of this same man. {MAN} Only his hand and forearm are visible, "
       "coming in from the left, with the end of the grey sleeve near the elbow. Show the same hand 3 times in one row, "
       "the same size and the same angle, with the wrist in the same position each time: 1) curled and weak, thin "
       "fingers bent inward; 2) halfway open; 3) fully open and strong, fingers spread, healthy. For this close-up the "
       f"hand has simple rounded fingers: exactly four fingers and one thumb. {SHEET} {KEY}")]
A += [("char_watchers.png", L, "yes", "MUST", [R3, R1], "S2, S3 (background)",
       f"A group of five watchers. {WATCHERS} They sit side by side on one long low stone bench (the bench is "
       "included), bodies in 3/4 view facing right, arms folded across their chests, heads turned to the right with "
       "narrowed side-eye looks, stiff upright posture. Each one is different: one old with a grey beard, one young and "
       "thin, one heavy-set, two middle-aged. Small gaps between them so they overlap very little. Complete, nothing "
       f"cut off. No floor, no wall, no shadow. {KEY}")]
A += [("char_merchants.png", L, "yes", "MUST", [R2, R1], "S6",
       f"Five different merchants. {MERCHANTS} Full body, in one row: 1) standing and counting a coin in his open hand, "
       "facing right; 2) holding a small woven dove cage, facing right; 3) jumping back in surprise, arms up, leaning "
       "back, facing right; 4) stumbling back startled with hands raised, facing left; 5) ducking away while holding "
       "his head wrap, facing left. Nobody is hurt and nobody is touched; they only jump back. Feet on one shared "
       f"baseline. {SHEET} {KEY}")]
A += [("char_mocking_crowd.png", L, "yes", "MUST", [R3, R1], "S9",
       f"Six different people of the mocking crowd. {CROWD} Full body, standing in one row, 3/4 view facing left: "
       "1) pointing to the left and laughing, head tilted back; 2) laughing with one hand on the belly, eyes as closed "
       "happy curves; 3) arms crossed with a scornful raised eyebrow; 4) cupping a hand by the face to call out; "
       "5) leaning forward and wagging a finger; 6) shrugging and laughing. Show the laughing with body language only. "
       f"No violence, nobody touching anyone. Feet on one shared baseline. {SHEET} {KEY}")]
A += [("char_modern_person_poses.png", L, "yes", "MUST", [TURN, R1], "S14",
       "Pose sheet of ONE character, drawn in exactly the same style and size as the attached Jesus turnaround (but a "
       f"different, modern person). {MODERN} 3/4 view facing right, sitting on a simple low wooden stool (the stool is "
       "included), 4 poses in one row: 1) holding a phone in both hands and looking down at it, hesitating, thumb "
       "hovering over the screen; 2) eyes closed, shoulders lifted, taking a deep breath, phone still in both hands; "
       "3) pressing the screen with the thumb, determined; 4) phone lowered to the lap, head lifted, eyes closed, "
       f"peaceful and relieved. The phone is a plain dark rectangle with nothing on the screen. {SHEET} {KEY}")]
A += [("prop_phone_in_hand.png", P, "yes", "MUST", ["char_modern_person_poses.png", R1], "S14 (slow push on the phone)",
       f"Close-up of only the right hand of this same person holding a modern smartphone upright. {MODERN} Only the "
       "hand, the wrist and the end of the mustard-yellow hoodie sleeve are visible, coming in from the bottom. The "
       "screen faces the viewer straight on, and the thumb rests just below the screen. The screen is one perfectly "
       "flat, solid pure green (#00FF00) rounded rectangle with nothing on it (it will be replaced later). Plain dark "
       "phone frame, no brand, no logo, no buttons drawn on the screen. For this close-up the hand has simple rounded "
       f"fingers: four fingers and one thumb. Phone and hand large in the frame and complete. {KEY}")]
A += [("char_doves.png", L, "yes", "MUST", [R1, R2], "S1, S6 (flap cycle)",
       "Animation sheet of ONE white dove: soft white body, light grey wing tips, a small dark eye and a small "
       "warm-orange beak, with the same dark brown outline. Side view facing right, 6 drawings in two rows: 1) sitting; "
       "2) wings fully up; 3) wings level; 4) wings fully down; 5) gliding with wings spread; 6) taking off with wings "
       f"half up. The same dove at the same size in all 6. {SHEET} {KEY}")]
A += [("char_sheep_oxen.png", L, "yes", "MUST", [R1, R2], "S6",
       "Animal sheet, side view facing right, in two rows. Top row, the same fluffy cream-white sheep with a dark brown "
       "face and legs: 1) standing; 2) running with legs stretched; 3) running with legs gathered. Bottom row, the "
       "same sturdy brown ox with short curved horns: 4) standing; 5) running with legs stretched; 6) running with "
       f"legs gathered. {SHEET} {KEY}")]
A += [("prop_market_set.png", L, "yes", "MUST", [R2], "S1, S6, S11, cover",
       "Prop sheet for a temple market, 3/4 view from slightly above, every object separate: 1) a heavy wooden money "
       "changer's table, upright, with an empty top; 2) the same table tipping over on two legs at 45 degrees; 3) the "
       "same table overturned on its side; 4) a stack of three woven dove cages with closed doors; 5) one woven dove "
       "cage with its small door open; 6) a short whip made of small braided brown cords; 7) a small pile of silver and "
       "bronze coins; 8) one coin seen from the front, and the same coin seen from the side; 9) a large clay jar; "
       f"10) a terracotta cloth awning on two wooden poles. {SHEET} {KEY}")]
A += [("prop_synagogue_set.png", L, "yes", "NICE", [R3, R2], "S2 (foreground parallax)",
       "Prop sheet for a small ancient stone synagogue, 3/4 view, every object separate: 1) a long low stone bench; "
       "2) a short stone bench; 3) a small clay oil lamp with a little flame; 4) a hanging bronze oil lamp on chains; "
       "5) one tall, thick round stone column shown from top to bottom; 6) a simple wooden reading table with a rolled "
       f"scroll on it; 7) a woven floor mat. {SHEET} {KEY}")]
A += [("bg_temple_courtyard.png", L, "sky only", "MUST", [R2], "S1, S6, S8, S9, S11, cover",
       "Background plate with no people and no animals: a wide ancient temple courtyard market seen from a high 3/4 "
       "angle, like a diorama. Large pale stone paving with an open, empty area in the center; rows of simple market "
       "stalls with cloth awnings (terracotta, mustard, teal) along the left and right sides; a long colonnade of cream "
       "stone columns across the back; behind it, a large stone temple building with tall plain walls, a wide doorway "
       "and golden trim. Warm sand and cream stone colors. Even soft daylight from above, very soft short shadows, no "
       f"visible sun. {SKY_KEY}")]
A += [("bg_synagogue.png", P, "no", "MUST", [R3, R2], "S2–S5",
       "Background plate with no people: the inside of a small ancient stone synagogue, seen from a slightly high "
       "angle. Warm sandstone walls of large blocks, two thick stone columns, rows of low stone benches along the walls, "
       "a stone floor with an open area in the middle, and a row of small high windows near the top of the back wall. "
       "The window openings are plain flat pale cream (light will be added later). Soft, even, warm indoor light with "
       "gentle shadows. Opaque full background.")]
A += [("bg_hill_cross.png", L, "sky only", "MUST", [R2], "S10, S11",
       "Background plate with no people: a quiet, wide landscape seen from far away. A rounded rocky hill outside an old "
       "city wall; on top of the hill stands one simple wooden cross, small and far away, seen only as a dark "
       "silhouette, with no figure on it. Low-poly rocks, dry golden grass, a few small olive trees and a winding path; "
       "the city wall and some flat-roofed houses far off to one side. Soft even light, no visible sun. "
       f"{SKY_KEY}")]
A += [("bg_land_far.png", L, "sky only", "MUST", [R2], "S12 (giant pull-back)",
       "Background plate with no people: a very wide view over ancient hill country from a high place. Layers of "
       "rolling hills fading into the distance, a small walled city with flat roofs in the middle distance, a winding "
       "road, and olive groves and fields as simple low-poly shapes. The horizon sits low, in the lower third of the "
       f"image. Soft even light, no visible sun. {SKY_KEY}")]
A += [("bg_land_near.png", L, "yes", "NICE", ["bg_land_far.png", R2], "S12 (foreground parallax)",
       "Foreground layer for the attached landscape, in the same style and colors: the grassy top of a hill along the "
       "bottom edge, with one olive tree at the far left and a few rocks and tall dry grass at the right. No people. "
       "Everything above the hilltop is fully transparent. If transparency is not possible, make it plain solid flat "
       "magenta (#FF00FF) and use no pink or magenta anywhere else.")]
A += [("bg_modern_room.png", P, "no (green window)", "MUST", [R1, "char_modern_person_poses.png"], "S14",
       "Background plate with no people: a simple, cozy modern bedroom in the same flat paper-cut style, seen from the "
       "side. A big window on the back wall fills most of the upper half; a low bed with a blanket on the right; a "
       "small side table with a lamp that is switched off; a potted plant; a rug on a wooden floor; open floor space "
       "in front of the window. The window glass is one plain, flat, solid pure green (#00FF00) area so the sky can be "
       "added later. Calm, neutral evening light, flat colors. No posters with words, no logos. Opaque full background.")]
A += [("sky_noon.png", L, "no", "MUST", [R2], "S1–S4 · make this sky first",
       "Sky only: no ground, no sun, no birds. A clear high-noon sky in the same paper-cut style: a smooth bright pale "
       "blue at the top fading to warm pale cream at the bottom. A few simple flat paper-cut clouds (soft white with "
       "one soft shadow tone, no outline), only in the lower third; the top two-thirds almost empty. Opaque full "
       "background.")]
A += [("sky_afternoon.png", L, "no", "NICE", ["sky_noon.png"], "S5–S8",
       SKY_EDIT + "mid-afternoon: a slightly deeper blue at the top, warm pale yellow at the bottom, clouds lit warm "
       "on their lower edges. Still no sun, no ground.")]
A += [("sky_golden.png", L, "no", "MUST", ["sky_noon.png"], "S9–S10",
       SKY_EDIT + "golden hour: honey gold at the bottom, warm peach in the middle, soft blue-violet at the top, "
       "clouds glowing gold underneath. Still no sun, no ground.")]
A += [("sky_sunset.png", L, "no", "MUST", ["sky_noon.png"], "S11–S12",
       SKY_EDIT + "sunset: deep orange and warm red near the bottom, coral in the middle, dusky violet-blue at the "
       "top, clouds glowing orange-red underneath with dark violet-grey tops. Still no sun, no ground.")]
A += [("sky_dusk.png", L, "no", "MUST", ["sky_noon.png"], "S13–S15",
       SKY_EDIT + "dusk: deep blue-violet at the top fading to a thin, dim orange glow at the very bottom, clouds as "
       "dark blue-grey shapes. No stars, no sun, no ground.")]
A += [("sky_sunrise.png", L, "no", "NICE", ["sky_noon.png"], "S16 (loop back to S1)",
       SKY_EDIT + "a fresh sunrise: pale gold at the bottom, soft peach and light aqua above, clouds lit warm gold "
       "from below. Still no sun, no ground.")]


def prompt(a):
    file, size, _t, _p, _att, _u, body = a
    return f"{STYLE}\n\n{body}\n\nImage size: {size}."


SCRIPT = """1. Jesus got *angry*. So… is anger a *sin*?
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
15. Is there someone you need to forgive before it goes down? Just type *TODAY*."""

PARTS = [
    ("Hook", "line 1", "punchy and curious",
     "Jesus got angry. So… is anger a sin?"),
    ("The synagogue", "lines 2–6", "storyteller; a little slower on the quotes",
     "In a synagogue, a man stood there with a withered hand. And some people watched Jesus, hoping to catch Him "
     "breaking the rules. The Bible says Jesus \"looked round about on them with anger…\" But read the rest of that "
     "verse: \"…being grieved for the hardness of their hearts.\" He was angry and heartbroken… at the same time. "
     "Then He healed the man anyway."),
    ("The temple", "lines 7–8", "stronger, more energy",
     "Another time, He made a whip of cords and flipped the tables in the temple. \"Make not my Father's house an "
     "house of merchandise.\""),
    ("But notice", "line 9", "firm and clear",
     "But notice who He got angry for: God's house, and hurting people. Never for Himself."),
    ("When He was hurt", "lines 10–12", "soft and tender",
     "When they mocked Him and hurt Him, \"when he was reviled, reviled not again.\" Instead He said: \"Father, "
     "forgive them; for they know not what they do.\" Angry about what hurt others. Forgiving about what hurt Him."),
    ("The deadline", "line 13", "slow and serious",
     "And the Bible gives anger a deadline: \"Be ye angry, and sin not: let not the sun go down upon your wrath.\""),
    ("The reveal", "line 14", "quiet wonder",
     "Did you notice? The sun has been setting this whole time."),
    ("Call to action", "line 15", "warm, gentle invitation",
     "Is there someone you need to forgive before it goes down? Just type today."),
]

SHOTS = [
    ("S1 Hook", "0.0–3.4", "noon · 0.00", "1", "Slow-motion table flip in the noon temple: coins burst and spin, doves explode upward, Jesus stands strong with a cord. \"JESUS GOT ANGRY\" punches in huge, then flies into the caption spot; the sun icon starts its slide.", "Speed-ramp push-in onto His face", "3, 5, 15, 17, 19, 25"),
    ("S2 The synagogue", "3.7–12.6", "late noon · 0.05", "2", "Stone interior with light beams from the high windows; the man stands hunched with his curled right hand; watchers on the benches fold their arms and side-eye Jesus as He walks in. Label \"MARK 3:2\".", "Slow drift, foreground column parallax", "4, 8, 10, 18, 20"),
    ("S3 With anger", "12.9–17.2", "0.12", "3", "Close-up: His eyebrows lower and He looks round at them; a soft red glow. Label \"WITH ANGER · MARK 3:5\".", "Slow push-in", "5, 10, 20"),
    ("S4 And grieved", "17.5–27.4", "0.18", "4–5", "The same face: brows lift into sorrow, a tear shines; blue glow mixes into the red until both glow together. Label \"AND GRIEVED\". Hold on \"at the same time\" (0.6 s pause).", "Slow push-in continues", "6, 20"),
    ("S5 Healed anyway", "28.0–30.3", "0.25", "6", "\"Stretch forth thine hand.\" Light flows into the curled hand, which opens and becomes strong; the man stares at it in joy.", "Close macro on the hand, then a quick reveal of his joy", "4, 8, 9, 20"),
    ("S6 The temple", "30.6–36.4", "afternoon · 0.32", "7", "Busy market wide; quick close-up of hands braiding cords; He drives out the sheep and oxen, tables flip, coins pour, cage doors open, doves fly, merchants jump back (nobody is hit). Label \"JOHN 2:15\".", "Big tracking shot through the chaos", "3, 7, 11, 15, 16, 17, 19, 26"),
    ("S7 Card", "36.7–40.2", "0.40", "8", "Cream card, John 2:16, \"MERCHANDISE\" in deep gold, floating over settling dust.", "Slow float", "19, 26"),
    ("S8 But notice", "41.0–46.8", "0.45", "9", "Freeze frame beside Jesus: \"ANGRY FOR: GOD'S HOUSE · HURTING PEOPLE\" on a red-gold tag, then \"ANGRY FOR HIMSELF:\" and a deep-gold \"NEVER\" stamp.", "Freeze + tiny push", "3, 19"),
    ("S9 When He was hurt", "47.1–52.5", "golden hour · 0.56", "10", "A crowd points and laughs; Jesus stands calm and quiet (no violence). Card 1 Peter 2:23 with \"REVILED NOT AGAIN\" in gold.", "Slow tilt from the crowd to His calm face", "4, 12, 19, 27"),
    ("S10 Forgive", "52.8–57.8", "late golden · 0.64", "11", "The cross on a far hill, the sun low behind it. Card Luke 23:34 with \"FORGIVE\" in gold.", "Long-lens, almost still", "21, 27"),
    ("S11 Split screen", "58.1–62.0", "0.72", "12", "Left: the table flip in a warm red tone, tag \"ANGRY FOR OTHERS\". Right: the distant cross in gold, tag \"FORGIVING FOR HIMSELF\".", "Split wipe", "3, 17, 19, 21, 28"),
    ("S12 The deadline", "62.3–70.4", "sunset · 0.75→0.86", "13", "Giant pull-back over the land; the sun touches the horizon on the word \"sun\". Full-screen card Ephesians 4:26 with \"SIN NOT\" and \"SUN\" in gold.", "Giant pull-back", "22, 23, 28"),
    ("S13 The reveal", "71.2–75.5", "0.86→0.90", "14", "Flashback grid: S1, S3, S6, S9 as small frames, each with its own sky (noon → afternoon → golden → sunset), a soft tick per frame. The sun icon reaches the end of its line.", "Grid pops in one by one", "re-uses S1/S3/S6/S9"),
    ("S14 Today", "76.1–79.6", "dusk · 0.90→1.00", "15 (first half)", "Modern room at dusk: a young adult with an unsent \"I forgive you\" message; thumb hovers, a deep breath, send — as the last sliver of sun disappears (the sun icon sinks below its line). Warm light fills the room.", "Slow push on the phone", "13, 14, 24, 29"),
    ("S15 Call to action", "79.6–81.5", "1.00", "15 (\"Just type today\")", "Dusk sky, first star with a bright note; a comment box types \"TODAY 🙏\" with floating hearts.", "Still, gentle drift", "29"),
    ("S16 End card + loop", "81.5–84.5", "—", "—", "Logo draws itself (slim gold cross + three motion lines), \"GRACE IN MOTION\", \"@GraceINMotion616\", \"Hard questions. Bible answers.\" Then a fresh sunrise flows into the noon temple of S1.", "—", "30 → 19, 25"),
]

out = []
w = out.append
w("# The Sunset Rule — script, voiceover, shot list and GPT Image prompts\n")
w("Idea 49 · mode **GPT IMAGE** · target length 70–85 s · voice: **recorded by you** from the 8 parts below.\n")
w("**Status:** Phase 1 (reference study) and Phase 2 (this file) are done. Waiting for your images and voice files, then type **DONE**.\n")
w("## A) Script\n")
w("No changes. The flow works, and every quote matches the KJV list word for word (Mark 3:5, John 2:16, 1 Peter 2:23, Luke 23:34, Ephesians 4:26). `*word*` = gold keyword on screen.\n")
w(SCRIPT + "\n")
w("## A2) Voiceover, in 8 parts\n")
w("Paste each part into your voice tool as one take. This is plain text with no asterisks; the keywords only turn gold in the captions. I cut each part into sentences and set the pauses myself: 0.3 s between sentences, 0.6 s after \"at the same time\", 0.8 s before \"But notice\" and \"Did you notice?\", and 0.6 s before the last line.\n")
for i, (name, lines, tone, text) in enumerate(PARTS, 1):
    w(f"**PART {i} — {name}** ({lines}) — *{tone}*\n")
    w("```\n" + text + "\n```\n")
w("**Recording tips**\n")
w("- Use the same voice and the same settings for all 8 parts: a calm, warm male storyteller.")
w("- Keep normal speed. All 8 parts together should come to about **72–78 s**.")
w("- Voice only: no music, no effects, no reverb. MP3 or WAV.")
w("- Name the files `part1` … `part8`. Re-record only the part that came out wrong.")
w("- Read \"an house\" exactly as written. It is the KJV wording.\n")
w("## B) Shot list\n")
w("Times are estimates for a pace of about 155 words per minute. The real times come from your voice files. *Sun* is `sunTime` from 0 (noon) to 1 (dusk). One sun sets through every scene, and the little sun icon under the captions slides with it. *Images* gives the numbers from list C.\n")
w("| Scene | Time (s) | Sun | Line | What we see | Camera | Images |")
w("|---|---|---|---|---|---|---|")
for s in SHOTS:
    w("| " + " | ".join(s) + " |")
w("")
w("## C) Images for ChatGPT\n")
w("**How to make them**\n")
w("1. Make **#1 `char_jesus_turnaround.png` first**. Every other Jesus image attaches it, so Jesus looks the same everywhere.")
w("2. Keep #1–#7 in **one** ChatGPT chat (the \"Jesus chat\"). Use a new chat for each other group (people, animals, props, backgrounds, skies).")
w("3. For each image: attach the files listed under **Attach**, then paste the whole prompt. Each prompt already starts with the STYLE BLOCK and ends with the size.")
w("4. Make **#25 `sky_noon.png`** before the other skies. #26–#30 are recolors of it, so all six skies line up and blend smoothly.")
w("5. **Download the original PNG.** Don't take screenshots: they lose the transparency and the sharpness. On a phone a transparent PNG can look white or black; that's normal.")
w("6. Redo an image if it has any text or labels, extra fingers, parts cut off at the edge, or a Jesus who looks different from #1.\n")
w("The style refs are in `episodes/sunset-rule/style_refs/`: **style_ref_1** = close-up, **style_ref_2** = wide market, **style_ref_3** = group.\n")
w("**STYLE BLOCK** (already at the start of every prompt)\n")
w("```\n" + STYLE + "\n```\n")
w("**CHARACTER BIBLE** (repeated word for word inside each prompt for that character)\n")
for d in (JESUS, MAN, WATCHERS, MERCHANTS, CROWD, MODERN):
    w("- " + d)
w("")
must = sum(1 for a in A if a[3] == "MUST")
w(f"**{len(A)} images: {must} MUST-HAVE and {len(A) - must} NICE-TO-HAVE.** I can work around any NICE one that's missing.\n")
for i, a in enumerate(A, 1):
    file, size, transp, prio, attach, used, _ = a
    w(f"### {i}. `{file}`")
    w(f"**Size** {size} · **Transparent** {transp} · **{prio}** · **Attach** {' + '.join(attach)} · **Used in** {used}\n")
    w("```\n" + prompt(a) + "\n```\n")
w("## D) Sending everything back\n")
w("- **Images:** upload the PNGs here in the chat in any order; I'll recognize each one and give it its exact file name. If you prefer GitHub, put them in `grace-reels/episodes/sunset-rule/assets/gpt/` on branch `ccr-dc602047-siqv7t` with the exact names above.")
w("- **Voice:** upload `part1` … `part8`.")
w("- Then type **DONE**. I'll check every image (Phase 3) and give you a short redo list only if something can't be fixed automatically.")

open(sys.argv[1], "w").write("\n".join(out) + "\n")
print("images:", len(A), "must:", must, "chars:", sum(len(x) for x in out))
