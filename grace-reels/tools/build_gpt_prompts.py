"""Builds episodes/not-an-apple/GPT_IMAGE_PROMPTS.md so the style block and
character bible are repeated word for word in every prompt."""
import pathlib

STYLE = ("Flat 2D paper-cut illustration in a warm cinematic storybook style. Clean dark brown outline (#3B2416) "
         "of even weight around every shape, expressive cartoon faces (almond eyes with a small white highlight, clear "
         "eyebrows, small expressive mouth), matte flat colors with one soft shadow tone per shape and a thin warm rim "
         "light on the lit edge, warm biblical palette (olive and sage green, ochre, terracotta, cream, soft gold, deep "
         "warm brown), cinematic lighting from a low warm sun, high detail but clean and readable on a phone screen, no "
         "text, no letters, no numbers, no watermark, no signature, no frame, no border.")
WORLD = ("The world is a warm low-poly diorama: faceted low-poly trees, hills and rocks with flat-shaded triangular "
         "facets, soft ambient-occlusion contact shadows, long soft shadows, light atmospheric haze, gentle tilt-shift depth.")
TRANSP = ("Transparent background (PNG with alpha), no ground, no floor, no cast shadow. If transparency is not "
          "possible: plain solid flat magenta background (#FF00FF), no shadow on the background.")
OPAQUE = "Full frame, opaque, no transparency."
MODEST = "Modest and family-friendly: the leaf garment always covers from the shoulders to the knees."
HANDS = "Correct hands with five fingers."
STYLE_ONLY = ("Match only the drawing style of the attached style image (outline weight, flat colors, shading, light); "
              "do not copy its people, clothes, snake or props.")

ADAM = ("Adam: a young, strong man with short dark curly hair, a short beard, warm olive-brown skin and a kind face, "
        "in a MODEST garment of large green leaves and vines covering him from shoulders to knees.")
EVE = ("Eve: a young woman with long dark wavy hair to her waist, warm brown skin, a small white flower in her hair "
       "and a bright, curious face, in a MODEST garment of large green leaves and soft vines from shoulders to knees.")
SNAKE = ("The serpent: a long, sleek, beautiful snake with emerald-green and gold scales, clever narrow eyes and a "
         "sly smile. Elegant, never gory or too scary for kids.")
FRUIT = "The fruit: NEVER an apple. A mysterious soft glowing fruit shape, mostly hidden in light."
JESUS = ("Jesus: a man of about thirty with shoulder-length dark brown wavy hair, a short dark beard, warm olive-brown "
         "skin and calm, kind dark eyes, in a simple cream linen robe with a brown wool mantle over one shoulder, a rope "
         "belt and leather sandals. Simple and dignified, no halo, no glow around the head.")
TEMPTER = ("The tempter: a tall faceless hooded shadow in a long cloak of deep charcoal-violet shadow, the hood opening "
           "completely dark and empty, long thin shadowy hands, no face, no eyes, no horns, no monster features, the hem "
           "softening into wisps of smoke.")
PAINTER = ("The painter: an old European painter, a kind elderly man with round cheeks, a white mustache and a dark red "
           "beret, in a cream linen smock with a few paint dabs, holding a wooden palette and a long thin brush.")
TEEN = ("The young person: a modern teenager of about seventeen with short curly black hair and warm brown skin, in an "
        "oversized mustard-yellow hoodie, grey sweatpants and white socks, holding a smartphone whose screen is a plain "
        "glowing pale-blue rectangle with nothing on it.")

def row(n, what):
    return (f"Layout: {n} separate {what} side by side in one row, same character, same scale, same outfit, evenly "
            "spaced with clear empty space between them (not touching, not overlapping), whole figure visible from head "
            "to feet, nothing cropped.")

PARTS_RULE = ("Each joint end is rounded and extends a little past the joint so the pieces overlap at the neck, "
              "shoulders, elbows, hips and knees. All pieces at the same scale as one standing figure, laid out flat "
              "with clear empty space between every piece (no piece touches another).")

