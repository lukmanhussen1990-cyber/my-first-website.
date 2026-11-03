"""Shot plan for the plumber reel -> prompts.md (for ChatGPT / Kling) and shots.json (for the final build).

Same method as gardyloo_reel/plan.py: every shot starts 0.12 s before its first voice word (a cut just ahead of
the word), so the shots fill the whole voiceover with no gaps. Caption chunks are 2-4 words and start on the
first word they show. Shots inside a pause start at "after" = (line, seconds after that line ends), or at "at"
= an absolute time.
Run:  python3 plan.py      (needs audio/voiceover.words.json + audio/vo_lines.json from import_voiceover.py)
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
    "YOU": ("YOU (same as the character sheet): a young guy about twenty, light-brown skin, messy dark-brown "
            "hair, a plain orange t-shirt, blue shorts, white socks, very nervous face."),
    "FRIEND": ("FRIEND (same as the character sheet): a young guy the same age, a red baseball cap, a grey "
               "hoodie, jeans, worried face."),
    "MOM": ("HIS MOM (same as the character sheet): a woman in her forties, brown hair in a bun, a green "
            "cardigan with a yellow apron, a phone at her ear, worried face."),
    "DAD": ("HIS DAD (same as the character sheet): a big broad man in his forties, short black hair, a thick "
            "black mustache, a blue checked shirt, arms crossed, serious face."),
    "SIS": ("LITTLE SISTER (same as the character sheet): a small girl about six, two pigtails, a pink dress, "
            "hugging a brown teddy bear."),
    "GRANDMA": ("GRANDMA (same as the character sheet): a tiny old woman with white hair in a bun, round "
                "glasses, a lilac cardigan, sitting in a wheelchair, calm, holding a cup of tea on a saucer."),
    "PLUMBER": ("PLUMBER (same as the character sheet): an older man about sixty, a thick grey mustache, blue "
                "work overalls over a white t-shirt, a blue cap, a red metal toolbox, very serious face."),
}
HOUSE = ("PLACE: the friend's cosy two-storey family house with light-blue walls, white window frames, a green "
         "front door, a front lawn, one small upstairs bathroom window. Warm sunset light.")
BATH = ("PLACE: a small cosy bathroom: pale-yellow square tiles, a white toilet with a chrome flush button on top "
        "of the tank, a plunger standing in the corner, a small round mirror, a framed picture of a duck on the "
        "wall, one ceiling lamp.")
HALL = ("PLACE: the upstairs hallway of the family house: wooden floor, warm cream walls with family photos, "
        "the white bathroom door at the end, soft warm lamp light.")
MUSEUM = ("PLACE: a quiet old museum hall with tall stone columns and a polished floor, warm sepia old-photo "
          "colours, like an old film.")

CHAR_SHEET = (
    "CHARACTER SHEET. Low-poly blocky 3D video game render, PS1 / Roblox look: chunky faceted shapes with "
    "visible flat polygons, slightly pixelated low-resolution textures (pixel noise on hair and clothes), "
    "realistic proportions with simple blocky heads, small black square dot eyes, short block eyebrows and a "
    "tiny simple mouth. Soft realistic lighting with soft shadows. Silly and funny, everyone fully dressed.\n\n"
    "Character lineup on a plain light grey background, wide landscape image, everyone standing in one row, "
    "front view, full body, no text, no labels, no numbers.\n\n"
    "From left to right:\n"
    "1. \"YOU\": a young guy about twenty, light-brown skin, messy dark-brown hair, plain orange t-shirt, blue "
    "shorts, white socks, sneakers. Very nervous face.\n"
    "2. \"FRIEND\": a young guy the same age, red baseball cap, grey hoodie, jeans. Worried face.\n"
    "3. \"HIS MOM\": a woman in her forties, brown hair in a bun, green cardigan, yellow apron, holding a phone "
    "to her ear. Worried face.\n"
    "4. \"HIS DAD\": a big broad man in his forties, short black hair, thick black mustache, blue checked shirt, "
    "arms crossed. Serious face.\n"
    "5. \"LITTLE SISTER\": a small girl about six, two pigtails, pink dress, hugging a brown teddy bear.\n"
    "6. \"GRANDMA\": a tiny old woman with white hair in a bun, round glasses, lilac cardigan, sitting in a "
    "wheelchair, holding a cup of tea on a saucer. Calm smile.\n"
    "7. \"PLUMBER\": an older man about sixty, thick grey mustache, blue work overalls over a white t-shirt, "
    "blue cap, holding a red metal toolbox. Very serious face.\n\n"
    "Below the row, a close-up of YOU's head and shoulders, front view, with a very nervous face and one sweat "
    "drop.")

# Caption chunks per voice line (2-4 words, exact script words; trailing , . : are dropped on screen)
CHUNKS = {
    1: ["You just shit", "so hard", "at your", "friend's house…"], 2: ["it doesn't fit."], 3: ["You flush."],
    4: ["Nothing."], 5: ["You flush again."], 6: ["It doesn't even move."], 7: ["It's just…", "sitting there."],
    8: ["Looking at you."], 9: ["You grab", "the plunger."], 10: ["The plunger breaks."],
    11: ["Your friend knocks."], 12: ["\"Bro, you good?\""], 13: ["You say:", "\"Yeah.\""],
    14: ["You are not good."], 15: ["His mom calls", "a plumber."],
    16: ["The whole family", "waits outside", "the door."], 17: ["Even grandma."], 18: ["The plumber arrives."],
    19: ["He walks in."], 20: ["He looks down."], 21: ["He takes off", "his cap."],
    22: ["He's been a plumber", "for thirty years."], 23: ["He's never seen this."],
    24: ["What you don't know:"], 25: ["the biggest", "fossil human poop", "ever found"],
    26: ["is about", "twenty centimetres", "long."], 27: ["It's over", "a thousand years old."],
    28: ["And it's kept", "in a museum."], 29: ["The plumber", "pulls out a ruler."], 30: ["Then a bigger ruler."],
    31: ["Then he takes a photo."], 32: ["\"Kid…"], 33: ["I think you", "broke the record.\""],
}

# Every bowl shot shows the big cartoon poop (poop-emoji style, with dot eyes) + green stink lines.
CENSOR = (" Sticking up out of the bowl: a comically huge cartoon poop like the poop emoji (a shiny brown swirl with "
          "a curly tip and two big dot eyes), much too big for the bowl.")

# One entry per shot. "start" = (line, word index in that line) where the shot's voice starts;
# "after" = (line, seconds after that line's last word); "at" = absolute start time (s).
SHOTS = [
    dict(start=(1, 0), size="extreme close-up", key=True, cast=["YOU"], place=BATH,
         scene="Extreme close-up of YOU sitting on the toilet (only his face and shoulders are seen, fully "
               "dressed), straining as hard as he can: face bright red, two veins on his forehead, eyes squeezed "
               "shut, teeth clenched. The ceiling lamp above him flickers. His face fills the upper half.",
         effect="Strong screen shake that grows, the light flickers (flashes), slow push-in, red tint.",
         sound="Straining grunt, light flicker buzz.",
         kling="He strains harder and harder, his face shakes, the ceiling light flickers on and off. Keep the "
               "low-poly style."),
    dict(start=(1, 5), size="medium", key=False, cast=[], place=BATH,
         scene="The framed picture of a duck on the pale-yellow tiled bathroom wall shaking and falling off its "
               "nail, tilted in mid-air, little bits of dust around it.",
         effect="Shake, the picture drops, a hard punch-in on \"house\".",
         sound="Wall rattle, the picture frame falls and crashes."),
    dict(start=(2, 0), size="close-up (looking down)", key=False, cast=[], place=BATH,
         scene="Close-up looking straight down into the white toilet bowl from above, seat up." + CENSOR,
         effect="Hard cut to the HUGE cartoon poop, too big for the bowl, green stink lines rise, "
                "three punch-ins on dun-dun-DUNNN.",
         sound="Deep \"dun dun DUNNN\" sting."),
    dict(start=(3, 0), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of YOU's finger pressing the round chrome flush button on top of the white toilet "
               "tank. Orange t-shirt sleeve at the edge.",
         effect="Punch-in as the button goes down.",
         sound="Flush button click, a big flush."),
    dict(start=(4, 0), size="close-up (looking down)", key=False, cast=[], place=BATH,
         scene="Close-up looking down into the bowl, the water swirling around in a circle." + CENSOR,
         effect="The poop does not move at all while the water spins. Stink lines.",
         sound="Flush swirl dies down."),
    dict(start=(5, 0), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of YOU's thumb pressing the chrome flush button really hard, the thumb bent, the "
               "tank shaking a little.",
         effect="Two fast punch-ins (click click), small shake.",
         sound="Click click, weak flush."),
    dict(start=(6, 0), size="close-up (looking down)", key=False, cast=[], place=BATH,
         scene="Close-up looking down into the bowl, the water barely moving, a few sad bubbles." + CENSOR,
         effect="The poop still does not move. Slow push-in. Stink lines.",
         sound="Sad gurgle."),
    dict(start=(7, 0), size="medium", key=False, cast=["YOU"], place=BATH,
         scene="Medium shot of YOU standing next to the toilet, looking down into it with a completely blank "
               "deadpan face, shoulders down, arms hanging.",
         effect="Static, slow push-in, one sweat drop.",
         sound="Silence, a fly buzzing far away."),
    dict(start=(8, 0), size="low angle", key=False, cast=["YOU"], place=BATH,
         scene="Low close-up at the toilet: the big cartoon poop in the bowl looking straight at the camera with its "
               "two dot eyes." + CENSOR,
         effect="The poop stares at the camera and blinks. Stink lines.",
         sound="Tiny cartoon \"blink\"."),
    dict(start=(8, 2), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of YOU's horrified face: eyes huge, mouth open in a silent scream, eyebrows up.",
         effect="Quick zoom in, shake.",
         sound="Horror sting \"eeek\"."),
    dict(start=(9, 0), size="medium", key=False, cast=["YOU"], place=BATH,
         scene="Medium shot of YOU grabbing the wooden plunger from the corner with both hands, holding it up "
               "like a sword, brave serious face.",
         effect="Punch-in on \"plunger\".",
         sound="Heroic little \"ting\", whoosh."),
    dict(start=(10, 0), size="medium close-up", key=True, cast=["YOU"], place=BATH,
         scene="Medium close-up of YOU pushing the plunger into the toilet with all his strength, red face, the "
               "wooden handle bending in the middle." + CENSOR,
         effect="Shake grows, then a snap on \"breaks\".",
         sound="Plunger squelch pumps, wood creaks, then a loud CRACK.",
         kling="He pushes the plunger down hard again and again, the wooden handle bends and snaps in half. "
               "Keep the low-poly style."),
    dict(at=14.3, size="medium close-up", key=False, cast=["YOU"], place=BATH,
         scene="Medium close-up of YOU holding up the broken plunger stick (just the wooden half) in front of his "
               "face, staring at it in disbelief.",
         effect="Static, tiny zoom.",
         sound="A tiny piece of wood drops (tick)."),
    dict(start=(11, 0), size="extreme close-up", key=False, cast=["FRIEND"], place=HALL,
         scene="Extreme close-up of FRIEND's knuckles knocking on the white bathroom door, hallway behind.",
         effect="Small punch-ins on each knock.",
         sound="Three knocks."),
    dict(start=(12, 0), size="close-up", key=False, cast=["FRIEND"], place=HALL,
         scene="Close-up of FRIEND's face pressed flat against the white bathroom door from the outside, his ear "
               "on the door, listening, worried eyes, cap a little crooked.",
         effect="Slow push-in.",
         sound="Muffled voice feel."),
    dict(start=(13, 0), size="medium", key=False, cast=["YOU"], place=BATH,
         scene="Medium shot of YOU sitting on the bathroom floor with his back against the door, hugging his "
               "knees, a fake calm smile and a thumbs-up, lots of sweat drops, the broken plunger next to him.",
         effect="Static; on \"Yeah\" a tiny punch-in.",
         sound="Quiet room tone."),
    dict(start=(14, 0), size="extreme close-up", key=False, cast=["YOU"], place=BATH,
         scene="Extreme close-up of YOU's eyes only: wide open, panicked, pupils shaking, sweat on his forehead.",
         effect="Slow zoom in on the eyes, small shake.",
         sound="Heartbeat."),
    dict(start=(15, 0), size="medium close-up", key=False, cast=["MOM"], place=HALL,
         scene="Medium close-up of HIS MOM in the hallway with a phone at her ear, the other hand on her cheek, "
               "very worried face.",
         effect="Slow push-in.",
         sound="Phone dialing beeps."),
    dict(start=(16, 0), size="wide", key=False, cast=["FRIEND", "MOM", "DAD", "SIS"], place=HALL,
         scene="Wide shot of the hallway: FRIEND, HIS MOM on the phone, HIS DAD with his arms crossed and LITTLE "
               "SISTER hugging her teddy bear all standing in a row, staring at the closed bathroom door.",
         effect="Slow sideways pan along the row of faces.",
         sound="Awkward silence, a clock ticking."),
    dict(start=(17, 0), size="medium", key=False, cast=["GRANDMA"], place=HALL,
         scene="Medium shot of GRANDMA in her wheelchair in the hallway, calmly sipping her cup of tea, staring "
               "at the bathroom door.",
         effect="Slow push-in, punch-in on \"grandma\".",
         sound="A slow tea slurp."),
    dict(start=(18, 0), size="wide", key=False, cast=[], place=HOUSE,
         scene="Wide shot outside the house at sunset: a white plumber's van screeching to a stop in front of the "
               "house, a little dust cloud behind the tyres.",
         effect="Shake as the van stops, speed lines.",
         sound="Van tyre screech."),
    dict(start=(19, 0), size="wide (slow motion)", key=True, cast=["PLUMBER", "FRIEND", "MOM", "DAD", "SIS"],
         place=HALL,
         scene="Low wide shot down the hallway: the PLUMBER walks toward the camera like a movie hero, toolbox in "
               "his hand, the family pressed against the walls on both sides, watching him.",
         effect="Slow-motion feel, slow push-in.",
         sound="Heroic music (brass + drums).",
         kling="The plumber walks slowly toward the camera like a movie hero, the toolbox swinging, the family "
               "watches him. Slow motion. Keep the low-poly style."),
    dict(start=(20, 0), size="close-up (low angle)", key=False, cast=["PLUMBER"], place=BATH,
         scene="Close-up of the PLUMBER from below (seen from the toilet), looking down into the bowl, his face "
               "going pale, eyes wide, mustache drooping.",
         effect="Slow push-in, the colour drains (desaturate).",
         sound="Music cuts out, a low drone."),
    dict(start=(21, 0), size="medium close-up", key=True, cast=["PLUMBER"], place=BATH,
         scene="Medium close-up of the PLUMBER slowly taking off his blue cap and holding it against his chest "
               "like at a funeral, eyes closed, sad respectful face.",
         effect="Very slow push-in.",
         sound="Sad trumpet.",
         kling="The plumber slowly takes off his cap and holds it to his chest, lowering his head with respect. "
               "Keep the low-poly style."),
    dict(start=(22, 0), size="medium (flashback)", key=False, cast=["PLUMBER"], place=None,
         scene="Flashback: a younger PLUMBER (dark mustache) lying under a kitchen sink fixing the pipes with a "
               "big wrench, proud face. Warm old-photo colours.",
         effect="Old photo filter (sepia, grain, vignette), slow zoom.",
         sound="Old film projector rattle, soft nostalgic music."),
    dict(start=(22, 5), size="medium (flashback)", key=False, cast=["PLUMBER"], place=None,
         scene="Flashback: the PLUMBER in the middle of a kitchen, a pipe bursting and spraying water everywhere, "
               "he is holding it with both hands, soaking wet but calm. Warm old-photo colours.",
         effect="Old photo filter, shake.",
         sound="Water spray hiss."),
    dict(start=(23, 0), size="extreme close-up", key=False, cast=["PLUMBER"], place=BATH,
         scene="Extreme close-up of the PLUMBER's shocked face, back in normal colours: eyes very wide, one sweat "
               "drop, mustache trembling.",
         effect="Snap back to colour, punch-in on \"never\".",
         sound="Record scratch, a shocked sting."),
    dict(start=(24, 0), size="wide (old film)", key=False, cast=[], place=MUSEUM,
         scene="Wide shot of a grand quiet museum hall with tall stone columns, a polished floor and a single glass "
               "display case in the middle under a spotlight.",
         effect="Old film look (sepia, grain, scratches), slow push-in.",
         sound="Museum echo, footsteps, soft choir."),
    dict(start=(25, 0), size="close-up (old film)", key=False, cast=[], place=MUSEUM,
         scene="Close-up of the glass display case under a bright spotlight: inside, on a little velvet stand, a "
               "small dark-brown rock-like fossil (very simple cartoon shape, blurry, looks like a stone), and a "
               "small blank label card.",
         effect="Old film look, slow push-in, a soft glow.",
         sound="Choir \"aaah\"."),
    dict(start=(26, 0), size="extreme close-up (old film)", key=False, cast=[], place=MUSEUM,
         scene="Extreme close-up inside the glass case: a small wooden ruler lying next to the little brown "
               "stone-like fossil, measuring it.",
         effect="Old film look, slow pan along the ruler.",
         sound="Tiny \"ding\" on \"twenty\"."),
    dict(start=(27, 0), size="medium (old film)", key=False, cast=[], place=MUSEUM,
         scene="Medium shot of three museum visitors (an old man with a monocle and a cane, a lady in a hat, a "
               "kid) leaning toward the glass case, looking at it very seriously, hands behind their backs.",
         effect="Old film look, slow push-in.",
         sound="A polite \"hmm\" murmur."),
    dict(start=(28, 0), size="wide (old film)", key=False, cast=[], place=MUSEUM,
         scene="Wide shot of the museum hall from high up: the glass case in the spotlight, a guard standing next "
               "to it, red velvet rope barriers around it.",
         effect="Old film look, slow zoom out.",
         sound="Museum echo, choir fades."),
    dict(start=(29, 0), size="medium", key=False, cast=["PLUMBER"], place=BATH,
         scene="Medium shot of the PLUMBER kneeling next to the toilet, holding up a tiny 15 cm school ruler, "
               "looking from the ruler to the bowl, serious face." + CENSOR,
         effect="Stink lines on the poop. Punch-in on the tiny ruler.",
         sound="Record scratch back to now, a tiny \"ting\"."),
    dict(start=(30, 0), size="medium (zoom out)", key=True, cast=["PLUMBER"], place=BATH,
         scene="Medium shot of the PLUMBER pulling a long yellow builder's measuring tape out of its case across "
               "the bathroom, the tape getting longer and longer, reaching the other wall." + CENSOR,
         effect="Fast zoom out, the tape keeps extending.",
         sound="Measuring tape zzzzzip.",
         kling="The plumber pulls out a long yellow measuring tape, it keeps extending across the whole room, "
               "camera zooms out. Keep the low-poly style."),
    dict(start=(31, 0), size="medium", key=False, cast=["PLUMBER"], place=BATH,
         scene="Medium shot of the PLUMBER standing over the toilet taking a photo with his phone, very serious "
               "face, holding the phone with both hands." + CENSOR,
         effect="White camera FLASH on \"photo\".",
         sound="Camera shutter + flash whine."),
    dict(start=(32, 0), size="medium close-up", key=False, cast=["PLUMBER", "YOU"], place=BATH,
         scene="Medium close-up: the PLUMBER puts his hand on YOU's shoulder, looking at him proud and emotional, "
               "one single tear on his cheek; YOU looks up at him nervously.",
         effect="Slow push-in on the plumber's face during the long pause, one tear rolls down.",
         sound="Soft emotional piano note."),
    dict(start=(33, 0), size="medium wide", key=True, cast=["PLUMBER", "YOU", "FRIEND", "MOM", "DAD", "SIS"],
         place=BATH,
         scene="Medium wide shot from inside the bathroom: the PLUMBER with his hand on YOU's shoulder, and the "
               "whole family crowded in the open doorway behind them, slowly clapping, the dad nodding, the little "
               "sister holding up her teddy bear.",
         effect="Slow push-in, warm light.",
         sound="Slow clapping that grows into applause, emotional music.",
         kling="The family in the doorway starts clapping slowly, the plumber nods proudly. Keep the low-poly "
               "style."),
    dict(after=(33, 0.4), size="wide (ending)", key=False, cast=[], place=HOUSE,
         scene="Wide shot of the house at sunset from the street, the white plumber's van parked in front, all "
               "quiet, the small upstairs bathroom window glowing.",
         effect="Green wavy stink lines rise out of the bathroom window, slow zoom out (like the plane ending in "
                "the reference), fade out.",
         sound="Applause fades, birds, a far-away flush."),
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
        if "at" in s:
            starts.append(round(s["at"], 2))
        elif "after" in s:
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
    L.append("# Plumber reel - image prompts\n")
    L.append(f"Reel: 1080x1920, 30 fps, {END:.1f} s, {len(shots)} shots. "
             "Voiceover: the user's own recording (`audio/raw/user_voiceover.mp3`), used as it is.\n")
    L.append("## How to use\n")
    L.append("1. Open ONE new ChatGPT chat. Paste the **character sheet** prompt first.")
    L.append("2. Then paste the shot prompts one by one, in order, in the same chat (so the characters stay the same).")
    L.append("3. Save each image as `shot_01.png`, `shot_02.png` ... (or just send them to me in order).")
    L.append(f"4. For the **{len(key)} KEY shots** (marked with a star), also make a Kling clip from that image "
             "(image-to-video, 9:16, 5 s) with the short Kling prompt. Save as `shot_09.mp4` etc. "
             "I only use the best 1-3 seconds of each clip, so a 5 s clip is plenty. If you skip a clip, I animate "
             "the image instead.")
    L.append("5. Send me the images and clips. I build `final.mp4` after that (zooms, shake, captions, effects, sound).\n")
    L.append("Tips: if a face drifts, reply \"Same character as the character sheet, match the face exactly.\" "
             "If text or letters appear in an image, reply \"Same image with no text.\" "
             "Captions, stink lines, sweat drops, shake, the old-photo / sepia looks and flashes are added by me in "
             "the edit, so they are not needed in the images. The poop is a big cartoon poop-emoji swirl with dot "
             "eyes, never realistic.\n")
    L.append("## Characters and places\n")
    for v in CAST.values():
        name, rest = v.split(" (same as the character sheet)")
        L.append(f"- {name}{rest}")
    for p in (HOUSE, BATH, HALL, MUSEUM):
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
