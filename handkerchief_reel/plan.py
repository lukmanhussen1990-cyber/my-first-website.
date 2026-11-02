"""Shot plan for the handkerchief reel -> prompts.md (for ChatGPT / Kling) and shots.json (for the final build).

Every shot starts 0.12 s before its first voice word (a cut just ahead of the word), so the shots fill the whole
voiceover with no gaps. Shot 12 (the bodyguard's "boop") starts just after "Shut up." ends.
Caption chunks come from make_captions.py (2-4 words, each appears on its first word).
Run:  python3 plan.py      (needs audio/vo_lines.json + audio/voiceover.words.json from make_voiceover.py)
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
         "flat polygons, slightly pixelated low-resolution textures (pixel noise on hair, skin, clothes, fur, "
         "walls, plants and ground). Characters have simple blocky heads with small black dot eyes, short block "
         "eyebrows and a tiny simple mouth. Soft realistic lighting with soft shadows, gentle depth of field. "
         "Funny and sweet, never gross. Vertical portrait image, subject in the center, no text.")

WHO = {
    "YOU": "YOU (same as the character sheet): young homeless guy, light-tan skin, messy dark-brown hair, "
           "scruffy short dark beard, kind eyes, old grey-green hoodie with colorful patches.",
    "YOU_SUIT": "YOU, now clean (same face as the character sheet): neatly combed dark-brown hair, short neat "
                "beard, nice navy-blue suit with a white shirt.",
    "YOU_GROOM": "YOU (same face as the character sheet): neatly combed dark-brown hair, short neat beard, "
                 "black tuxedo with a white flower on the jacket.",
    "OLD_YOU": "OLD YOU (same as the character sheet): the same guy at about 75, white messy hair, short white "
               "beard, round glasses, beige knitted cardigan, same kind face.",
    "LADY": "RICH LADY (same as the character sheet): elegant young woman, fair skin, long straight dark hair, "
            "big black sunglasses, red lipstick, huge fluffy white fur coat, giant sparkling diamond necklace, "
            "very calm deadpan face.",
    "LADY_LOVE": "RICH LADY (same as the character sheet): long straight dark hair, big black sunglasses pushed "
                 "up on her head (so her small dot eyes show), red lipstick, white fur coat, giant diamond "
                 "necklace.",
    "BRIDE": "RICH LADY as the bride (same face as the character sheet): long straight dark hair, big black "
             "sunglasses, red lipstick, white wedding dress, giant diamond necklace.",
    "OLD_LADY": "OLD LADY (same as the character sheet): the rich lady at about 75, white hair in a neat bun, "
                "big black sunglasses pushed up on her head, red lipstick, cream cardigan, the same diamond "
                "necklace.",
    "GUARD": "BODYGUARD (same as the character sheet): huge muscular bald man, dark-brown skin, black suit, "
             "white shirt, black tie, small black sunglasses, curly earpiece wire behind his ear.",
    "WAITER": "WAITER (same as the character sheet): thin tall man, pale skin, slicked-back black hair, thin "
              "black mustache, black tuxedo with a bow tie.",
}

PLACES = {
    "city": "PLACE: busy city street in the early evening just after rain: wet shiny pavement with puddles, warm "
            "street lamps, glowing shop windows, tall buildings.",
    "blue": "PLACE: plain dark blue background with soft light.",
    "restaurant": "PLACE: super fancy restaurant: huge golden crystal chandeliers, gold walls, white "
                  "tablecloths, candles, red velvet chairs.",
    "paris": "PLACE: green park in Paris with a lawn, round trimmed bushes and a small path, the Eiffel Tower "
             "behind, sunny golden afternoon.",
    "wedding": "PLACE: outdoor garden wedding on a sunny day: white flower arch, rows of white chairs, green "
               "lawn, flowers.",
    "porch": "PLACE: cozy wooden house with a big front porch and a porch swing at sunset, small garden with "
             "round bushes and flowers, white picket fence, golden pink sky.",
    "house_in": "PLACE: inside the cozy old house: flowery wallpaper, warm lamp light.",
}

CHAR_SHEET = (
    "CHARACTER SHEET. Low-poly blocky 3D video game render, PS1 / Roblox look: chunky faceted shapes with "
    "visible flat polygons, slightly pixelated low-resolution textures (pixel noise on hair, skin and clothes), "
    "simple blocky faces with small black dot eyes, short block eyebrows and a tiny simple mouth. Soft "
    "realistic lighting with soft shadows. Funny and sweet.\n\n"
    "Character turnaround sheet on a plain light grey background, wide landscape image, no text, no labels, "
    "no numbers. Everyone stands in a front view, full body.\n\n"
    "TOP ROW - the two main characters when they are young (about 25):\n"
    "1. \"YOU\", homeless: a young guy with light-tan skin, messy dark-brown hair, a scruffy short dark beard, "
    "kind soft eyes, an old grey-green hoodie with colorful patches (a red patch on one elbow, a blue patch on "
    "the chest), old torn jeans, worn-out sneakers.\n"
    "2. \"YOU\", later: the same guy with the same face, hair neatly combed, short neat beard, a nice navy-blue "
    "suit with a white shirt, brown shoes.\n"
    "3. \"RICH LADY\": an elegant young woman with fair skin, long straight dark hair, big black sunglasses, red "
    "lipstick, a huge fluffy white fur coat over a black dress, a giant sparkling diamond necklace, red high "
    "heels, a very calm deadpan face.\n"
    "4. A close-up of the rich lady's head with her sunglasses lowered, so her small black dot eyes look over "
    "the top of them.\n\n"
    "BOTTOM ROW - the same two people 50 years later (about 75):\n"
    "5. \"OLD YOU\": the same guy with white messy hair, a short white beard, round glasses, a beige knitted "
    "cardigan over a shirt, brown trousers, the same kind face.\n"
    "6. \"OLD LADY\": the rich lady with white hair in a neat bun, the big black sunglasses pushed up on her "
    "head, red lipstick, a cream-colored cardigan, the same giant diamond necklace.\n\n"
    "The young and old versions must clearly have the same faces.")

CHAR_SHEET_2 = (
    "CHARACTER SHEET, same style as before (low-poly blocky 3D, PS1 / Roblox look, pixelated textures, small "
    "black dot eyes, soft realistic lighting). Plain light grey background, wide landscape image, no text, no "
    "labels, no numbers.\n\n"
    "LEFT - \"BODYGUARD\": a huge, very muscular bald man with dark-brown skin, black suit, white shirt, black "
    "tie, small black sunglasses, a curly earpiece wire behind his ear, a very serious face. Show him standing "
    "(front view), and a close-up of his head crying with big cartoon tears running down from under his "
    "sunglasses.\n\n"
    "RIGHT - \"WAITER\": a thin, tall man with pale skin, slicked-back black hair, a thin black mustache, a "
    "black tuxedo with a bow tie, a white towel over his arm, holding a silver tray. Show him standing (front "
    "view and side view).\n\n"
    "Same scale: the bodyguard is about one and a half times as wide as the waiter.")

# Date labels (added in the edit, top-left corner) for the love-story timeline
LABELS = {27: "DAY 1", 31: "MONTH 3", 34: "YEAR 1", 36: "50 YEARS LATER"}

# One entry per shot. start = (line, word index) -> the shot starts LEAD before that word;
# start = ("after", line, seconds) -> the shot starts that long after the line's last word.
SHOTS = [
    # ---------------------------------------------------------------- the bush
    dict(start=(1, 0), size="medium close-up", who=["YOU"], place="city",
         scene="Medium close-up. YOU crouches behind a small round green bush on a city sidewalk: only his head "
               "and shoulders stick out above the top of the bush, the rest of him is hidden inside the bush. He "
               "looks nervous: eyes wide, eyebrows up, lips pressed together, glancing to the side. Blurry city "
               "street behind him with warm shop windows and street lamps. His face is a little above the middle "
               "of the image.",
         effect="Hook: green wavy stink lines rise from the bush. Slow push-in, small punch-in on \"homeless\".",
         sound="City noise (traffic, far horns) from the first frame. Small bush rustle."),
    dict(start=(2, 0), size="wide", who=["YOU"], place="city", key=True,
         scene="Wide shot of a busy city sidewalk in the early evening after rain. A small round green bush grows "
               "in a square of dirt between a lamp post and a fancy shop window. YOU crouches behind it: only his "
               "messy head and shoulders stick out above the top of the bush, small in the frame. People in coats "
               "walk past without looking at him. Tall buildings, glowing shop windows, wet shiny pavement with "
               "puddles.",
         effect="The bush shakes. Green stink lines above it. Slow sideways pan.",
         sound="City noise. Bush rustle on \"bush\".",
         kling="The small bush shakes and wiggles, its leaves trembling. The guy's head looks left and right "
               "nervously. People walk past. Camera static. Keep the low-poly style."),
    dict(start=(3, 0), size="close-up", who=["YOU"], place="city",
         scene="Close-up. YOU's head and shoulders above the top of the small bush. In front of his face he holds "
               "up the only two things he found: in one hand a single green leaf, in the other a crumpled old "
               "blank paper bus ticket. He stares at them with a blank, disappointed face. Blurry city street "
               "with warm lights behind.",
         effect="Punch-in on \"toilet paper\". One sweat drop.",
         sound="Paper crinkle, leaf rustle."),
    # ---------------------------------------------------------------- the limo
    dict(start=(4, 0), size="low angle", who=["YOU"], place="city", key=True,
         scene="Low angle at street level, camera almost on the wet pavement. A long shiny black limousine slides "
               "in and stops at the curb right next to the small bush. Its black paint and chrome reflect the "
               "city lights, and the whole car is reflected upside down in a big rain puddle in the front of the "
               "image. The small bush with YOU's messy head poking out of the top is at the left edge.",
         effect="Slow push-in. Small camera bump when the car stops.",
         sound="Deep bass limo engine rumble, tyres on the wet road, brakes.",
         kling="The long black limousine slides in slowly from the right and stops at the curb. Its reflection "
               "moves in the puddle, small ripples. Camera static, low angle. Keep the low-poly style."),
    dict(start=(5, 0), size="extreme close-up", who=[], place="city",
         scene="Extreme close-up of the black limousine's front wheel: a shiny gold wheel rim with small diamonds "
               "set into it, next to the glossy black car body with a thin gold stripe. The rim gleams. Wet "
               "pavement, city lights reflected in the black paint.",
         effect="Slow pan along the car, sparkles on the gold rim. Punch-in on \"black car\".",
         sound="Sparkle \"ting\". Engine bass idling."),
    dict(start=(6, 0), size="low-angle close-up", who=[], place="city",
         scene="Low-angle close-up of the limousine's back door swinging open: a gold door handle, the black door "
               "opening wide, warm golden light and a little soft mist pouring out from inside the car onto the "
               "wet sidewalk. Red velvet seats inside.",
         effect="Golden light glow from the door. Slow push-in.",
         sound="Heavy car door \"clunk\", soft whoosh."),
    dict(start=(7, 0), size="extreme close-up, ground level", who=["LADY"], place="city", key=True,
         scene="Extreme close-up at ground level, slow-motion look. A shiny red high-heel shoe steps out of the "
               "open limousine door onto the wet sidewalk and lands in a small puddle, little water drops "
               "splashing up. The edge of a white fur coat hangs above the shoe. Warm golden light from inside "
               "the car.",
         effect="Slow-motion feel, slight push-in.",
         sound="High-heel click on wet ground, water splash.",
         kling="Slow motion: the red high heel slowly steps down from the car onto the wet sidewalk and touches "
               "the puddle, small water splashes. Camera static. Keep the low-poly style."),
    dict(start=(8, 0), size="medium (tall), tilt up", who=["LADY"], place="city",
         scene="Medium shot from a slightly low angle. The RICH LADY stands in front of the open black limousine, "
               "shown from the waist up: huge fluffy white fur coat, a giant sparkling diamond necklace, long "
               "straight dark hair, big black sunglasses, red lipstick, very calm deadpan face. City lights "
               "blurred behind her.",
         effect="Tilt up from the fur coat to the necklace. On \"Diamonds\": punch-in on the necklace + sparkles.",
         sound="Soft fur \"fwoosh\". Big sparkle \"ting\" on \"Diamonds\"."),
    # ---------------------------------------------------------------- the bodyguard
    dict(start=(10, 0), size="medium", who=["GUARD"], place="city",
         scene="Medium shot. The BODYGUARD jumps out of the front door of the black limousine in total panic: "
               "both hands up in the air, mouth wide open, eyebrows high above his sunglasses, sweat drops flying "
               "off his bald head. Wet city street behind him.",
         effect="Shake. Sweat drops fly.",
         sound="Car door slam, panicked gasp."),
    dict(start=(11, 0), size="close-up", who=["GUARD"], place="city",
         scene="Close-up of the BODYGUARD leaning forward, whisper-shouting with a very worried face: eyebrows "
               "up, mouth open, one big hand reaching out, sweat on his forehead. Blurry limousine and city "
               "lights behind him.",
         effect="Small shake, one sweat drop.",
         sound="City noise gets quieter."),
    dict(start=(12, 0), size="close-up", who=["LADY"], place="city",
         scene="Close-up of the RICH LADY's face, very calm and deadpan: big black sunglasses, red lipstick, lips "
               "closed, chin up. She does not look at the bodyguard, she looks straight ahead. White fur collar, "
               "diamond necklace. Blurry city lights behind.",
         effect="Hard cut, no camera move at all (deadpan).",
         sound="City noise drops out for a moment."),
    dict(start=("after", 12, 0.05), size="close-up", who=["GUARD"], place="city",
         scene="Close-up of the BODYGUARD with his mouth snapped shut into a tight flat line, lips pressed "
               "together, cheeks puffed out a little, eyes wide behind his sunglasses, standing very stiff like a "
               "statue. Blurry city lights behind.",
         effect="Tiny punch-in on the cut.",
         sound="Cartoon \"boop\" right on the cut."),
    # ---------------------------------------------------------------- the freeze
    dict(start=(13, 0), size="wide", who=["LADY", "YOU", "GUARD"], place="city",
         scene="Wide shot on the city sidewalk. The RICH LADY in her white fur coat walks calmly and straight "
               "toward the small round bush, which is in the front of the image with YOU's messy head poking out "
               "of the top (seen from behind). The black limousine waits at the curb behind her; the BODYGUARD "
               "stands next to it with both hands on his head. Wet shiny pavement, warm city lights.",
         effect="Slow push-in toward her.",
         sound="High-heel clicks, one per step. City noise quiet."),
    dict(start=(14, 0), size="close-up", who=["YOU"], place="city",
         scene="Close-up of YOU's face above the top of the bush, totally frozen: eyes wide open, mouth a tiny "
               "straight line, a single sweat drop on his forehead, leaves of the bush around his chin. Blurry "
               "city lights behind.",
         effect="Freeze. One sweat drop rolls down.",
         sound="All sound drops. One single heartbeat."),
    dict(start=(15, 0), size="close-up", who=["LADY"], place="city",
         scene="Close-up of the RICH LADY, frozen mid-step right in front of the bush, her face perfectly still, "
               "sunglasses on, one eyebrow slightly raised above the sunglasses. White fur collar, diamond "
               "necklace. Blurry city lights behind.",
         effect="A little closer than the shot before. No movement.",
         sound="Silence. Heartbeat."),
    dict(start=(16, 0), size="extreme close-up", who=["LADY"], place="city",
         scene="Extreme close-up of the RICH LADY slowly lowering her big black sunglasses with one finger: her "
               "small black dot eyes now show over the top of the sunglasses, looking down. Red lipstick. Soft "
               "warm light.",
         effect="Even closer. Slow push-in.",
         sound="Heartbeat."),
    dict(start=(17, 0), size="extreme close-up", who=["YOU"], place="city",
         scene="Extreme close-up of YOU's face looking up: kind small dot eyes, messy hair with a leaf stuck in "
               "it, scruffy beard. Soft warm light on his face.",
         effect="The closest shot. Slow push-in.",
         sound="Heartbeat."),
    # ---------------------------------------------------------------- the handkerchief
    dict(start=(18, 0), size="close-up, slow motion", who=[], place="city", key=True,
         scene="Close-up, slow-motion look. A shiny pink silk handkerchief with thin gold edges floats out of the "
               "rich lady's elegant hand (a big diamond ring on her finger), the silk flowing and rippling softly "
               "in the air. A heavenly beam of warm light falls on it, tiny sparkles around it. Blurry dark city "
               "lights behind.",
         effect="Heavenly glow and sparkles. Slow push-in.",
         sound="Heavenly choir \"aaah\".",
         kling="Slow motion: the pink silk handkerchief slowly flows and ripples out of her hand in the air, "
               "shining in a beam of warm light, tiny sparkles. Camera slowly pushes in. Keep the low-poly style."),
    dict(start=(19, 0), size="medium", who=[], place="city",
         scene="Medium shot of YOU's whole life: an old rusty shopping cart parked on the wet sidewalk next to the "
               "small bush, holding everything he owns: a rolled-up sleeping bag, a dented cooking pot, a blank "
               "piece of cardboard, a small potted plant, a yellow rubber duck and an umbrella with holes. Warm "
               "street-lamp light falls on it.",
         effect="Slow sideways pan across the cart. Tiny zoom on \"whole life\".",
         sound="One squeaky cart-wheel squeak."),
    dict(start=(20, 0), size="medium, side view", who=["LADY", "YOU"], place="city",
         scene="Medium side view on the sidewalk. The RICH LADY holds the pink silk handkerchief out at arm's "
               "length, her arm perfectly straight, toward YOU, whose head and shoulders stick out above the top "
               "of the small bush. She looks straight ahead with a calm deadpan face; he stares at the "
               "handkerchief with big eyes. Warm city lights behind.",
         effect="Slow push-in on the handkerchief.",
         sound="Silk swish, soft sparkle."),
    dict(start=(21, 0), size="close-up", who=["LADY"], place="city",
         scene="Close-up of the RICH LADY's face, perfectly straight and deadpan, sunglasses back on, red "
               "lipstick, her hand holding the pink handkerchief out at the edge of the image. White fur collar, "
               "diamond necklace. Blurry city lights behind.",
         effect="Hold still (deadpan). Tiny punch-in on \"need this\".",
         sound="Quiet city."),
    # ---------------------------------------------------------------- the fact
    dict(start=(22, 0), size="high wide (from above)", who=[], place="city",
         scene="High wide shot looking down at the city street from above in the early evening: the long black "
               "limousine at the curb, the small round bush on the sidewalk, a lady in a white fur coat standing "
               "next to it, a big man in a black suit by the car. Wet streets shining with warm street lights, "
               "tiny people and cars.",
         effect="Slow zoom in from above (documentary feel).",
         sound="City noise far away, soft low \"documentary\" tone."),
    dict(start=(23, 0), size="close-up", who=[], place="blue",
         scene="Close-up of a cute cartoon pink brain floating in the middle of the image, made of chunky "
               "low-poly shapes, with two small black dot eyes and a tiny smile, holding a big golden stopwatch "
               "in a tiny hand. Plain dark blue background with soft light, a few little sparkles.",
         effect="The brain bobs a little. Punch-in on \"someone's face\".",
         sound="Fast clock ticking."),
    dict(start=(24, 0), size="extreme close-up", who=[], place="blue",
         scene="Extreme close-up of a big shiny golden stopwatch, its hand at the very beginning of the dial. The "
               "dial has simple tick marks and no numbers. Plain dark blue background with soft light.",
         effect="I add a pixel \"0.1 SEC\" display over the stopwatch. Punch-in on \"tenth\".",
         sound="Stopwatch click + small \"ding\"."),
    dict(start=(25, 0), size="extreme close-up", who=["LADY"], place="city",
         scene="Extreme close-up of the RICH LADY's face: her small black dot eyes go wide over the top of her "
               "lowered sunglasses, eyebrows up, cheeks a little pink, a tiny pink heart shining in each eye. Red "
               "lipstick.",
         effect="Eyes go wide: quick punch-in. Pink sparkle.",
         sound="Quick \"zoom\" swoosh."),
    dict(start=(26, 0), size="extreme close-up", who=["YOU"], place="city",
         scene="Extreme close-up of YOU's face: his small black dot eyes go wide, eyebrows up, cheeks pink, a "
               "leaf in his messy hair, scruffy beard.",
         effect="Same punch-in. A big pink heart pops up in the middle at the end; small hearts start floating.",
         sound="Cute \"pop\" for the heart."),
    # ---------------------------------------------------------------- the timeline: first date
    dict(start=(27, 0), size="wide", who=["YOU_SUIT", "LADY_LOVE"], place="restaurant",
         scene="Wide shot of a super fancy restaurant: huge golden crystal chandeliers, gold walls, red velvet "
               "chairs, white tablecloths with candles, a pianist at a black grand piano in the back. In the "
               "middle, at a small candle-lit table, YOU (now clean, in a nice navy suit) sits across from the "
               "RICH LADY (white fur coat, diamond necklace, sunglasses pushed up on her head). They smile at "
               "each other.",
         effect="Corner label \"DAY 1\". Slow push-in toward their table.",
         sound="Restaurant piano music, soft clinking glasses."),
    dict(start=(29, 0), size="close-up", who=["YOU_SUIT"], place="restaurant",
         scene="Close-up of YOU (clean, nice navy suit, neat beard) at the fancy restaurant table, holding a huge "
               "juicy steak with both hands and biting into it, eyes closed, very happy. A fancy plate with a "
               "tiny garnish and untouched silver knife and fork in front of him. Candles and a golden "
               "chandelier blurred behind.",
         effect="Punch-in on \"hands\".",
         sound="Big chomp. Piano music."),
    dict(start=(30, 0), size="close-up", who=["LADY_LOVE"], place="restaurant",
         scene="Close-up of the RICH LADY at the fancy restaurant table, also holding a huge steak with both "
               "hands and taking a big bite, laughing with her eyes squeezed shut, sunglasses pushed up on her "
               "head, diamond rings on her fingers, diamond necklace. Candles and a golden chandelier blurred "
               "behind.",
         effect="Small floating hearts.",
         sound="Chomp. Piano music."),
    dict(start=(31, 0), size="medium", who=["WAITER"], place="restaurant", key=True,
         scene="Medium shot. The thin WAITER in a black tuxedo falls straight backwards, stiff as a board, eyes "
               "rolled up and mouth open, still holding up his silver tray while plates and wine glasses fly up "
               "off it. Golden chandeliers and red velvet chairs behind.",
         effect="Shake when he hits the floor.",
         sound="Plate crash, thud. Piano music stops.",
         kling="The waiter slowly falls straight backwards, stiff as a plank, plates and glasses fly up off his "
               "tray. Camera static. Keep the low-poly style."),
    # ---------------------------------------------------------------- Paris
    dict(start=(32, 0), size="wide", who=[], place="paris",
         scene="Wide shot of the Eiffel Tower in Paris on a sunny golden afternoon, seen from a green park with a "
               "lawn, round trimmed bushes and a little path, a few fluffy clouds and birds.",
         effect="Corner label \"MONTH 3\". Slow tilt up the tower.",
         sound="French accordion music starts. Birds."),
    dict(start=(33, 0), size="medium", who=["YOU_SUIT"], place="paris",
         scene="Medium shot in a park in Paris, the Eiffel Tower big in the background. YOU (clean, nice navy "
               "suit, neat hair) crouches behind a small round trimmed bush: only his head and shoulders stick "
               "out above the top of the bush. He smiles calmly and happily, eyes half closed. Sunny golden "
               "light.",
         effect="Green stink lines rise from the bush, mixed with small hearts.",
         sound="Accordion music. Bush rustle."),
    dict(start=(34, 0), size="medium", who=["LADY_LOVE", "YOU_SUIT"], place="paris",
         scene="Medium shot in the same Paris park, the Eiffel Tower behind. The RICH LADY (white fur coat, "
               "diamond necklace, sunglasses pushed up on her head) stands next to the small round bush, "
               "laughing, holding the pink silk handkerchief out toward YOU, whose head sticks out above the top "
               "of the bush. He smiles at her.",
         effect="Floating hearts. Sparkle on the handkerchief.",
         sound="Accordion music, sparkle."),
    # ---------------------------------------------------------------- the wedding
    dict(start=(35, 0), size="wide", who=["YOU_GROOM", "BRIDE"], place="wedding",
         scene="Wide shot of an outdoor garden wedding on a sunny day: a white flower arch, rows of white chairs "
               "with guests, green lawn, flower petals in the air. Under the arch, YOU in a black tuxedo bows "
               "and kisses the back of the hand of the RICH LADY in a white wedding dress (with her big black "
               "sunglasses and her diamond necklace).",
         effect="Corner label \"YEAR 1\". Flower petals, slow push-in.",
         sound="Wedding bells."),
    dict(start=(36, 0), size="close-up", who=["GUARD"], place="wedding", key=True,
         scene="Close-up of the BODYGUARD sitting in the front row at the outdoor wedding, crying his eyes out: "
               "big cartoon tears streaming down from under his sunglasses, mouth wide open in a loud wail, "
               "holding a huge white tissue to his nose. Wedding guests and flowers blurred behind.",
         effect="Shake on every sob. Big cartoon tears.",
         sound="Loud cartoon sobbing, a nose-blow honk.",
         kling="The bodyguard sobs loudly, his shoulders shaking, big tears streaming down, he blows his nose "
               "into the huge tissue. Camera static. Keep the low-poly style."),
    # ---------------------------------------------------------------- 50 years later
    dict(start=(37, 0), size="wide", who=[], place="porch",
         scene="Wide shot of a cozy wooden house with a big front porch at sunset: a porch swing, warm light in "
               "the windows, a small garden in front with round bushes and flowers, a white picket fence, a "
               "golden pink sky.",
         effect="Corner label \"50 YEARS LATER\". Slow push-in toward the porch.",
         sound="Soft piano music starts. Crickets."),
    dict(start=(38, 0), size="medium", who=["OLD_YOU", "OLD_LADY"], place="porch",
         scene="Medium shot of OLD YOU and the OLD LADY sitting side by side on a wooden porch swing at sunset, "
               "both smiling softly. Warm golden light, flowers and round garden bushes around the porch.",
         effect="Gentle sway like the swing.",
         sound="Soft piano, swing creak."),
    dict(start=(39, 0), size="close-up", who=["OLD_YOU", "OLD_LADY"], place="porch",
         scene="Close-up of two old wrinkled hands holding each other on the porch swing: his hand with a beige "
               "cardigan sleeve, her hand with a big old diamond ring and a cream cardigan sleeve. Warm golden "
               "sunset light.",
         effect="Small hearts float up.",
         sound="Soft piano."),
    dict(start=(40, 0), size="close-up", who=["OLD_LADY"], place="porch",
         scene="Close-up of the OLD LADY on the porch swing, smiling softly and holding up the same pink silk "
               "handkerchief with gold edges, now faded and wrinkled with age. Warm sunset light.",
         effect="Sparkle on the handkerchief.",
         sound="Soft piano, tiny sparkle."),
    dict(start=(41, 0), size="medium", who=[], place="house_in",
         scene="Medium shot inside the cozy old house: on the flowery wallpaper hangs a fancy golden picture "
               "frame, and inside the frame is the old pink handkerchief, stiff, crusty and crumpled, pinned "
               "flat behind the glass like a museum piece. A small brass lamp lights it from above.",
         effect="Small green stink lines rise from the frame. Slow push-in.",
         sound="Piano pauses. A tiny fly buzz."),
    dict(start=(42, 0), size="wide (ending)", who=[], place="porch",
         scene="Wide shot of the cozy wooden house with the porch at sunset, seen from further away: the whole "
               "garden with round bushes in front, two tiny old people on the porch swing, and a big golden pink "
               "sky above the house with lots of empty space.",
         effect="Ending like the plane: pink hearts and a few small green stink lines float up together into "
                "the sky. Slow zoom out.",
         sound="Soft piano ending, crickets."),
]

norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def main():
    lines = {l["i"]: l for l in VO["lines"]}
    onsets = json.load(open(os.path.join(HERE, "audio", "word_onsets.json")))
    # caption chunks from the captions file (exact on-screen text + start time)
    caps = []
    for ln in open(os.path.join(HERE, "audio", "captions.ass")):
        if ln.startswith("Dialogue:") and ln.split(",")[3] == "Caption":     # skip the shadow layer
            f = ln.split(",", 9)
            h, m, s = f[1].split(":")
            t = int(h) * 3600 + int(m) * 60 + float(s)
            text = re.sub(r"\{[^}]*\}", "", f[9]).replace("\\h", "").strip()
            text = re.sub(r"\s+", " ", text)
            caps.append({"text": text, "t": round(t, 3)})
    starts = []
    for s in SHOTS:
        st = s["start"]
        if st[0] == "after":
            starts.append(round(lines[st[1]]["end"] + st[2], 3))
        else:
            li, wi = st
            t = [w for w in onsets if w["line"] == li][wi]["s"]          # measured word onset (= caption time)
            starts.append(max(0.0, round(t - LEAD, 3)))
    starts[0] = 0.0
    starts = [round(round(t * FPS) / FPS, 3) for t in starts]     # cuts on whole frames
    out = []
    for i, s in enumerate(SHOTS):
        t0, t1 = starts[i], (starts[i + 1] if i + 1 < len(SHOTS) else END)
        assert t1 - t0 > 0.5, (i + 1, t0, t1)
        cs = [c for c in caps if t0 - 0.06 <= c["t"] < t1 - 0.06]
        lines_in = [l["text"] for l in VO["lines"] if t0 - 0.06 <= l["start"] < t1 - 0.06]
        out.append({"id": i + 1, "t0": t0, "t1": round(t1, 3), "dur": round(t1 - t0, 3), "size": s["size"],
                    "key": bool(s.get("key")), "voice": " ".join(lines_in), "captions": cs,
                    "who": s["who"], "place": s["place"], "scene": s["scene"], "effect": s["effect"],
                    "sound": s["sound"], "kling": s.get("kling"), "label": LABELS.get(i + 1),
                    "image": f"images/shot_{i + 1:02d}.png", "clip": f"clips/shot_{i + 1:02d}.mp4"})
    assert sum(len(o["captions"]) for o in out) == len(caps), "a caption fell outside the shots"
    json.dump({"fps": FPS, "duration": END, "shots": out}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    write_md(out)
    for o in out:
        print(f"{o['id']:2d} {o['t0']:6.2f}-{o['t1']:6.2f} ({o['dur']:.2f}s) {'KEY ' if o['key'] else '    '}"
              f"{o['size']:30s} | " + " / ".join(c["text"] for c in o["captions"]) +
              (f"   [{o['label']}]" if o["label"] else ""))
    d = [o["dur"] for o in out]
    print(f"{len(out)} shots, {END:.2f}s, mean {END / len(out):.2f}s (min {min(d):.2f}, max {max(d):.2f}), "
          f"key shots: {[o['id'] for o in out if o['key']]}")


def write_md(shots):
    key = [o for o in shots if o["key"]]
    L = []
    L.append("# Handkerchief reel - image prompts (\"You're homeless\")\n")
    L.append(f"Reel: 1080x1920, 30 fps, {END:.1f} s, {len(shots)} shots (about {END / len(shots):.1f} s each, "
             "like the last reels). Voice: your own voiceover (`audio/voiceover.mp3`), with a few longer pauses "
             "for timing.\n")
    L.append("## How to use\n")
    L.append("1. Open ONE new ChatGPT chat. Paste **character sheet 1** first, then **character sheet 2**.")
    L.append("2. Then paste the shot prompts one by one, in order, in the same chat (so the faces stay the same).")
    L.append("3. Save each image as `shot_01.png`, `shot_02.png` ... (or just send them to me in order).")
    L.append(f"4. For the **{len(key)} KEY shots** (marked with a star: "
             + ", ".join(f"{o['id']:02d}" for o in key) +
             "), also make a Kling clip from that image (image-to-video, 9:16, 5 s) with the short Kling prompt. "
             "Save it as `shot_04.mp4` etc. I only use the best 1-3 seconds of each clip, so 5 s is plenty. "
             "No clip? No problem - I use the image.")
    L.append("5. Send me the images and clips. I build `final.mp4` right after that (zooms, shake, captions, "
             "date labels, effects, sound).\n")
    L.append("Tips: if a face changes, reply \"Same face as the character sheet, match it exactly.\" If text or "
             "letters appear in an image, reply \"Same image with no text.\" Captions, date labels (DAY 1, "
             "MONTH 3, YEAR 1, 50 YEARS LATER), the \"0.1 SEC\" display, stink lines, sweat drops, hearts and "
             "sparkles are added by me in the edit, so they are not needed in the images.\n")
    L.append("Rules kept in every prompt: funny and sweet, never gross; everyone stays dressed; the bush always "
             "hides him (only his head and shoulders show above it).\n")
    L.append("## Characters and places\n")
    for k in ["YOU", "YOU_SUIT", "OLD_YOU", "LADY", "OLD_LADY", "GUARD", "WAITER"]:
        L.append(f"- {WHO[k]}")
    L.append("")
    for k, v in PLACES.items():
        L.append(f"- {v}")
    L.append("")
    L.append("## Character sheet 1 - the couple, young and old (paste this first)\n")
    L.append("```\n" + CHAR_SHEET + "\n```\n")
    L.append("## Character sheet 2 - bodyguard and waiter (paste this second)\n")
    L.append("```\n" + CHAR_SHEET_2 + "\n```\n")
    L.append("## Shot list\n")
    L.append("| # | time | shot | voice | label | key |")
    L.append("|---|---|---|---|---|---|")
    for o in shots:
        L.append(f"| {o['id']:02d} | {o['t0']:.2f}-{o['t1']:.2f} | {o['size']} | {o['voice'] or '(pause)'} | "
                 f"{o['label'] or ''} | {'⭐' if o['key'] else ''} |")
    L.append("")
    L.append("## Shot prompts\n")
    for o in shots:
        star = " ⭐ KEY SHOT" if o["key"] else ""
        L.append(f"### Shot {o['id']:02d}{star} · `shot_{o['id']:02d}.png` · {o['t0']:.2f}-{o['t1']:.2f} s "
                 f"({o['dur']:.1f} s)\n")
        L.append(f"Voice: \"{o['voice']}\"\n" if o["voice"] else "Voice: (pause - no words)\n")
        body = STYLE + "\n\n" + o["scene"]
        if o["who"]:
            body += "\n\n" + " ".join(WHO[w] for w in o["who"])
        body += "\n\n" + PLACES[o["place"]]
        L.append("```\n" + body + "\n```\n")
        if o["captions"]:
            L.append("- **Caption:** " + " → ".join(f"{c['text']} ({c['t']:.2f}s)" for c in o["captions"]))
        else:
            L.append("- **Caption:** none (the last caption stays a moment, then nothing)")
        if o["label"]:
            L.append(f"- **Date label (top-left corner):** {o['label']}")
        L.append(f"- **Effect:** {o['effect']}")
        L.append(f"- **Sound:** {o['sound']}")
        if o["kling"]:
            L.append(f"- **Kling (image-to-video, 9:16, 5 s):** `{o['kling']}`")
        L.append("")
    open(os.path.join(HERE, "prompts.md"), "w").write("\n".join(L))


if __name__ == "__main__":
    main()