# (file, size, transparent, priority, refs, body parts in order)
IMAGES = [
 ("char_adam_poses.png", "1536×1024", True, "MUST", ["style_refs/style_ref_02_characters.png", "style_refs/style_ref_01_eden_diorama.png"],
  [STYLE, "Character pose sheet.", ADAM, MODEST,
   "Four poses, all facing right in 3/4 view: (1) walking mid-stride, happy, arms swinging; (2) standing relaxed, arms "
   "loose, gentle smile, as if standing right beside someone; (3) eating: lifting a small soft ball of golden light to "
   "his mouth with one hand, eyes closed, no visible fruit inside the light; (4) ashamed: head down, shoulders hunched, "
   "one hand holding his other arm.", row(4, "full-body poses"), HANDS, STYLE_ONLY, TRANSP]),
 ("char_eve_poses.png", "1536×1024", True, "MUST", ["char_adam_poses.png", "style_refs/style_ref_02_characters.png"],
  [STYLE, "Character pose sheet.", EVE, MODEST,
   "Four poses, all facing right in 3/4 view: (1) walking happily mid-stride, long hair swinging behind her; (2) "
   "listening closely: leaning slightly forward, head tilted, eyes looking up toward the upper right, one hand resting "
   "at her chest; (3) unsure: eyebrows raised in the middle, a small frown, one finger touching her lower lip, weight "
   "shifted back; (4) reaching slowly: one arm stretched forward and up toward the upper right with fingers open, "
   "hesitant face.", row(4, "full-body poses"), HANDS,
   "Same drawing style, outline weight and skin shading as the attached Adam sheet. " + STYLE_ONLY, TRANSP]),
 ("char_eve_faces.png", "1536×1024", True, "MUST", ["char_eve_poses.png"],
  [STYLE, "Close-up expression sheet for a slow camera push-in.", EVE, MODEST,
   "Four head-and-shoulders busts of the same character side by side with clear space between them, all in 3/4 view "
   "facing right, shoulders covered by the leaf garment, big readable faces: (1) happy and curious, bright smile, eyes "
   "wide; (2) listening, lips slightly parted, eyebrows a little raised, eyes looking up to the upper right; (3) unsure, "
   "eyebrows raised in the middle, a small frown, eyes looking down to the left; (4) speaking, mouth open mid-word, "
   "earnest look.", "Exactly the same face, hair, flower and colors as the attached Eve sheet.", TRANSP]),
 ("char_eve_parts.png", "1536×1024", True, "MUST", ["char_eve_poses.png", "char_eve_faces.png"],
  [STYLE, "Cut-out animation parts sheet (puppet kit) for 2D bone rigging, 3/4 view facing right.", EVE, MODEST,
   "Pieces: head with neutral face (no back hair); the same head with eyes closed (blink); the same head with mouth "
   "open (speaking); a separate long wavy back-hair piece; torso with the leaf garment from shoulders to hips; a leaf "
   "skirt piece from hips to knees with a ragged leaf hem; left upper arm; right upper arm; left forearm with open hand; "
   "right forearm with relaxed hand; right forearm with cupped hand holding a small soft ball of golden light; left lower "
   "leg with foot; right lower leg with foot (the thighs are hidden under the leaf skirt); five loose single leaves of "
   "different sizes.", PARTS_RULE, HANDS, "Exactly the same face, hair and colors as the attached Eve images.", TRANSP]),
 ("char_adam_parts.png", "1536×1024", True, "NICE", ["char_adam_poses.png"],
  [STYLE, "Cut-out animation parts sheet (puppet kit) for 2D bone rigging, 3/4 view facing right.", ADAM, MODEST,
   "Pieces: head with neutral kind face (curly hair included); the same head chewing with eyes closed; the same head "
   "looking down, ashamed; the same head with eyes closed (blink); torso with the leaf garment from shoulders to hips; a "
   "leaf skirt piece from hips to knees with a ragged leaf hem; left upper arm; right upper arm; left forearm with open "
   "hand; right forearm with relaxed hand; right forearm with hand raised holding a small soft ball of golden light; "
   "left lower leg with foot; right lower leg with foot (the thighs are hidden under the leaf skirt); five loose single "
   "leaves of different sizes.", PARTS_RULE, HANDS, "Exactly the same face, hair and colors as the attached Adam sheet.", TRANSP]),
 ("char_adam_eve_together.png", "1536×1024", True, "MUST", ["char_adam_poses.png", "char_eve_poses.png"],
  [STYLE, "Two-character sheet showing two separate moments side by side with clear empty space between them.", ADAM, EVE, MODEST, FRUIT,
   "(LEFT) Adam and Eve standing close together side by side, Adam right next to Eve on her left; Eve turns toward him "
   "and gently places a small soft ball of golden light into his open hand; both faces curious and calm. (RIGHT) the "
   "same two, moments later, still side by side: both have just eaten, both look down with sad, ashamed faces, Adam's "
   "head lowered, Eve holding her arms. Equal size, both clearly together.",
   "The glowing ball hides any fruit shape: no stem, no leaf, not red, not an apple.",
   "Whole figures visible from head to feet, nothing cropped.", HANDS,
   "Exactly the same faces, hair and colors as the attached Adam and Eve sheets.", TRANSP]),
 ("char_snake.png", "1536×1024", True, "MUST", ["char_eve_poses.png", "style_refs/style_ref_02_characters.png"],
  [STYLE, "Character pose sheet.", SNAKE,
   "Two poses side by side with clear empty space between them: (1) resting in a long lazy S-curve as if draped along a "
   "horizontal branch (do not draw the branch), head raised and facing left, sly closed-mouth smile; (2) leaning "
   "forward and down to the left, head tilted, whispering with the mouth slightly open, no fangs, a tiny forked tongue "
   "tip. Smooth diamond scale pattern, gold belly, emerald back.",
   "Same outline weight as the attached Eve sheet. " + STYLE_ONLY, TRANSP]),
 ("char_snake_parts.png", "1536×1024", True, "MUST", ["char_snake.png"],
  [STYLE, "Cut-out animation parts sheet for a spline-rigged snake, side view facing left.", SNAKE,
   "Pieces: eight separate body segments laid out in two rows, each a short, slightly curved tube with rounded ends "
   "that would overlap the next one, thickness decreasing from the neck segment (thickest) to the tail segment "
   "(thinnest); a head with the mouth closed and a sly smile; a head with the mouth slightly open (no fangs, a tiny "
   "forked tongue); a pointed tail tip. The scale pattern continues across the segments. Same scale for all pieces, "
   "clear empty space between every piece.", "Exactly the same snake as the attached sheet.", TRANSP]),
 ("char_jesus.png", "1536×1024", True, "MUST*", ["style_refs/style_ref_03_dusk_light.png", "char_adam_poses.png", "(or your own never-died Jesus image)"],
  [STYLE, "Character pose sheet.", JESUS,
   "Two separate full-body poses side by side with clear empty space between them, both facing right in 3/4 view, warm "
   "dusk light from the left: (1) sitting tired on a low flat desert rock (draw the rock), shoulders low, hands resting "
   "on his knees, eyes half closed but calm, hungry after forty days; (2) standing tall and strong, calm face, looking "
   "straight ahead to the right, one hand slightly raised and open as he speaks with quiet strength.",
   "A little dust on the robe hem.", HANDS, "Same drawing style as the attached Adam sheet. " + STYLE_ONLY, TRANSP]),
 ("char_tempter.png", "1536×1024", True, "MUST", ["char_jesus.png", "style_refs/style_ref_03_dusk_light.png"],
  [STYLE, "Character pose sheet.", TEMPTER,
   "Two separate full-body poses side by side with clear empty space between them, both facing left: (1) leaning in "
   "toward the left, tall and looming, one long thin shadowy hand pointing down at the ground; (2) backing away to the "
   "right, leaning back, the cloak edges dissolving into soft smoke wisps, as if fading. Subtle violet edge light, "
   "mysterious but safe for children.", "Same scale as the attached Jesus sheet.", TRANSP]),
 ("char_painter.png", "1024×1536", True, "MUST", ["char_adam_poses.png"],
  [STYLE, "Single full-body character.", PAINTER,
   "3/4 view facing right, standing as if at an easel (do not draw the easel): brush raised toward the right as if "
   "painting a canvas, palette in his left hand with dabs of red, green and gold paint, focused happy face with lifted "
   "eyebrows, warm candlelight from the right. Whole figure visible from head to feet.", HANDS,
   "Same drawing style as the attached Adam sheet.", TRANSP]),
 ("char_teen_phone.png", "1536×1024", True, "MUST", ["char_adam_poses.png"],
  [STYLE, "Character pose sheet.", TEEN,
   "Two separate poses side by side with clear empty space between them, both sitting cross-legged as if on a bed (do "
   "not draw the bed), seen from the front at a slight angle, at night, face lit cool blue by the phone: (1) relaxed, "
   "thumb scrolling, slight smile; (2) thumb paused, eyebrows pulled together, leaning closer to the phone, unsure.",
   HANDS, "Same drawing style as the attached Adam sheet.", TRANSP]),
 ("prop_apple.png", "1024×1536", True, "MUST", ["style_refs/style_ref_02_characters.png"],
  [STYLE, "Prop.",
   "A single perfect shiny red apple with one bite taken out of its right side showing cream-white flesh, a short brown "
   "stem with one green leaf, 3/4 view, a large glossy highlight, a warm golden rim light on the left edge and a faint "
   "cool rim on the right, the apple filling most of the width, centered.", STYLE_ONLY, TRANSP]),
 ("prop_fruits.png", "1536×1024", True, "MUST", ["char_adam_poses.png"],
  [STYLE, "Prop sheet.",
   "Three separate items side by side with clear empty space between them, same scale, each sized to sit on a playing "
   "card: (1) a ripe purple fig with one small fig leaf; (2) a bunch of plump purple grapes with a curly vine tendril "
   "and one grape leaf; (3) a small bundle of golden wheat stalks tied with twine. No apple.",
   "Same outline and lighting as the attached image; do not draw any person.", TRANSP]),
 ("prop_bible_open.png", "1536×1024", True, "MUST", ["char_adam_poses.png"],
  [STYLE, "Prop.",
   "An old leather-bound Bible lying open, seen from directly above (top-down), a worn dark brown leather cover with "
   "gold-tooled edges, thick cream pages with a gentle curl at the center fold, a red ribbon bookmark across the right "
   "page. The pages are completely blank: no writing, no lines, no letters, no symbols.",
   "Same outline and lighting as the attached image; do not draw any person.", TRANSP]),
 ("prop_painting_easel.png", "1024×1536", True, "MUST", ["char_adam_poses.png", "char_eve_poses.png", "prop_apple.png"],
  [STYLE, "Prop.", ADAM, EVE, MODEST,
   "A wooden artist's easel in 3/4 view holding a canvas in an ornate gold frame. On the canvas: an old European "
   "Renaissance-style painting with darker, varnished colors showing Adam and Eve standing under a tree, Eve holding up "
   "a shiny red apple like the attached one. Both are fully clothed in their modest leaf garments from shoulders to knees. "
   "This painting is the only place an apple appears with them.", TRANSP]),
 ("bg_eden_far.png", "1024×1536", False, "MUST", ["style_refs/style_ref_01_eden_diorama.png"],
  [STYLE, WORLD, "Background, far layer for parallax.",
   "A soft morning sky from pale gold at the horizon to soft blue at the top with a few soft clouds, distant low-poly "
   "rolling green hills, a winding river catching the sunlight in the middle distance, tiny far trees, soft morning "
   "haze; the bottom quarter is soft green meadow. No people, no animals, no fruit.", STYLE_ONLY, OPAQUE]),
 ("bg_eden_mid.png", "1024×1536", True, "MUST", ["bg_eden_far.png"],
  [STYLE, WORLD, "Middle layer for parallax.",
   "A lush meadow strip filling the bottom 45% of the image: low-poly trees, two palms, flowering bushes, a river bend "
   "with small rocks, two sheep, a small deer, two rabbits and a few butterflies, all small; morning light from the "
   "left. The top 55% is completely empty and transparent. No people, no fruit on the trees.",
   "Same colors and light as the attached far layer.", TRANSP]),
 ("bg_eden_tree.png", "1024×1536", True, "MUST", ["bg_eden_far.png"],
  [STYLE, WORLD, "The special tree in the middle of the garden, close-up.",
   "A large, beautiful low-poly tree with a thick twisting trunk, a wide faceted canopy and one long, low, curving "
   "branch reaching out to the left (a snake will lie on it), a warm golden glow hidden deep inside the leaves at the "
   "center. NO fruit visible anywhere: no apples, no round fruit shapes. Grass and small white flowers at its base.",
   "Same colors and light as the attached far layer.", TRANSP]),
 ("fg_leaves_near.png", "1536×1024", True, "NICE", ["bg_eden_far.png"],
  [STYLE, "Foreground framing layer for parallax.",
   "Large palm fronds and broad green leaves entering from the left and right edges and the bottom corners, darker and "
   "slightly soft as if very close to the camera; the whole center is empty and transparent.",
   "Same greens as the attached far layer.", TRANSP]),
 ("bg_studio.png", "1024×1536", False, "MUST", ["char_painter.png"],
  [STYLE, "Background.",
   "An old European painter's studio at night in candlelight: heavy wooden beams, a tall arched window with a deep blue "
   "night sky, shelves with jars and brushes, rolled canvases leaning on the wall, a wooden table on the left with three "
   "lit candles, warm orange candlelight and deep brown shadows. Leave the center and right of the floor open and empty "
   "for an easel and the painter. No people, no paintings with faces.", "Same light as the attached painter.", OPAQUE]),
 ("bg_desert_far.png", "1024×1536", False, "MUST", ["style_refs/style_ref_03_dusk_light.png"],
  [STYLE, WORLD, "Background, far layer.",
   "The Judean wilderness at dusk long ago: a low horizon, the sky from deep rose and violet at the top to warm "
   "orange-gold at the horizon, a low setting sun, layered low-poly sand-colored hills and rocky cliffs fading into haze, "
   "empty, quiet and vast, a few dry shrubs. No people.", STYLE_ONLY, OPAQUE]),
 ("bg_desert_near.png", "1536×1024", True, "NICE", ["bg_desert_far.png"],
  [STYLE, WORLD, "Near ground layer for parallax.",
   "A strip of rocky desert ground across the bottom 40% with scattered rounded stones of different sizes (some shaped "
   "like small round loaves), a few dry shrubs and pebbles, warm dusk side light from the left. The top 60% is "
   "completely empty and transparent.", "Same colors and light as the attached far layer.", TRANSP]),
 ("bg_bedroom_night.png", "1024×1536", False, "MUST", ["char_teen_phone.png"],
  [STYLE, "Background.",
   "A cozy modern teenage bedroom at night, mostly dark: a bed with a rumpled blanket in the lower center, seen from the "
   "front at a slight angle, with an empty space on it for a sitting person; a window with a deep blue night sky and soft "
   "city lights; string lights; a desk with a closed laptop; wall posters as simple color shapes only; cool blue "
   "moonlight from the window and a tiny warm lamp glow. No people, no text on anything.",
   "Same drawing style as the attached character.", OPAQUE]),
]

