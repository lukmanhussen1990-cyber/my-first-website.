"""Shot plan for the wedding reel -> prompts.md (for ChatGPT / Kling) and shots.json (for the final build).

Same method as bear_reel/plan.py: every shot starts 0.12 s before its first voice word (a cut just ahead of
the word), so the shots fill the whole voiceover with no gaps. Caption chunks are 2-4 words and start on the
first word they show.
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
         "flat polygons, slightly pixelated low-resolution textures (pixel noise on hair, suits, tablecloths, "
         "carpet and walls). Characters have realistic adult proportions with simple blocky heads, small black "
         "square dot eyes, short block eyebrows and a tiny simple mouth. Soft realistic lighting with soft "
         "shadows, warm golden chandelier light, gentle depth of field. Silly and funny, never gross, everyone "
         "fully dressed. Vertical portrait image, subject in the center, no text.")

CAST = {
    "YOU": ("YOU (same as the character sheet): a 32-year-old man who looks like a successful businessman: "
            "light-brown skin, short neat black beard, shiny black hair gelled back, smart navy-blue suit, white "
            "shirt, dark-red tie, big gold wristwatch, shiny black leather shoes."),
    "GROOM": ("GROOM (same as the character sheet): a young man, slim, clean-shaven, short neat black hair, "
              "white wedding suit with a white shirt and a small black bow tie, a red rose in his breast pocket."),
    "BRIDE": ("BRIDE (same as the character sheet): a young woman, dark hair in a neat bun, white wedding dress, "
              "long white veil, pearl earrings."),
    "UNCLES": ("UNCLES (same as the character sheet): three middle-aged men in dark grey suits, all with thick "
               "black mustaches and round bellies: one bald, one with grey hair on the sides, one with a comb-over."),
    "GRANDPA": ("GRANDPA (same as the character sheet): an old man, bald on top with white hair on the sides, very "
                "big round glasses, brown cardigan over a shirt and tie, a wooden walking stick."),
    "DJ": ("DJ (same as the character sheet): a young guy with big chunky black headphones, a bright patterned "
           "shirt, standing behind a DJ table with two turntables and a laptop."),
}
PLACE = ("PLACE: a fancy wedding hall: big crystal chandeliers, round tables with white tablecloths and tall "
         "white-and-pink flower centerpieces, gold chairs, a shiny wooden dance floor, a DJ booth with colored "
         "lights, and a long hallway at the side that leads to the bathroom.")
BATHROOM = ("PLACE: a fancy marble bathroom: cream marble walls and floor, dark wooden toilet stall doors, warm "
            "soft lights.")

CHAR_SHEET = (
    "CHARACTER SHEET. Low-poly blocky 3D video game render, PS1 / Roblox look: chunky faceted shapes with "
    "visible flat polygons, slightly pixelated low-resolution textures (pixel noise on hair and clothes), "
    "realistic adult proportions with simple blocky heads, small black square dot eyes, short block eyebrows "
    "and a tiny simple mouth. Soft realistic lighting with soft shadows. Silly and funny, everyone fully "
    "dressed.\n\n"
    "Character lineup on a plain light grey background, wide landscape image, everyone standing in one row, "
    "front view, full body, no text, no labels, no numbers.\n\n"
    "From left to right:\n"
    "1. \"YOU\": a 32-year-old man who looks like a successful businessman: light-brown skin, short neat black "
    "beard, shiny black hair gelled back, smart navy-blue suit, white shirt, dark-red tie, big gold wristwatch, "
    "shiny black leather shoes. Confident face.\n"
    "2. \"GROOM\": a young man, slim, clean-shaven, short neat black hair, white wedding suit, white shirt, small "
    "black bow tie, a red rose in his breast pocket. Happy face.\n"
    "3. \"BRIDE\": a young woman, dark hair in a neat bun, white wedding dress, long white veil, pearl earrings. "
    "Big happy smile.\n"
    "4-6. \"UNCLES\": three middle-aged men in dark grey suits, all with thick black mustaches and round "
    "bellies: one bald, one with grey hair on the sides, one with a comb-over. Serious faces.\n"
    "7. \"GRANDPA\": an old man, bald on top with white hair on the sides, very big round glasses, brown "
    "cardigan over a shirt and tie, leaning on a wooden walking stick.\n"
    "8. \"DJ\": a young guy with big chunky black headphones around his neck, bright patterned shirt, jeans, "
    "sneakers.\n\n"
    "Below the row, a close-up of YOU's head and shoulders, front view, with a big proud smile.")

# Caption chunks per voice line (2-4 words, exact script words; trailing , . : are dropped on screen)
CHUNKS = {
    1: ["You're thirty-two", "years old."], 2: ["You just pooped", "at your cousin's wedding."],
    3: ["And from the toilet,", "you yell:"], 4: ["MOM!", "I'M DONE!"], 5: ["The DJ", "stops the music."],
    6: ["Two hundred guests", "turn around."], 7: ["Then you remember."], 8: ["Mom left", "an hour ago."],
    9: ["Silence."], 10: ["The uncles", "look at each other."], 11: ["Nobody moves."],
    12: ["The bride", "stops smiling."], 13: ["The groom pretends", "to check his phone."],
    14: ["Grandpa pretends", "to be asleep."], 15: ["You yell again."], 16: ["Louder."],
    17: ["MOM!", "I'M DOOONE!"], 18: ["A baby", "starts crying."], 19: ["What you don't know:"],
    20: ["most kids learn", "to wipe", "on their own", "by age five or six."], 21: ["You're thirty-two."],
    22: ["The family", "makes a circle."], 23: ["Rock."], 24: ["Paper."], 25: ["Scissors."],
    26: ["Everyone throws rock."], 27: ["Except the groom."], 28: ["He throws scissors."],
    29: ["On his own", "wedding day."], 30: ["He walks", "to the toilet."], 31: ["Slowly."],
    32: ["The DJ plays", "a sad song."], 33: ["Congratulations", "to the happy couple."],
}

# One entry per shot. "start" = (line, word index in that line) where the shot's voice starts.
SHOTS = [
    dict(start=(1, 0), size="medium close-up", key=False, cast=["YOU"], place=BATHROOM,
         scene="Medium close-up, shoulders up. YOU sitting inside a closed toilet stall (dark wooden stall walls "
               "right behind him), proudly fixing his dark-red tie with one hand, the big gold watch shining on "
               "his wrist. Confident, serious businessman face, chin up. Warm soft bathroom light. His face is a "
               "little above the middle of the image.",
         effect="Calm slow push-in. A tiny sparkle on the gold watch.",
         sound="Muffled happy wedding dance music from far away (through the wall) from the first frame."),
    dict(start=(2, 0), size="low-angle close-up", key=False, place=BATHROOM,
         scene="Low-angle shot from the marble floor of a fancy bathroom: one closed dark-wood toilet stall "
               "door in the center. In the gap under the door you only see a man's shiny black leather shoes and "
               "the hems of his neatly pressed navy-blue suit trousers, fully dressed, feet flat on the floor. "
               "Clean cream marble floor, warm soft light.",
         effect="Green wavy stink lines rise from the top of the stall door. Punch-in on \"pooped\".",
         sound="Muffled wedding music through the wall."),
    dict(start=(2, 3), size="wide", key=False, cast=[], place=PLACE,
         scene="Wide establishing shot of the fancy wedding hall at night: crystal chandeliers glowing, round "
               "tables with white tablecloths and tall flower centerpieces, many guests in suits and dresses "
               "sitting and chatting, the GROOM in a white suit and the BRIDE in a white dress dancing in the "
               "middle of the wooden dance floor, the DJ booth with colored lights at the back. On the far right, "
               "a long hallway leads to a closed bathroom door.",
         effect="Slow sideways pan across the party.",
         sound="Wedding music louder (we are in the hall now), crowd chatter."),
    dict(start=(3, 0), size="medium close-up", key=False, cast=["YOU"], place=BATHROOM,
         scene="Medium close-up, shoulders up. YOU inside the closed toilet stall, cupping both hands around his "
               "mouth like a megaphone, taking a huge breath: chest puffed out, eyebrows up, very serious face. "
               "Dark wooden stall walls behind him. His face is a little above the middle of the image.",
         effect="Slow push-in, music gets quieter (tension).",
         sound="Big inhale."),
    dict(start=(4, 0), size="extreme close-up", key=True, cast=["YOU"], place=BATHROOM,
         scene="Extreme close-up of YOU's face yelling with all his power: mouth wide open (a big dark blocky "
               "mouth), eyes squeezed shut, eyebrows angled, beard and gelled hair blown back, both hands cupped "
               "around his mouth. Toilet stall wall behind him. His face is in the upper half of the image.",
         effect="Strong screen shake, fast zoom punch, the yell echoes.",
         sound="YELL with a big echo (hall reverb).",
         kling="The man yells as loud as he can, mouth wide open, his head shaking with the force, his hair and "
               "tie blown back. Camera shakes. Keep the low-poly style."),
    dict(start=(4, 1), size="close-up", key=False, cast=[], place=PLACE,
         scene="Close-up of a row of tall champagne glasses full of champagne on a white round table in the "
               "wedding hall, the champagne rippling and jumping inside the glasses, one glass tipping over. "
               "Blurred chandeliers and guests behind.",
         effect="Screen shake, glasses rattle.",
         sound="Glasses rattling / clinking, echo of the yell rolling through the hall."),
    dict(start=(5, 0), size="medium close-up", key=False, cast=["DJ"], place=PLACE,
         scene="Medium close-up of the DJ behind his DJ table with colored lights: one hand pressed flat on the "
               "spinning vinyl record to stop it, frozen in shock, eyes wide, mouth open, headphones on one ear. "
               "Turntables, laptop and colored lights around him. His face is a little above the middle of the "
               "image.",
         effect="Hard punch-in on \"stops\", colored lights freeze.",
         sound="RECORD SCRATCH, music cuts dead."),
    dict(start=(6, 0), size="wide", key=True, cast=[], place=PLACE,
         scene="Wide shot of the wedding hall from the bathroom hallway: about two hundred guests in suits and "
               "dresses at the round tables, ALL turned around in their chairs at the same time, all staring "
               "straight at the camera with blank faces. Chandeliers above, flower centerpieces, the dance floor "
               "empty in the middle.",
         effect="Slow zoom on the crowd.",
         sound="Chairs creaking, crowd gasp, then silence.",
         kling="All the guests turn around in their chairs at the same time and stare at the camera, perfectly "
               "in sync. Slow camera push-in. Keep the low-poly style."),
    dict(start=(7, 0), size="close-up", key=False, cast=["YOU"], place=BATHROOM,
         scene="Close-up of YOU inside the toilet stall, frozen, realizing something terrible: eyes wide, mouth a "
               "small flat line, one big sweat drop on his forehead, one eyebrow up. Stall wall behind him. His "
               "face is a little above the middle of the image.",
         effect="Slow zoom into his eyes, colors slightly drained. Sweat drop.",
         sound="Quiet room tone, tiny \"ding\" of realization."),
    dict(start=(8, 0), size="close-up", key=False, cast=[], place=PLACE,
         scene="Close-up of one empty gold chair at a round wedding table: on the seat there is a small white "
               "folded place card that reads \"Reserved: Mom\" (these are the only words in the image). The chair "
               "is completely empty, no handbag, no jacket. Next to it, a half-eaten plate of food and an empty "
               "glass. Warm chandelier light, blurred guests behind.",
         effect="Slow push-in on the card, a cold blue tint.",
         sound="Quiet. A single cricket chirp."),
    dict(start=(9, 0), size="wide", key=False, cast=[], place=PLACE,
         scene="View from behind the guests: the backs of many heads and shoulders in suits and dresses in the "
               "foreground, all staring at the end of a long hallway, where there is one closed dark wooden "
               "bathroom door with a small gold restroom sign (a simple man symbol, no words). Chandelier light, "
               "dead still.",
         effect="Locked camera, nothing moves (real silence).",
         sound="Total silence, one cough far away."),
    dict(start=(10, 0), size="medium", key=False, cast=["UNCLES"], place=PLACE,
         scene="Medium shot of the three UNCLES sitting side by side at a round wedding table, all facing the "
               "camera, but their eyes are turned sideways looking at each other, mustaches twitching, totally "
               "serious faces. Champagne glasses and flowers on the table in front of them.",
         effect="Quick punch-in, eyes dart left and right (small zoom pulses).",
         sound="Tiny \"blink\" sounds."),
    dict(start=(11, 0), size="medium close-up", key=False, cast=[], place=PLACE,
         scene="Medium close-up of a waiter in a black vest and bow tie, frozen like a statue while pouring "
               "champagne into a glass: the glass is overflowing and champagne spills over the table, but he "
               "does not move at all, staring blankly at the camera. Blurred wedding hall behind.",
         effect="Locked camera, slow push-in.",
         sound="Champagne pouring and dripping."),
    dict(start=(12, 0), size="close-up", key=False, cast=["BRIDE"], place=PLACE,
         scene="Close-up of the BRIDE's face: a huge happy smile that is frozen and slowly dying, eyes blank, one "
               "eye twitching, veil around her face. Blurred chandeliers behind her. Her face is a little above "
               "the middle of the image.",
         effect="Slow push-in, a tiny twitch shake on \"stops\".",
         sound="Small sad \"womp\"."),
    dict(start=(13, 0), size="medium close-up", key=False, cast=["GROOM"], place=PLACE,
         scene="Medium close-up of the GROOM standing in the wedding hall, holding his smartphone up very close to "
               "his face, staring at it very seriously, pretending to be busy, a little sweat drop. Blurred "
               "guests and chandeliers behind him. His face is a little above the middle of the image.",
         effect="Slow push-in.",
         sound="Phone tap sounds."),
    dict(start=(13, 3), size="extreme close-up", key=False, cast=["GROOM"], place=PLACE,
         scene="Over-the-shoulder extreme close-up of the GROOM's smartphone screen in his hand: it only shows "
               "the plain phone home screen with a blue wallpaper and rows of colorful app icons, no messages, "
               "no notifications, nothing happening. His thumb hovering over it.",
         effect="Punch-in on the screen.",
         sound="Phone tap."),
    dict(start=(14, 0), size="medium close-up", key=True, cast=["GRANDPA"], place=PLACE,
         scene="Medium close-up of GRANDPA sitting in a gold chair at a wedding table, both hands on his walking "
               "stick, head tilted back, mouth wide open, pretending to be asleep, but ONE eye is open and "
               "peeking sideways behind his big round glasses. His face is a little above the middle of the "
               "image. Blurred wedding hall behind.",
         effect="Small zoom pulse on each fake snore, \"Z\" bubbles optional.",
         sound="Fake snore (loud and fake), little whistle.",
         kling="The old man fake snores with his mouth open, chest going up and down, then his one open eye "
               "slowly peeks to the side and closes again. Camera static. Keep the low-poly style."),
    dict(start=(15, 0), size="medium close-up", key=False, cast=["YOU"], place=BATHROOM,
         scene="Medium close-up, shoulders up. YOU inside the toilet stall, taking an ENORMOUS breath: chest "
               "puffed out like a balloon, cheeks puffed, eyes closed, determined, tie lifted up by his big "
               "chest. Stall walls behind him. His face is a little above the middle of the image.",
         effect="Slow zoom in, then a hard punch-in on \"Louder\".",
         sound="Very long inhale."),
    dict(start=(17, 0), size="extreme close-up (low angle)", key=False, cast=["YOU"], place=BATHROOM,
         scene="Extreme close-up from a low angle: YOU yelling even harder than before, mouth enormous, eyes "
               "squeezed shut, veins on his forehead, beard and hair blasted back, tie flying up, both hands "
               "cupped around his mouth. Stall wall and ceiling light behind him. His face is in the upper half "
               "of the image.",
         effect="Bigger screen shake, fast zoom punch, flash.",
         sound="Second YELL, louder, big echo."),
    dict(start=(17, 1), size="low-angle wide", key=True, cast=[], place=PLACE,
         scene="Low-angle shot looking up at a huge crystal chandelier in the wedding hall, swinging to one "
               "side, crystals flying and sparkling, the guests below ducking with their arms over their heads. "
               "Warm light.",
         effect="Big shake, the chandelier swings.",
         sound="Crystals jingling, chandelier creak, echo of the yell.",
         kling="The big crystal chandelier swings hard from side to side, crystals shaking and sparkling, the "
               "guests below duck. Camera shakes. Keep the low-poly style."),
    dict(start=(18, 0), size="close-up", key=False, cast=[], place=PLACE,
         scene="Close-up of a baby in a tiny white tuxedo onesie sitting in a high chair at a wedding table, "
               "crying loudly: mouth wide open, eyes squeezed shut, big blue cartoon tears flying from both eyes. "
               "Blurred chandeliers and guests behind. The baby's face is a little above the middle of the "
               "image.",
         effect="Tears fly, small shake.",
         sound="Baby crying (loud, then fades under the voice)."),
    dict(start=(19, 0), size="wide", key=False, cast=[], place=PLACE,
         scene="Calm, wide, symmetrical shot of the long empty hallway of the wedding venue: soft carpet, warm "
               "wall lamps, a few flower vases, and at the very end the closed dark wooden bathroom door. "
               "Peaceful, still, documentary feeling. No people.",
         effect="Calm slow push-in toward the door (the twist starts). Faint green stink lines under the door.",
         sound="Soft calm documentary tone, music gone."),
    dict(start=(20, 0), size="medium", key=False, cast=[], place=None,
         scene="A cute small 5-year-old kid with chubby cheeks, in a yellow t-shirt and blue shorts, standing in "
               "a bright clean bathroom, proudly holding a white toilet paper roll high above his head with both "
               "hands like a golden trophy, huge proud smile, eyes closed with pride. Sparkles and golden light "
               "around the roll. PLACE: a bright, clean, colorful kids' bathroom with blue tiles.",
         effect="Sparkles, slow push-in, a little proud bounce.",
         sound="Heavenly \"aaah\" choir sting / sparkle."),
    dict(start=(20, 8), size="medium", key=False, cast=[], place=None,
         scene="Two little kids (about five and six years old) standing on a small three-step winners' podium "
               "with no numbers on it, wearing gold medals, each holding up a white toilet paper roll like a "
               "trophy, confetti falling, proud happy faces. PLACE: a bright, clean, colorful kids' bathroom with "
               "blue tiles.",
         effect="Confetti, slow zoom.",
         sound="Small kids' cheer \"yay\", party popper."),
    dict(start=(21, 0), size="low-angle close-up", key=False, place=BATHROOM,
         scene="Same low-angle shot from the marble floor as before: the closed dark-wood toilet stall door, and "
               "under it the man's shiny black leather shoes and navy-blue suit trouser legs, sitting completely "
               "still. Clean cream marble floor, quiet, a bit colder light.",
         effect="Hard cut back, slow push-in, small green stink lines over the door.",
         sound="Silence. One drip."),
    dict(start=(22, 0), size="high-angle wide", key=False, cast=["GROOM", "BRIDE", "UNCLES", "GRANDPA"],
         place=PLACE,
         scene="High-angle wide shot from above: the whole family in their fancy wedding clothes standing in a "
               "tight circle in the middle of the empty wooden dance floor, dead serious, each with one fist "
               "held out in front of them toward the center, under a single dramatic spotlight. The rest of the "
               "hall is dark. The GROOM in the white suit, the BRIDE, the three UNCLES and GRANDPA are in the "
               "circle with other relatives.",
         effect="Slow dramatic push-in, the lights dim.",
         sound="Dramatic war drums start."),
    dict(start=(23, 0), size="extreme close-up", key=False, cast=[], place=PLACE,
         scene="Extreme close-up of many fists in a circle, all pointing to the center, held tight and ready to "
               "play rock-paper-scissors: suit sleeves of different colors (white, grey, navy, brown cardigan), "
               "gold cufflinks, a wedding ring. Dramatic spotlight from above, dark background.",
         effect="Punch-in on every drum hit, small shake.",
         sound="DRUM HIT on \"Rock\"."),
    dict(start=(24, 0), size="extreme close-up", key=False, cast=["UNCLES", "GRANDPA"], place=PLACE,
         scene="Extreme close-up of the serious faces in the circle, side by side, lit from below by a dramatic "
               "spotlight: an UNCLE with a thick mustache and a big sweat drop, and GRANDPA squinting behind his "
               "big round glasses, both staring down at the fists, very intense, like a movie duel. Dark "
               "background. Faces in the upper half of the image.",
         effect="Two hard punch-ins: on \"Paper\" and on \"Scissors\".",
         sound="DRUM HIT on \"Paper\", DRUM HIT on \"Scissors\"."),
    dict(start=(26, 0), size="top-down close-up", key=False, cast=[], place=PLACE,
         scene="Top-down view of the center of the circle: about eight hands held out, ALL of them showing a "
               "closed fist (rock), suit sleeves of different colors around them, the shiny wooden dance floor "
               "far below. Dramatic spotlight.",
         effect="Locked camera, small punch-in.",
         sound="Low \"dun\"."),
    dict(start=(27, 0), size="close-up", key=False, cast=["GROOM"], place=PLACE,
         scene="Close-up of the GROOM in the circle, under the spotlight, slowly realizing: eyes wide, mouth a "
               "small \"o\", a big sweat drop sliding down his forehead, the red rose in his pocket. Dark "
               "background. His face is a little above the middle of the image.",
         effect="Slow zoom in through the long dramatic pause, colors drain.",
         sound="Drum roll, then a heartbeat in the pause."),
    dict(start=(28, 0), size="extreme close-up (slow motion)", key=True, cast=["GROOM"], place=PLACE,
         scene="Extreme close-up, slow-motion feeling: among many closed fists (rock), one hand in a white suit "
               "sleeve with a gold cufflink and a wedding ring shows SCISSORS (index and middle finger in a V). "
               "Dramatic spotlight on that one hand, dust in the light, dark background.",
         effect="Slow motion push-in, a white flash on \"scissors\".",
         sound="Big dramatic \"DUN DUN DUNNN\" sting, then a gasp.",
         kling="In slow motion, the hand in the white sleeve opens two fingers into scissors while all the other "
               "fists stay closed. Very slow camera push-in. Keep the low-poly style."),
    dict(start=(29, 0), size="medium", key=False, cast=["GROOM", "BRIDE", "UNCLES"], place=PLACE,
         scene="Medium shot of the circle from behind the GROOM's shoulder: everyone in the circle (the BRIDE, the "
               "three UNCLES and other relatives) has turned their heads and is staring straight at the GROOM, "
               "blank faces, the BRIDE's arms crossed. Spotlight on the groom.",
         effect="Quick punch-in on \"wedding day\".",
         sound="Crowd \"ooooh\"."),
    dict(start=(30, 0), size="wide (slow motion)", key=True, cast=["GROOM"], place=PLACE,
         scene="Wide shot from behind: the GROOM in his white wedding suit walking away down the long, empty "
               "wedding hall toward the bathroom door at the far end, slow motion, a single white spotlight "
               "following him, red rose petals falling from above. The guests stand on both sides of the aisle. "
               "Dark hall, warm chandelier glow.",
         effect="Slow motion, slow push-in, petals falling.",
         sound="Slow heavy footsteps, sad violin starts.",
         kling="The groom slowly walks away down the long hall toward the bathroom door in slow motion, red rose "
               "petals falling around him, the spotlight follows him. Slow camera push-in. Keep the low-poly "
               "style."),
    dict(start=(31, 0), size="medium", key=False, cast=["UNCLES", "GRANDPA"], place=PLACE,
         scene="Medium shot of a row of guests standing at the side of the aisle: the three UNCLES and GRANDPA "
               "saluting like soldiers with their right hands at their foreheads, chins up, proud, tears in "
               "their eyes. Rose petals falling in front of them, warm light.",
         effect="Slow push-in, falling petals.",
         sound="Footsteps continue, sad violin."),
    dict(start=(32, 0), size="medium close-up", key=False, cast=["DJ"], place=PLACE,
         scene="Medium close-up of the DJ behind his DJ table, crying quietly with big blue cartoon tears, one "
               "hand on his heart, the other slowly pressing a button on his laptop. Blue sad light instead of "
               "party colors. His face is a little above the middle of the image.",
         effect="Slow push-in, tears drip, blue tint.",
         sound="Slow sad violin music (the \"sad song\")."),
    dict(start=(33, 0), size="wide (ending)", key=False, cast=["BRIDE"], place=PLACE, pause_cut=0.50,
         scene="The BRIDE standing alone in the middle of the empty dance floor, holding a big white three-layer "
               "wedding cake with both hands, blank sad face. Behind her, a big golden banner hanging on the wall "
               "that reads \"Just Married\" (the only words in the image). Empty tables and chairs around her, a "
               "few rose petals on the floor, chandeliers glowing. On the far right, the hallway and the closed "
               "bathroom door.",
         effect="Ending like the plane in the reference: green stink lines rising from the bathroom door, green "
                "haze creeping over the hall, slow zoom out.",
         sound="Sad violin ends, quiet hall, a distant toilet flush at the very end."),
]

norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def line_words(li):
    return [w for w in WORDS if w["line"] == li]


def who_in(o):
    names = list(o.get("cast") or [])
    return [CAST[n] for n in names if n in CAST]


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
            shown = re.sub(r"[,.:;]+$", "", p)
            t = lines[li]["start"] if k == 0 else ws[k]["s"]
            chunks.append({"text": shown, "line": li, "who": lines[li]["who"], "t": t,
                           "end": ws[k + n - 1]["e"]})
            k += n
    starts = []
    for i, s in enumerate(SHOTS):
        li, wi = s["start"]
        if s.get("pause_cut") is not None:      # last shot: cut inside the long pause
            starts.append(round(lines[li - 1]["end"] + s["pause_cut"], 2))
        else:
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
                    "cast": s.get("cast") or [], "place": s.get("place"),
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


def words_note(shots):
    """Which shots are allowed to show words (a card / banner the story needs)."""
    found = []
    for o in shots:
        if "the only words in the image" in o["scene"]:
            m = re.search('reads "([^"]+)"', o["scene"])
            found.append(f'shot {o["id"]:02d} has words: "{m.group(1)}"')
    return " and ".join(found)


def write_md(shots):
    key = [o for o in shots if o["key"]]
    L = []
    L.append("# Wedding reel - image prompts (\"MOM! I'M DONE!\")\n")
    L.append(f"Reel: 1080x1920, 30 fps, {END:.1f} s, {len(shots)} shots. Voiceover is done "
             "(`audio/voiceover.mp3`, Nassim, same voice and settings as the last reels).\n")
    L.append("## How to use\n")
    L.append("1. Open ONE new ChatGPT chat. Paste the **character sheet** prompt first.")
    L.append("2. Then paste the shot prompts one by one, in order, in the same chat (so the characters stay the same).")
    L.append("3. Save each image as `shot_01.png`, `shot_02.png` ... (or just send them to me in order).")
    L.append(f"4. For the **{len(key)} KEY shots** (marked with a star), also make a Kling clip from that image "
             "(image-to-video, 9:16, 5 s) with the short Kling prompt. Save as `shot_05.mp4` etc. "
             "I only use the best 1-2 seconds of each clip, so a 5 s clip is plenty. If you skip a clip, I animate "
             "the image instead.")
    L.append("5. Send me the images and clips. I build `final.mp4` after that (zooms, shake, captions, effects, sound).\n")
    L.append("Tips: if a face drifts, reply \"Same character as the character sheet, match the face exactly.\" "
             "If text or letters appear in an image, reply \"Same image with no text.\" (Only " + words_note(shots)
             + ".) "
             "Captions, stink lines, sweat drops, tears, shake and flashes are added by me in the edit, "
             "so they are not needed in the images (except where a prompt asks for tears).\n")
    L.append("## Characters and place\n")
    for v in CAST.values():
        L.append(f"- {v.split(' (same as the character sheet)')[0]}{v.split('(same as the character sheet)')[1]}")
    L.append("- MOM: never shown, only her empty chair.")
    L.append(f"- {PLACE}")
    L.append(f"- {BATHROOM}\n")
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
        who = who_in(o)
        style = STYLE
        if "the only words in the image" in o["scene"]:
            style = STYLE.replace("no text.", "no other text.")
        body = style + "\n\n" + o["scene"] + ("\n\n" + " ".join(who) if who else "") + \
            ("\n\n" + o["place"] if o["place"] else "")
        L.append("```\n" + body + "\n```\n")
        L.append(f"- **Caption:** " + " → ".join(f"\"{c['text']}\" ({c['t']:.2f}s)" for c in o["captions"]))
        L.append(f"- **Effect:** {o['effect']}")
        L.append(f"- **Sound:** {o['sound']}")
        if o["kling"]:
            L.append(f"- **Kling (image-to-video, 9:16, 5 s):** `{o['kling']}`")
        L.append("")
    open(os.path.join(HERE, "prompts.md"), "w").write("\n".join(L))


if __name__ == "__main__":
    main()
