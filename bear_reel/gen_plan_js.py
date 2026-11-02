"""shots.json + audio/voiceover.words.json -> web/plan.js (the 3D shot plan used by the renderer).

Times stay identical to shots.json (same cuts as prompts.md). `events` are sync moments (word starts) that the
shots (animation beats) and make_sfx.py (sound effects) both use.
Run: python3 gen_plan_js.py
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
    """start time of word `w` in voice line `line` (first word of a line = exact measured line start)."""
    ws = [x for x in WORDS if x["line"] == line]
    hits = [i for i, x in enumerate(ws) if norm(x["w"]) == norm(w)]
    i = hits[nth]
    return VO["lines"][line - 1]["start"] if i == 0 else ws[i]["s"]


def line_end(line):
    return VO["lines"][line - 1]["end"]


D = {
 1: ("Medium close-up from the front (+Z), a bit to YOU's left: the big pine trunk fills the left third of the frame "
     "(foreground), YOU peeks out from behind it at its right edge: head, shoulders and his right hand on the bark at "
     "shoulder height; the bush hides him from the waist down. Relieved face (eyes 'happy', small 'smile'), pink "
     "cheeks. Faint green stink lines rise from behind the bush from 0.3 s. Slow push-in, punch-in at 'pooped'.",
     {"punch": word(1, "pooped")}),
 2: ("Wide shot from the front-right (~8 m): the big pine in the middle, YOU's head peeking from the right side of the "
     "trunk (small), bushes around the base, the tent visible far behind between trunks. Golden light rays. Faint stink "
     "lines above the bush. Slow lateral pan.", {}),
 3: ("Close-up: YOU holds up an EMPTY cardboard toilet-paper tube in his right hand in front of his face (tube sharp, in "
     "the centre), his face behind it staring blankly ('stare', mouth 'frown'). Punch-in + sweat drop at 'paper'.",
     {"punch": word(3, "paper")}),
 4: ("Close-up of the GIANT fuzzy leaf on the leaf bush, sunset light glowing through it. YOU's hand (red sleeve) "
     "reaches in from frame right, grabs the leaf edge at 'grab', tugs; the leaf tears off and leaves frame up-right.",
     {"grab": word(4, "grab"), "tear": word(4, "leaf") + 0.25}),
 5: ("Medium shot from the front: YOU behind the bush (waist down hidden), frozen, uncomfortable: eyes 'wide', brows "
     "'worried', mouth 'grimace', shoulders up, eye twitch. Red itch squiggles pop around his hips/back at 'itchy'. "
     "Tiny shake.", {"itch": word(5, "itchy")}),
 6: ("KEY. Medium shot: YOU scratches wildly behind his back with both hands (hands oscillate fast behind the lower "
     "back, elbows flapping out), eyes squeezed shut, tongue out, head shaking, hair bouncing; leaves fly off the bush, "
     "the bush shakes. Strong shake + zoom pulses on the scratch strokes.",
     {"scratch": [VO["lines"][5]["start"] - 0.05, 8.98]}),
 7: ("Extreme close-up at ground level on the trail: the dry branch on moss; the bear's huge paw comes down on it, the "
     "branch SNAPS at 'snaps' with splinters flying. Punch-in + shake on the snap. Dark trees behind, low orange light.",
     {"paw": word(7, "snaps") - 0.28, "snap": word(7, "snaps")}),
 8: ("Extreme close-up of YOU's face over the top of the bush: eyes 'wide' with tiny pupils, brows 'raised', mouth "
     "'tight', a sweat drop pops on his forehead; slow zoom into his eyes; colours drained (post.grey); total silence.",
     {"sweat": 10.62}),
 9: ("Wide shot looking north along the trail into the dark forest: dark trunks, distant bushes shaking; the bear's "
     "dark backlit silhouette moves between far trees with two small shiny eyes; a few small birds fly off a branch. "
     "Slow push into the dark. Ground thuds.", {"thuds": [11.62, 12.18, 12.74]}),
 10: ("KEY. Low-angle shot (camera ~0.4 m high) in front of the bear: it walks out of the dark trees into the warm "
      "light toward camera, head low, wet nose glistening, golden rim light, needles kicked up at the paws. Slow "
      "dramatic zoom in. Scary sting at 'bear'.", {"sting": word(10, "bear")}),
 11: ("Extreme low angle from the ground near its feet: the bear rises onto its hind legs to full height, front paws "
      "raised, towering, head against the orange sky and treetops. Camera tilts up from feet to head. Growl with mouth "
      "open.", {"rise": 14.2, "growl": word(11, "big")}),
 12: ("Medium shot from the front-side: the bear on all fours freezes mid-step, one front paw lifted, ears up, head "
      "raised, alert. Quick punch-in at 'stops'.", {"stop": word(12, "stops")}),
 13: ("KEY. Extreme close-up of the bear's nose from the front: the nose fills the frame, nostrils flare on each sniff, "
      "little air swirls go into the nose, small zoom pulse per sniff, whiskers, wet shine.",
      {"sniffs": [word(13, "sniffs"), word(13, "air") - 0.05]}),
 14: ("Over-the-shoulder from behind YOU (camera behind his right shoulder at eye height, looking +Z): back of his head "
      "and hood at the bottom-left, the bear in the middle walking straight toward camera along the trail, looking at "
      "him. Heavy footsteps. Slow push-in.", {"steps": [18.30, 18.95, 19.60]}),
 15: ("Medium close-up of YOU from the front, crouched behind the bush (only head and shoulders above the leaves), "
      "panicking: eyes 'wide', mouth 'open', looking left-right fast, big sweat drops flying off. Small shake.",
      {"look": word(15, "run")}),
 16: ("Close-up of YOU looking straight into the camera, flat deadpan face (eyes 'squint', mouth 'neutral'), pink "
      "blush, one sweat drop; bush leaves at the bottom of frame. Hard punch-in at 'done'.",
      {"punch": word(16, "done")}),
 17: ("Extreme close-up of YOU holding his breath: cheeks puffed out, lips pressed, eyes squeezed shut, face turning "
      "red, sweat drops; slow zoom in; cheeks wobble with the heartbeat in the long pause.",
      {"puff": word(17, "breath"), "beats": [23.62, 24.05]}),
 18: ("Calm high aerial over the pine forest at sunset (camera ~30 m above the trail looking toward the sun glow), "
      "light rays, haze, the river in the distance. Calm slow push-in. No characters visible.", {}),
 19: ("COMPARE clearing: the bear (sitting, left) and the bloodhound (sitting, right) side by side facing camera like a "
      "size comparison. At 'seven' a big 'x7' badge pops next to the bear's nose + small zoom.",
      {"x7": word(19, "seven")}),
 20: ("Close-up of the bloodhound looking up at the bear (head tilted up), sad humbled eyes, droopy ears, one sweat "
      "drop; the bear's brown body out of focus behind. Slow push-in.", {"dog": word(19, "bloodhound")}),
 21: ("MAP: camera very high looking down, YOU's tree at the bottom, the giant MAP_BEAR head at the top, river across. "
      "A green wavy stink trail travels from YOU's tree to the bear's nose; the camera pans up following its tip.",
      {"trail": [28.95, 30.35]}),
 22: ("From behind the bush (camera low at YOU's crouched eye level, bush top leaves at frame bottom): the bear walks "
      "from z~5.5 to BEAR_PATH.near, filling the middle, head lowered, sniffing. Footsteps. Small stink lines rise from "
      "the bush.", {"steps": [31.0, 31.55, 32.1]}),
 23: ("Low angle from behind the bush looking up: the bear's head leans over the bush top, looking down into camera, "
      "nose very close, its shadow over everything (dim). Hard punch-in + small shake + thud at 'Closer'.",
      {"thud": word(22, "closer")}),
 24: ("Extreme close-up of the bear's face in profile: eyes closed, nose up, ONE big sniff: nostrils wide, cheeks pulled "
      "in; green stink lines get sucked into its nose. Short freeze after the sniff.",
      {"sniff": word(23, "sniffs")}),
 25: ("Close-up of the bear's face (front): eyes fill with big shiny tears, tears start to run down its cheeks, sad "
      "brows, mouth trembling, face slightly green; green fog creeps in.", {"tears": word(24, "eyes")}),
 26: ("KEY. Medium close-up: the bear sits back and pinches its nose with its right front paw, eyes squeezed shut with "
      "tears, cheeks puffed, green face, shakes its head in disgust; green haze; small shake.",
      {"pinch": word(25, "holds")}),
 27: ("KEY. Wide side view: the bear runs away on its hind legs toward the exit, arms flailing, head turned back, mouth "
      "wide open wailing, big blue cartoon tears flying back from its eyes, dust behind its feet. Camera pans to follow.",
      {"wail": VO["lines"][25]["start"]}),
 28: ("KEY. Treetops against the orange sunset sky (camera in the canopy near FORE_BRANCH): a huge flock of birds "
      "bursts out of the trees all at once and flies up and away; a red squirrel runs along the foreground branch and "
      "jumps away. Small shake at the burst.", {"burst": word(27, "birds") - 0.12}),
 29: ("Ending: wide high shot of the quiet empty forest at sunset: the big hide tree in front, the tent alone in the camp "
      "clearing behind, long shadows; thick green stink lines rise over the trees from behind the hide tree; green haze; "
      "slow zoom out. No animals, no birds.", {}),
}


def main():
    out = []
    for s in SH["shots"]:
        desc, ev = D[s["id"]]
        ev = {k: (round(v, 3) if isinstance(v, float) else [round(x, 3) for x in v]) for k, v in ev.items()}
        out.append({"id": f"s{s['id']:02d}", "t0": s["t0"], "t1": s["t1"], "say": s["voice"], "key": s["key"],
                    "desc": desc, "events": ev,
                    "captions": [{"text": c["text"], "t": round(c["t"], 3)} for c in s["captions"]]})
    js = ["// Shot plan (generated by gen_plan_js.py from shots.json - do not edit by hand).",
          "// Times are seconds in the final video (30 fps). `say` = what the voice says during the shot; the picture",
          "// MUST clearly show that. `events` = sync moments (also used by make_sfx.py). Hard cuts between all shots.",
          "export const PLAN = " + json.dumps(out, indent=1) + ";",
          "export function shotAt(t) { for (const s of PLAN) if (t < s.t1) return s; return PLAN[PLAN.length - 1]; }",
          ""]
    open(os.path.join(HERE, "web", "plan.js"), "w").write("\n".join(js))
    for o in out:
        print(o["id"], o["t0"], o["t1"], o["events"])


if __name__ == "__main__":
    main()