def ref_name(r):
    return r if r.startswith(("style_refs/", "(")) else "assets/gpt/" + r

def main():
    root = pathlib.Path(__file__).resolve().parent.parent / "episodes" / "not-an-apple"
    out = ["# GPT Image prompts — It Wasn't an Apple", "",
           "Generated by `tools/build_gpt_prompts.py` (edit the script, not this file).", "",
           "## How to use", "",
           "1. Make them **in order**: each prompt names the earlier images to attach, so the characters stay the same.",
           "2. Ask for the exact size. For `Transparent: yes`, ask for a transparent background; if it comes back with a "
           "background, regenerate or use the magenta fallback in the prompt (I key it out).",
           "3. Name each file exactly as listed and put it in `episodes/not-an-apple/assets/gpt/` (or just upload them in the chat; I'll file them).",
           "4. If a face or outfit drifts, regenerate with the same attachments and add: \"same character, same outfit, same colors\".",
           "",
           "`MUST*` = skip it if you have your never-died Jesus images (upload them instead).", "",
           "Made in code (no image needed): the glowing fruit, the magnifying glass, all Bible text, fruit cards, phone UI and notification, red X, stamps, gold dust, WORD CHECK, captions, labels, cards, end card.", "",
           "## Checklist", "",
           "| # | File | Size | Transparent | Priority | Attach |", "|---|---|---|---|---|---|"]
    for i, (f, size, tr, pri, refs, _) in enumerate(IMAGES, 1):
        out.append(f"| {i:02d} | `{f}` | {size} | {'yes' if tr else 'no'} | {pri} | {', '.join('`'+ref_name(r)+'`' if not r.startswith('(') else r for r in refs)} |")
    out += ["", "## Character bible (repeated word for word inside the prompts)", ""]
    out += [f"- {x}" for x in (ADAM, EVE, SNAKE, FRUIT, JESUS, TEMPTER, PAINTER, TEEN)]
    out += ["", "## Prompts", ""]
    for i, (f, size, tr, pri, refs, body) in enumerate(IMAGES, 1):
        out += [f"### {i:02d}. `{f}` — {size} · transparent: {'yes' if tr else 'no'} · {pri}", "",
                "Attach: " + ", ".join('`'+ref_name(r)+'`' if not r.startswith('(') else r for r in refs), "",
                "```text", " ".join(body), "```", ""]
    (root / "GPT_IMAGE_PROMPTS.md").write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {len(IMAGES)} prompts")

if __name__ == "__main__":
    main()
