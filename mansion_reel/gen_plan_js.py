"""shots.json + word times -> web/plan.js (the 3D shot plan used by the renderer).

Times stay identical to shots.json. `events` are sync moments (word onsets) that the shots (animation beats) and
make_sfx.py (sound effects) both use.  Run: python3 gen_plan_js.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SH = json.load(open(os.path.join(HERE, "shots.json")))
_ON = os.path.join(HERE, "audio", "word_onsets.json")   # acoustic word onsets from make_captions.py (best)
WORDS = json.load(open(_ON if os.path.exists(_ON) else os.path.join(HERE, "audio", "voiceover.words.json")))
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))
norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower())


def word(line, w, nth=0):
    ws = [x for x in WORDS if x["line"] == line]
    hits = [i for i, x in enumerate(ws) if norm(x["w"]) == norm(w)]
    i = hits[nth]
    return VO["lines"][line - 1]["start"] if i == 0 else ws[i]["s"]


def wend(line, w, nth=0):
    ws = [x for x in WORDS if x["line"] == line]
    hits = [i for i, x in enumerate(ws) if norm(x["w"]) == norm(w)]
    return ws[hits[nth]]["e"]


D = {
 1: ("STREET. YOU (homeless: beanie, patched coat, stubble) sits on flattened cardboard against a brick wall, a tin cup "
     "beside him, pigeons pecking. Medium shot, slow push-in. Sad, tired face.", {}),
 2: ("STREET close-up: YOU's eyes go wide, he clutches his stomach with both hands, stomach rumble lines, sweat drop. "
     "Punch-in at 'poop'.", {"clutch": word(2, "need"), "rumble": word(2, "poop")}),
 3: ("STREET: YOU at a cafe door; the cafe owner (bald, moustache, apron) stands in the doorway and points at the "
     "'CUSTOMERS ONLY' sign on the door. YOU seen from the side, desperate.", {"point": word(3, "says")}),
 4: ("STREET: camera tracks sideways along the shop row: pizza chef and store clerk in their doorways, each with the "
     "same 'CUSTOMERS ONLY' sign, crossing arms / pointing at the sign on 'customers' and 'only'.",
     {"no1": word(3, "customers"), "no2": word(3, "only")}),
 5: ("MANSION porch close-up: YOU's fist knocks twice on the huge golden door (lion knocker).",
     {"knocks": [word(4, "knock") - 0.12, word(4, "knock") + 0.1]}),
 6: ("MANSION porch from behind YOU (low): YOU is tiny in front of a giant golden double door (4x his height) at the "
     "top of marble steps; he knocks once more on 'door'.", {"knock": word(4, "door")}),
 7: ("MANSION exterior: crane up and back: huge white mansion with columns, gold trim, fountain, palm trees, sunset; "
     "YOU tiny at the door.", {"reveal": word(5, "mansion")}),
 8: ("MANSION porch over YOU's shoulder: the giant doors swing open inward on 'opens', golden light floods out over "
     "YOU, flash + sparkles.", {"open": word(6, "opens") - 0.1}),
 9: ("DOORWAY from YOU's eye level (low angle): the rich guy stands in the doorway, backlit gold, moustache, slicked "
     "hair, holding a tiny espresso cup, looking down. Glint on 'rich'.", {"glint": word(7, "rich")}),
 10: ("DOORWAY: camera tilts up from fluffy gold slippers along the shiny gold bathrobe to his smug face; sparkles "
      "on 'gold'.", {"gold": word(8, "gold")}),
 11: ("PORCH close-up of YOU: desperate, says 'Toilet.' (talking), hands together.", {"say": word(9, "toilet")}),
 12: ("PORCH extreme close-up: YOU begging, huge sparkly puppy eyes, wobbly mouth, hands pressed together: 'Please.'",
      {"please": word(9, "please")}),
 13: ("DOORWAY: the rich guy points into the house (his left), the hallway behind him.", {"point": word(10, "points")}),
 14: ("HALLWAY from the front door: dolly-zoom: the hallway stretches endlessly, gold walls, chandeliers, red carpet.",
      {"long": word(11, "long")}),
 15: ("HALLWAY: slow slide past gold statues, gold vases, gold picture frames, chandeliers, glints on 'gold'.",
      {"gold": word(12, "gold")}),
 16: ("HALLWAY: YOU runs toward camera (waist-up, camera backing away fast), coat flapping, speed lines.",
      {"run": word(13, "run")}),
 17: ("BATHROOM: push in on the golden toilet on a marble platform with a control panel of 30 coloured buttons; buttons "
      "blink on 'thirty'.", {"thirty": word(14, "thirty"), "buttons": word(14, "buttons")}),
 18: ("BATHROOM: YOU sitting on the toilet (waist up, panel in the foreground), eyes dart between buttons, question "
      "marks pop.", {"q1": word(15, "which"), "q2": word(15, "flushes")}),
 19: ("BATHROOM close-up: both hands mash all the buttons fast, buttons light up.",
      {"press": word(16, "press"), "all": word(16, "all")}),
 20: ("BATHROOM: a huge water jet shoots up from the toilet to the ceiling, splash spreads, YOU's beanie flies off, "
      "YOU shocked. Low angle.", {"spray": word(17, "water") - 0.08, "ceiling": word(17, "ceiling")}),
 21: ("BATHROOM: disco ball drops from the ceiling, coloured lights, music notes; YOU deadpan in the indoor rain.",
      {"music": word(18, "music")}),
 22: ("BATHROOM: the toilet seat spins YOU around like a turntable, dizzy swirl.", {"spin": word(19, "seat")}),
 23: ("BATHROOM: the door opens, the rich guy walks in (music + lights still going).", {"door": word(20, "walks") - 0.2}),
 24: ("BATHROOM: YOU soaking wet, flat hair, drips from nose and chin, deadpan, holding still; drizzle.", {}),
 25: ("BATHROOM close-up of the rich guy: blank stare; the music stops with a record scratch, lights go normal.",
      {"scratch": word(22, "stares")}),
 26: ("BATHROOM: he bursts out laughing, head back, belly shaking.", {"laugh": word(23, "laughs")}),
 27: ("BATHROOM: laughing so hard tears spray from his eyes, bent over, slapping his knee.", {"cry": word(24, "cries")}),
 28: ("BATHROOM close-up of YOU: looks at him, face softens, blush, warm glow.", {"blush": word(25, "something")}),
 29: ("BATHROOM: a glowing pixel heart beats in YOU's chest, his hand on his heart.", {"beat": word(26, "heart")}),
 30: ("BATHROOM: YOU looks down at his stomach (hand on belly, little rumble) then the heart beats again.",
      {"stomach": word(27, "stomach"), "time": word(27, "this")}),
 31: ("BATHROOM: YOU stands stiff and perfectly straight, a spirit level balanced on his head, bubble centred.",
      {"level": word(28, "straight")}),
 32: ("BATHROOM close-up: the bubble in the level slowly drifts off-centre; YOU's eyes drift with it. Hold.",
      {"drift": word(29, "think")}),
 33: ("NYC: calm high aerial of the New York skyline at sunset, park in front. Slow push.", {"dun": VO["lines"][29]["start"]}),
 34: ("ZOO: penguin enclosure (rocks, blue pool), New York skyscrapers behind the trees.", {}),
 35: ("ZOO: two male chinstrap penguins side by side on the rocks; each turns to camera on its name.",
      {"two": word(31, "two"), "roy": word(31, "roy"), "silo": word(31, "silo")}),
 36: ("ZOO: the two penguins look at each other, a pink heart pops between them, flippers touch.", {"love": word(32, "love")}),
 37: ("ZOO: an egg on a stone nest between them wobbles, cracks, a fluffy grey chick pops out; both look down proudly.",
      {"crack": word(33, "baby"), "hatch": word(33, "penguin"), "together": word(33, "together")}),
 38: ("BATHROOM: the rich guy hands wet YOU a fluffy white towel (lands on his shoulders).", {"towel": word(34, "towel")}),
 39: ("BATHROOM: a steaming coffee mug goes into YOU's hands.", {"coffee": word(35, "coffee")}),
 40: ("BATHROOM close-up: a golden key drops into YOU's palm, sparkle.", {"key": word(36, "key")}),
 41: ("MANSION exterior time-lapse: sun and moon fly over, days pass, lights in the windows flicker on and off.",
      {"never": word(37, "never")}),
 42: ("HALLWAY: the rich guy presents a door with a big arm sweep; YOU next to him in a matching gold bathrobe.",
      {"present": word(38, "bathroom")}),
 43: ("HALLWAY close-up: gold plaque on the door reads 'YOU', sparkle.", {"name": word(39, "name")}),
 44: ("YOUR BATHROOM: the door opens on a golden toilet with ONE big button; YOU and the rich guy in matching robes. "
      "Hold to the end.", {"welcome": VO["lines"][39]["start"]}),
}


def main():
    out = []
    for s in SH["shots"]:
        desc, ev = D[s["id"]]
        ev = {k: (round(v, 3) if isinstance(v, (int, float)) else [round(x, 3) for x in v]) for k, v in ev.items()}
        out.append({"id": f"s{s['id']:02d}", "name": s["name"], "t0": s["t0"], "t1": s["t1"], "say": s["voice"],
                    "desc": desc, "events": ev, "captions": [{"text": c["text"], "t": round(c["t"], 3)} for c in s["captions"]]})
    js = ["// Shot plan (generated by gen_plan_js.py from shots.json - do not edit by hand).",
          "// Times are seconds in the final video (30 fps). `say` = what the voice says during the shot. `events` = sync",
          "// moments (also used by make_sfx.py). Hard cuts between all shots.",
          f"export const DURATION = {SH['duration']};   // seconds (= voiceover length, frame-rounded)",
          "export const PLAN = " + json.dumps(out, indent=1) + ";",
          "export function shotAt(t) { for (const s of PLAN) if (t < s.t1) return s; return PLAN[PLAN.length - 1]; }",
          ""]
    open(os.path.join(HERE, "web", "plan.js"), "w").write("\n".join(js))
    for o in out:
        print(o["id"], o["name"], o["t0"], o["t1"], o["events"])


if __name__ == "__main__":
    main()
