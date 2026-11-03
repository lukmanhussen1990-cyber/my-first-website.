"""Shot plan for the Gardyloo reel -> prompts.md (for ChatGPT / Kling) and shots.json (for the final build).

Same method as wedding_reel/plan.py and bear_reel/plan.py: every shot starts 0.12 s before its first voice word
(a cut just ahead of the word), so the shots fill the whole voiceover with no gaps. Caption chunks are 2-4
words and start on the first word they show. Shots inside a long pause start at "after" = (line, seconds after
that line ends).
Run:  python3 plan.py      (needs audio/voiceover.words.json + audio/vo_lines.json from make_voiceover.py)
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))
WORDS = json.load(open(os.path.join(HERE, "audio", "voiceover.words.json")))
FPS = 30
END = round(VO["duration"] * FPS) / FPS          # video length = voiceover length (frame-rounded)
LEAD = 0.12                                       # cut this much before the line's first word

STYLE = ("STYLE: low-poly blocky 3D video game render, PS1 / Roblox look. Chunky faceted shapes with visible "
         "flat polygons, slightly pixelated low-resolution textures (pixel noise on hair, clothes, wood, tiles "
         "and walls). Characters have realistic proportions with simple blocky heads, small black square dot "
         "eyes, short block eyebrows and a tiny simple mouth. Soft realistic lighting with soft shadows, gentle "
         "depth of field. Silly and funny, never gross, everyone fully dressed.")
ENDING = "Vertical portrait image, subject in the center, no text."   # every shot prompt ends with this

CAST = {
    "YOU": ("YOU (same as the character sheet): a young man in his mid-twenties, light-brown skin, neat short "
            "black hair combed to the side, clean-shaven, a crisp light-blue button-up shirt tucked into dark-grey "
            "trousers, brown belt, brown shoes (dressed up to impress), polite nervous face."),
    "GF": ("GIRLFRIEND (same as the character sheet): a young woman, friendly, dark-brown hair in a high "
           "ponytail, a cosy cream knit sweater, blue jeans, big warm smile."),
    "DAD": ("HER DAD (same as the character sheet): a big, tall, broad man in his fifties, short grey hair, a "
            "thick black mustache, very serious face, a dark charcoal pinstripe business suit, white shirt, navy "
            "tie, a black leather briefcase."),
    "DAD_DINNER": ("HER DAD AT DINNER (same as the character sheet): the same big man with the thick black "
                   "mustache, but his grey hair is soaking wet and messy (fresh from a shower), a white towel "
                   "around his neck over a plain grey polo shirt, very serious face."),
    "MOM": ("HER MOM (same as the character sheet): a kind woman in her fifties, short wavy brown hair, round "
            "glasses, a flowery blouse with a red apron."),
    "BRO": ("LITTLE BROTHER (same as the character sheet): a small boy about seven years old, messy hair, a "
            "red-and-white striped t-shirt, big curious eyes."),
}
HOUSE = ("PLACE: a cosy two-storey family house with warm yellow walls and white window frames, a red front door "
         "with a little porch light and flower pots, a short driveway with a dark-blue car, and one small "
         "bathroom window on the upper floor right above the driveway. Golden evening light.")
BATH = ("PLACE: a small cosy bathroom: mint-green square tiles, a white toilet with a chrome flush button on top "
        "of the tank, a fluffy yellow towel, a small square window with a white frame high on the wall, a framed "
        "family photo on the wall.")
DINING = ("PLACE: a cosy dining room at night: a wooden table with a white tablecloth, plates of spaghetti, "
          "glasses of water, a round wall clock, warm yellow lamp light.")
OLD = ("PLACE: old Edinburgh hundreds of years ago: a narrow cobblestone street between tall, crooked grey stone "
       "houses with small wooden windows and shutters, the castle on its rock in the distance. Warm sepia "
       "old-photo colours, like an old film.")

CHAR_SHEET = (
    "CHARACTER SHEET. Low-poly blocky 3D video game render, PS1 / Roblox look: chunky faceted shapes with "
    "visible flat polygons, slightly pixelated low-resolution textures (pixel noise on hair and clothes), "
    "realistic proportions with simple blocky heads, small black square dot eyes, short block eyebrows and a "
    "tiny simple mouth. Soft realistic lighting with soft shadows. Silly and funny, everyone fully dressed.\n\n"
    "Character lineup on a plain light grey background, wide landscape image, everyone standing in one row, "
    "front view, full body, no text, no labels, no numbers.\n\n"
    "From left to right:\n"
    "1. \"YOU\": a young man in his mid-twenties, light-brown skin, neat short black hair combed to the side, "
    "clean-shaven, crisp light-blue button-up shirt tucked into dark-grey trousers, brown belt, brown shoes, "
    "holding a bouquet of flowers. Polite nervous smile.\n"
    "2. \"GIRLFRIEND\": a young woman, dark-brown hair in a high ponytail, cosy cream knit sweater, blue jeans, "
    "white sneakers. Big warm smile, waving.\n"
    "3. \"HER DAD\": a big, tall, broad man in his fifties (a head taller than everyone), short grey hair, a "
    "thick black mustache, very serious face, dark charcoal pinstripe business suit, white shirt, navy tie, "
    "holding a black leather briefcase.\n"
    "4. \"HER DAD AT DINNER\": the same big man, but with soaking-wet messy grey hair, a white towel around his "
    "neck over a plain grey polo shirt and dark trousers. Very serious face, one eyebrow up.\n"
    "5. \"HER MOM\": a kind woman in her fifties, short wavy brown hair, round glasses, flowery blouse with a "
    "red apron. Friendly smile.\n"
    "6. \"LITTLE BROTHER\": a small boy about seven years old, messy hair, red-and-white striped t-shirt, "
    "shorts, big curious eyes.\n\n"
    "Below the row, a close-up of YOU's head and shoulders, front view, with a nervous smile and one small "
    "sweat drop.")

# Caption chunks per voice line (2-4 words, exact script words; trailing , . : are dropped on screen)
CHUNKS = {
    1: ["You're at", "your girlfriend's house."], 2: ["For the first time."], 3: ["You go", "to the bathroom."],
    4: ["You poop."], 5: ["You flush."], 6: ["Nothing."], 7: ["You flush again."], 8: ["Nothing."],
    9: ["The water is rising."], 10: ["You panic."], 11: ["Then you see it."], 12: ["A window."],
    13: ["You wrap it", "in toilet paper."], 14: ["Like a little gift."], 15: ["You even", "add a bow."],
    16: ["You open the window."], 17: ["And you throw it."], 18: ["As far", "as you can."],
    19: ["Then you hear it."], 20: ["Splat."], 21: ["And a scream."], 22: ["You look down."],
    23: ["It's her dad."], 24: ["He just got home", "from work."], 25: ["It's on his shoulder."],
    26: ["His best suit."], 27: ["He slowly looks up."], 28: ["You duck."], 29: ["What you don't know:"],
    30: ["hundreds of years ago", "in Edinburgh,"],
    31: ["people threw", "their poop", "out the window", "and shouted", "\"Gardyloo!\"", "to warn",
         "the people below."],
    32: ["You didn't", "shout anything."], 33: ["Dinner time."], 34: ["Her dad sits", "across from you."],
    35: ["His hair", "is still wet."], 36: ["He says:"], 37: ["\"Strange thing", "happened today.\""],
    38: ["He stares at you."], 39: ["You stare back."], 40: ["And you whisper:"], 41: ["…Gardyloo?"],
}

# One entry per shot. "start" = (line, word index in that line) where the shot's voice starts;
# "after" = (line, seconds after that line's last word) for shots inside a pause.
SHOTS = [
    dict(start=(1, 0), size="wide", key=False, cast=["YOU", "GF"], place=HOUSE,
         scene="Wide shot of the cosy yellow family house in golden evening light. YOU stands on the little "
               "porch at the red front door, holding a big colourful bouquet of flowers with both hands in front "
               "of his chest, back straight, nervous smile. The front door is open and the GIRLFRIEND leans out "
               "of the doorway, smiling big and waving him in with one hand. Porch light on, flower pots, the "
               "driveway with a dark-blue car on the side.",
         effect="Slow push-in toward the door. Tiny sparkle on the flowers.",
         sound="Doorbell ding-dong at the start, soft happy evening birds."),
    dict(start=(2, 0), size="close-up", key=False, cast=["YOU"], place=HOUSE,
         scene="Close-up, shoulders up: YOU standing at the open front door, holding the bouquet of flowers up "
               "near his chin, a very nervous stiff smile, eyebrows up, one small sweat drop on his forehead. Warm "
               "light from the hallway on his face. His face is a little above the middle of the image.",
         effect="Slow push-in, one blue sweat drop slides down.",
         sound="Soft nervous gulp."),
    dict(start=(3, 0), size="medium", key=False, cast=["YOU", "GF"], place=None,
         scene="Medium shot in the upstairs hallway of the house: the GIRLFRIEND smiles and points to a white "
               "bathroom door that is open a little; YOU walks toward it with polite small steps, still holding "
               "the bouquet, giving a thumbs-up. Family photos on the hallway wall, soft warm light.",
         effect="Slow sideways pan following him to the door.",
         sound="Footsteps on wood, door creak."),
    dict(start=(4, 0), size="medium close-up", key=False, cast=["YOU", "DAD"], place=BATH,
         scene="Medium close-up, chest up: YOU inside the small mint-green bathroom (only his upper body is seen, "
               "fully dressed), eyes closed, a happy, relieved little smile. On the wall right behind him hangs a "
               "framed photo of HER DAD (the big serious man with the thick mustache) staring straight at the "
               "camera. His face is a little above the middle of the image.",
         effect="Punch-in on \"poop\", little green wavy stink lines rise from the bottom of the frame.",
         sound="A tiny relieved sigh."),
    dict(start=(5, 0), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of one finger pressing the round chrome flush button on top of a white toilet "
               "tank. The light-blue shirt cuff is visible on the wrist. Mint-green tiles behind, soft light.",
         effect="Quick punch-in as the button goes down.",
         sound="Flush button CLICK."),
    dict(start=(6, 0), size="close-up", key=False, cast=[], place=BATH,
         scene="Close-up looking down into a clean white toilet bowl with the seat up: the water is completely "
               "still and calm, nothing happens. Mint-green tiles around. Nothing else in the bowl, just clear "
               "water.",
         effect="Freeze, tiny zoom. A little \"...\" pause feel.",
         sound="Silence, one tiny drip."),
    dict(start=(7, 0), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of the same chrome flush button being pressed hard with a thumb, the thumb bent "
               "with effort, the white tank shaking a little. Shirt cuff visible.",
         effect="Two fast punch-ins (click click), small shake.",
         sound="CLICK-CLICK, then a weak sad gurgle."),
    dict(start=(8, 0), size="close-up", key=False, cast=["YOU"], place=BATH,
         scene="Close-up of YOU looking down at the toilet (off screen) with a completely blank, deadpan face, "
               "eyes half closed, mouth a flat line. One sweat drop on his temple. Mint-green tiles behind. His "
               "face is a little above the middle of the image.",
         effect="Static and deadpan, one sweat drop slides down his temple.",
         sound="Silence."),
    dict(start=(9, 0), size="close-up", key=True, cast=[], place=BATH,
         scene="Close-up from the side of the white toilet bowl: clear water rising up close to the rim, small "
               "bubbles on top, the water almost spilling over. Clean, nothing else in the water. Mint-green "
               "tiles, slightly darker dramatic light.",
         effect="Slow push-in, slight shake that grows.",
         sound="Deep slow water GURGLE rising.",
         kling="The clear water in the toilet bowl slowly rises toward the rim with small bubbles. Slow push-in. "
               "Keep the low-poly style."),
    dict(start=(10, 0), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of YOU's face in panic: eyes very wide, eyebrows pulled up, mouth stretched in a "
               "scared grimace, several sweat drops, eyes looking to the side. Mint-green tiles behind. His face "
               "fills the upper half of the image.",
         effect="Shake, eyes dart left-right (small pans), sweat drops fly.",
         sound="Fast heartbeat."),
    dict(start=(11, 0), size="medium close-up", key=False, cast=["YOU"], place=BATH,
         scene="Medium close-up of YOU in the bathroom turning his head up slowly, mouth open in awe: a beam of "
               "warm golden light falls across his face from a window above (off screen). Dust sparkles in the "
               "light beam. His face is a little above the middle of the image.",
         effect="Slow push-in, light gets brighter.",
         sound="Heartbeat stops. A soft rising \"ooo\"."),
    dict(start=(12, 0), size="close-up (slow zoom)", key=True, cast=[], place=BATH,
         scene="The small square bathroom window with a white frame, high on a mint-green tiled wall, glowing "
               "with heavenly golden light, bright god-rays shining in through it, a little white curtain "
               "floating. It looks like a holy sign.",
         effect="Dramatic slow zoom in, glow pulses.",
         sound="Heavenly choir \"aaaah\".",
         kling="Golden god-rays shine through the small bathroom window, the little curtain floats gently, dust "
               "sparkles drift. Slow zoom in. Keep the low-poly style."),
    dict(start=(13, 0), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of YOU's two hands carefully wrapping a small round bundle in white toilet "
               "paper, like wrapping a present. Only the white paper bundle is visible (clean, neat), a toilet "
               "paper roll unrolling next to it. Shirt cuffs visible. Soft bathroom light.",
         effect="Small careful hand movements (gentle shake), slow push-in.",
         sound="Paper rustling, toilet roll spinning."),
    dict(start=(14, 0), size="close-up", key=False, cast=["YOU"], place=BATH,
         scene="Close-up: YOU holding up a neat little white toilet-paper bundle in both palms like a precious "
               "gift, proud gentle face looking at it. Warm soft light, the bundle glows a little. His face is in "
               "the upper half, the bundle in the middle.",
         effect="Sparkle on the bundle, gentle push-in.",
         sound="Tiny magic twinkle."),
    dict(start=(15, 0), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of fingers tying a tiny pink ribbon bow on top of the small white toilet-paper "
               "bundle, very carefully, pinky finger up. Soft light.",
         effect="Punch-in on \"bow\", a little sparkle.",
         sound="Ribbon swish + cute \"ding\"."),
    dict(start=(16, 0), size="medium", key=False, cast=["YOU"], place=HOUSE,
         scene="Medium shot from outside the house looking in: YOU opening the small bathroom window from the "
               "inside, his head and shoulders in the window frame, holding the little white bundle with the pink "
               "bow in one hand, cool evening breeze blowing the little curtain. Evening sky reflected on the "
               "glass, yellow house wall around the window.",
         effect="Slow push-in.",
         sound="Window squeak, evening wind."),
    dict(start=(17, 0), size="medium (slow motion)", key=True, cast=["YOU"], place=BATH,
         scene="Medium shot inside the bathroom: YOU winding up like a baseball pitcher next to the open window, "
               "one knee raised high, arm pulled far back holding the small white bundle with the pink bow, "
               "serious focused face, tongue out a little. Dramatic side light.",
         effect="Slow motion, slow push-in, tiny freeze before the throw.",
         sound="Slow-motion whoosh build-up.",
         kling="In slow motion the young man winds up like a baseball pitcher and throws the small white bundle "
               "out of the open window. Keep the low-poly style."),
    dict(start=(18, 0), size="wide", key=True, cast=[], place=HOUSE,
         scene="Wide shot of the evening sky above the neighbourhood: the small white toilet-paper bundle with "
               "the pink bow flying in a big high arc across the orange-pink sunset sky, spinning, with the "
               "yellow house and its little open bathroom window at the bottom left. Rooftops and trees below.",
         effect="Bundle spins along the arc, camera follows the arc (pan up then down).",
         sound="Big WHOOSH, then a long falling whistle.",
         kling="The small white bundle spins and flies in a big arc across the sunset sky, then starts falling. "
               "Camera follows it. Keep the low-poly style."),
    dict(start=(19, 0), size="close-up", key=False, cast=["YOU"], place=HOUSE,
         scene="Close-up of YOU leaning out of the small bathroom window, one hand shading his eyes like a "
               "sailor, proud little smile, looking far into the distance. Yellow house wall and the white window "
               "frame around him, sunset light on his face. His face is a little above the middle of the image.",
         effect="Slow push-in; on \"hear\" his smile freezes (small punch-in).",
         sound="Falling whistle fades away... silence."),
    dict(start=(20, 0), size="black screen", key=False, cast=[], place=None,
         scene="(No image needed: the screen is completely black for \"Splat.\" and \"And a scream.\")",
         effect="Hard cut to black.",
         sound="Wet cartoon SPLAT, then a man's SCREAM from outside.", black=True),
    dict(start=(22, 0), size="high-angle POV", key=False, cast=["DAD"], place=HOUSE,
         scene="High-angle view looking straight down from the small bathroom window: the driveway far below, "
               "the dark-blue car with its door open, and HER DAD standing frozen next to it, small and seen from "
               "above, holding his briefcase, looking at his own shoulder. The bottom of the white window frame "
               "and the yellow wall are at the bottom of the image.",
         effect="Slow zoom down toward him.",
         sound="Wind, a car engine ticking as it cools."),
    dict(start=(23, 0), size="full shot (tall, tilt up)", key=False, cast=["DAD"], place=HOUSE,
         scene="Full-body shot of HER DAD standing frozen in the driveway next to his dark-blue car (door still "
               "open), black leather briefcase in one hand, car keys in the other, stiff as a statue. On his left "
               "shoulder sits the small white toilet-paper bundle with the pink bow. Very serious face. Evening "
               "light. The whole man from shoes to head, standing in the center.",
         effect="Slow tilt up from his shiny shoes and briefcase to his face (pan up the image).",
         sound="Tense low string note."),
    dict(start=(25, 0), size="extreme close-up", key=False, cast=["DAD"], place=HOUSE,
         scene="Extreme close-up of the shoulder of a dark charcoal pinstripe suit jacket: the small white "
               "toilet-paper bundle with the pink bow sitting on top of the shoulder, and next to it one small "
               "brown cartoon smudge on the fabric (a simple cartoon blob shape, not realistic). A fancy silk "
               "pocket square and the navy tie are visible at the edge.",
         effect="Green wavy stink lines rise from the smudge. Push-in to the smudge on \"best suit\".",
         sound="Sad trombone \"wah\" (quiet)."),
    dict(start=(27, 0), size="low-angle close-up", key=True, cast=["DAD"], place=HOUSE,
         scene="Low-angle close-up from below: HER DAD in the driveway slowly lifting his head to look up at the "
               "house, very serious face, one eyebrow down, mustache stiff, the small white bundle still on his "
               "shoulder. Above him the yellow house wall and the little open bathroom window at the top of the "
               "image, evening sky.",
         effect="Very slow push-in.",
         sound="Low tense drone, a crow caws once.",
         kling="The big serious man slowly tilts his head up and stares up at the bathroom window above him. "
               "Keep the low-poly style."),
    dict(start=(28, 0), size="medium", key=False, cast=["YOU"], place=BATH,
         scene="Medium shot inside the bathroom: YOU ducked down under the window, sitting on the floor with his "
               "back pressed flat against the mint-green tiled wall, knees up, eyes very wide, both hands over "
               "his mouth. The open window above his head shows the evening sky.",
         effect="Fast drop (whip down) with a small shake.",
         sound="Ducking THUD."),
    dict(start=(29, 0), size="wide (old film)", key=False, cast=[], place=OLD,
         scene="Wide shot of old Edinburgh hundreds of years ago in warm sepia old-film colours: a steep narrow "
               "cobblestone street between tall crooked grey stone houses, laundry hanging between the windows, "
               "people in old-fashioned clothes walking below, the castle on its rock far away at the top of the "
               "street. Film scratches and dust.",
         effect="Old film filter (sepia, grain, scratches, flicker), slow pan up the street.",
         sound="Old medieval lute / flute music starts (quiet)."),
    dict(start=(31, 0), size="medium (old film)", key=False, cast=[], place=OLD,
         scene="Medium shot in sepia old-film colours: a woman in old-fashioned clothes (a white bonnet, a "
               "brown shawl) leaning out of an upstairs wooden window of a tall stone house, holding a wooden "
               "bucket and tipping it out over the street. Nothing is seen coming out, only the bucket tipping. "
               "Stone wall and shutters around her.",
         effect="Old film filter, bucket tip motion lines.",
         sound="Medieval music continues, a bucket swoosh."),
    dict(start=(31, 7), size="close-up (old film)", key=False, cast=[], place=OLD,
         scene="Close-up in sepia old-film colours: the same woman in the white bonnet at the wooden window, one "
               "hand cupped beside her mouth, shouting a warning down to the street with a big open mouth.",
         effect="Old film filter, punch-in on \"Gardyloo\", small shake.",
         sound="Medieval music, a short horn toot."),
    dict(start=(31, 10), size="wide (old film)", key=False, cast=[], place=OLD,
         scene="Wide shot in sepia old-film colours of the narrow cobblestone street below: several people in "
               "old-fashioned clothes running away in all directions, holding their hats down on their heads, "
               "one man jumping out of the way, a chicken flapping. Funny, silly panic.",
         effect="Old film filter, fast jittery old-film motion, speed lines.",
         sound="Medieval music speeds up, people yelling \"aah\"."),
    dict(start=(32, 0), size="close-up", key=False, cast=["YOU"], place=BATH,
         scene="Close-up of YOU (normal colours again) still sitting on the bathroom floor under the window, a "
               "guilty face: eyes sliding to the side, lips pressed together, eyebrows up, one sweat drop. "
               "Mint-green tiles behind. His face is a little above the middle of the image.",
         effect="Hard cut out of the sepia, slow push-in, sweat drop.",
         sound="Music stops with a record scratch."),
    dict(start=(33, 0), size="wide → medium (push-in)", key=False, cast=["YOU", "GF", "DAD_DINNER", "MOM", "BRO"],
         place=DINING,
         scene="Wide shot of the family dinner table at night from the end of the table: on the left side YOU "
               "(very stiff, back straight) and the GIRLFRIEND smiling next to him; on the right side the MOM "
               "serving spaghetti and the LITTLE BROTHER with a fork in his fist; and at the far end, directly "
               "facing YOU, HER DAD AT DINNER with wet messy hair and a white towel around his neck, sitting very "
               "straight, staring. Plates of spaghetti, glasses, a round wall clock on the wall behind the dad.",
         effect="Slow push-in toward the dad.",
         sound="Cutlery clinks, soft room tone, the clock ticking (quiet)."),
    dict(start=(35, 0), size="close-up", key=False, cast=["DAD_DINNER"], place=DINING,
         scene="Close-up of HER DAD AT DINNER: soaking-wet messy grey hair, one big water drop falling from a lock "
               "of hair, the white towel around his neck, very serious face, thick mustache. Warm lamp light. His "
               "face is a little above the middle of the image.",
         effect="Slow push-in, a water drip falls.",
         sound="One loud water DRIP, clock tick."),
    dict(start=(36, 0), size="slow push-in to close-up", key=True, cast=["DAD_DINNER"], place=DINING,
         scene="Medium close-up of HER DAD AT DINNER across the table, dead serious, one eyebrow raised high, "
               "holding a fork with spaghetti frozen in the air, wet hair, towel around his neck, the round wall "
               "clock behind his head. His face is a little above the middle of the image.",
         effect="Very slow push-in all the way to his face, light gets darker at the edges.",
         sound="Tense low western music starts (quiet), clock ticking.",
         kling="Very slow push-in on the serious man's face, he slowly raises one eyebrow. Keep the low-poly "
               "style."),
    dict(start=(38, 0), size="extreme close-up", key=False, cast=["DAD_DINNER"], place=DINING,
         scene="Extreme close-up of HER DAD AT DINNER's eyes only: narrow, serious, one eyebrow up, drops of water "
               "in his wet eyebrows. Fills the image from side to side, a little above the middle.",
         effect="Western showdown: static, then a tiny push.",
         sound="Western whistle note, clock tick."),
    dict(start=(39, 0), size="extreme close-up", key=False, cast=["YOU"], place=DINING,
         scene="Extreme close-up of YOU's eyes only: wide, nervous, a big sweat drop on his forehead, trying to "
               "look brave. Fills the image from side to side, a little above the middle.",
         effect="Western showdown: a little closer than the dad's shot, sweat drop slides.",
         sound="Western twang, a fly buzzing past."),
    dict(start=(40, 0), size="extreme close-up (closer)", key=False, cast=["DAD_DINNER"], place=DINING,
         scene="Even closer extreme close-up of HER DAD AT DINNER: only one eye and the thick mustache, a fly "
               "sitting on his mustache, he does not move at all.",
         effect="Closer than before, tiny shake.",
         sound="Fly buzzing, loud clock tick."),
    dict(after=(40, 0.20), size="close-up insert", key=False, cast=[], place=DINING,
         scene="Close-up of the round wall clock in the dining room, the red second hand moving, warm lamp light.",
         effect="Ticks with small punch-ins, the awkward pause.",
         sound="LOUD clock tick... tick..."),
    dict(start=(41, 0), size="extreme close-up", key=False, cast=["YOU"], place=DINING,
         scene="Extreme close-up of YOU's mouth and nose leaning forward, lips pursed to whisper, eyes looking up "
               "at the dad, sweat on his upper lip. Fills the image, a little above the middle.",
         effect="Slow push-in while he whispers.",
         sound="Everything quiet except the whisper."),
    dict(after=(41, 0.30), size="wide (freeze)", key=False, cast=["YOU", "GF", "DAD_DINNER", "MOM", "BRO"],
         place=DINING,
         scene="Wide shot of the whole family at the dinner table, completely frozen: the MOM holding the "
               "spaghetti spoon in the air, the LITTLE BROTHER with spaghetti hanging from his open mouth, the "
               "GIRLFRIEND slowly turning to look at YOU, HER DAD AT DINNER staring at YOU, YOU sitting very "
               "small and stiff.",
         effect="Total freeze, slight desaturation. Silence.",
         sound="Dead silence, only one clock tick."),
    dict(after=(41, 2.20), size="wide (ending)", key=False, cast=[], place=HOUSE,
         scene="Wide shot of the cosy yellow house at night under a dark-blue starry sky, the street quiet, all "
               "windows dark except the small upstairs bathroom window, which glows warm yellow. The dark-blue "
               "car in the driveway.",
         effect="Small green wavy stink lines rise out of the glowing window into the night sky, slow zoom out "
                "(like the plane ending in the reference), fade out.",
         sound="Crickets, a dog barks once far away."),
]


def line_words(li):
    return [w for w in WORDS if w["line"] == li]


def who_in(o):
    return [CAST[n] for n in (o.get("cast") or []) if n in CAST]


def main():
    lines = {l["i"]: l for l in VO["lines"]}
    chunks = []
    for li, parts in CHUNKS.items():
        ws, text = line_words(li), lines[li]["text"].split()
        assert " ".join(parts).split() == text, (li, parts, text)
        assert len(ws) == len(text), (li, len(ws), len(text))
        k = 0
        for p in parts:
            n = len(p.split())
            shown = re.sub(r"[,.:;]+(?=\"?$)", "", p)
            t = lines[li]["start"] if k == 0 else ws[k]["s"]
            chunks.append({"text": shown, "line": li, "who": lines[li]["who"], "t": t,
                           "end": ws[k + n - 1]["e"]})
            k += n
    starts = []
    for s in SHOTS:
        if "after" in s:
            li, off = s["after"]
            starts.append(round(lines[li]["end"] + off, 2))
        else:
            li, wi = s["start"]
            t = lines[li]["start"] if wi == 0 else line_words(li)[wi]["s"]
            starts.append(max(0.0, round(t - LEAD, 2)))
    starts[0] = 0.0
    out = []
    for i, s in enumerate(SHOTS):
        t0, t1 = starts[i], (starts[i + 1] if i + 1 < len(SHOTS) else END)
        caps = [c for c in chunks if t0 <= c["t"] < t1]
        voice = " ".join(c["text"] for c in caps)
        out.append({"id": i + 1, "t0": t0, "t1": round(t1, 2), "dur": round(t1 - t0, 2), "size": s["size"],
                    "key": s["key"], "voice": voice, "captions": caps, "scene": s["scene"],
                    "cast": s.get("cast") or [], "place": s.get("place"), "black": bool(s.get("black")),
                    "effect": s["effect"], "sound": s["sound"], "kling": s.get("kling"),
                    "image": f"images/shot_{i + 1:02d}.png", "clip": f"clips/shot_{i + 1:02d}.mp4"})
    assert sum(len(o["captions"]) for o in out) == len(chunks)
    json.dump({"fps": FPS, "duration": END, "shots": out}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    write_md(out)
    for o in out:
        print(f"{o['id']:2d} {o['t0']:6.2f}-{o['t1']:6.2f} ({o['dur']:.2f}s) {'KEY ' if o['key'] else '    '}"
              f"{o['size']:28s} | " + " / ".join(c["text"] for c in o["captions"]))
    durs = [o["dur"] for o in out]
    print(f"{len(out)} shots, {END:.2f}s, mean {END / len(out):.2f}s, min {min(durs):.2f}, max {max(durs):.2f}, "
          f"key shots: {[o['id'] for o in out if o['key']]}")


def write_md(shots):
    key = [o for o in shots if o["key"]]
    imgs = [o for o in shots if not o["black"]]
    L = []
    L.append("# Gardyloo reel - image prompts\n")
    L.append(f"Reel: 1080x1920, 30 fps, {END:.1f} s, {len(shots)} shots ({len(imgs)} images + 1 black screen). "
             "Voiceover is done (`audio/voiceover.mp3`, Nassim, same voice and settings as the last reels).\n")
    L.append("## How to use\n")
    L.append("1. Open ONE new ChatGPT chat. Paste the **character sheet** prompt first.")
    L.append("2. Then paste the shot prompts one by one, in order, in the same chat (so the characters stay the same).")
    L.append("3. Save each image as `shot_01.png`, `shot_02.png` ... (or just send them to me in order). "
             "Shot 20 is a black screen: no image needed.")
    L.append(f"4. For the **{len(key)} KEY shots** (marked with a star), also make a Kling clip from that image "
             "(image-to-video, 9:16, 5 s) with the short Kling prompt. Save as `shot_09.mp4` etc. "
             "I only use the best 1-3 seconds of each clip, so a 5 s clip is plenty. If you skip a clip, I animate "
             "the image instead.")
    L.append("5. Send me the images and clips. I build `final.mp4` after that (zooms, shake, captions, effects, sound).\n")
    L.append("Tips: if a face drifts, reply \"Same character as the character sheet, match the face exactly.\" "
             "If text or letters appear in an image, reply \"Same image with no text.\" "
             "Captions, stink lines, sweat drops, the brown smudge's stink lines, shake, the sepia film look and "
             "flashes are added by me in the edit, so they are not needed in the images. "
             "The poop is never shown: only the small white toilet-paper bundle with the pink bow, and one small "
             "brown cartoon smudge on the dad's suit.\n")
    L.append("## Characters and places\n")
    for v in CAST.values():
        name, rest = v.split(" (same as the character sheet)")
        L.append(f"- {name}{rest}")
    for p in (HOUSE, BATH, DINING, OLD):
        L.append(f"- {p}")
    L.append("")
    L.append("## Character sheet (paste this first)\n")
    L.append("```\n" + CHAR_SHEET + "\n```\n")
    L.append("## Shot list\n")
    L.append("| # | time | shot | voice | key |")
    L.append("|---|---|---|---|---|")
    for o in shots:
        L.append(f"| {o['id']:02d} | {o['t0']:.2f}-{o['t1']:.2f} | {o['size']} | {o['voice']} | "
                 f"{'⭐' if o['key'] else ''} |")
    L.append("")
    L.append("## Shot prompts\n")
    for o in shots:
        star = " ⭐ KEY SHOT" if o["key"] else ""
        L.append(f"### Shot {o['id']:02d}{star} · `shot_{o['id']:02d}.png` · {o['t0']:.2f}-{o['t1']:.2f} s "
                 f"({o['dur']:.1f} s)\n")
        L.append(f"Voice: \"{o['voice']}\"\n")
        if o["black"]:
            L.append("```\n" + o["scene"] + "\n```\n")
        else:
            who = who_in(o)
            body = STYLE + "\n\n" + o["scene"] + ("\n\n" + " ".join(who) if who else "") + \
                ("\n\n" + o["place"] if o["place"] else "") + "\n\n" + ENDING
            L.append("```\n" + body + "\n```\n")
        L.append(f"- **Caption:** " + " → ".join(f"{c['text']} ({c['t']:.2f}s)" for c in o["captions"])
                 if o["captions"] else "- **Caption:** (none)")
        L.append(f"- **Effect:** {o['effect']}")
        L.append(f"- **Sound:** {o['sound']}")
        if o["kling"]:
            L.append(f"- **Kling (image-to-video, 9:16, 5 s):** `{o['kling']}`")
        L.append("")
    open(os.path.join(HERE, "prompts.md"), "w").write("\n".join(L))


if __name__ == "__main__":
    main()
