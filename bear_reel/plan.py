"""Shot plan for the bear reel -> prompts.md (for ChatGPT / Kling) and shots.json (for the final build).

Every shot starts 0.12 s before its first voice line (a cut just ahead of the word), so the shot list fills
the whole voiceover with no gaps. Caption chunks are 2-4 words and start on the first word they show.
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
         "flat polygons, slightly pixelated low-resolution textures (pixel noise on hair, clothes, fur, bark, "
         "leaves and ground). Characters have simple blocky heads with small black square dot eyes, short block "
         "eyebrows and a tiny simple mouth. Soft realistic lighting with soft shadows, warm golden sunset light, "
         "gentle depth of field. Cute and funny, never gross. "
         "Vertical portrait image, subject in the center, no text.")

YOU = ("YOU (same as the character sheet): young guy, medium-brown skin, messy spiky dark-brown hair, "
       "bright red hoodie.")
BEAR = ("BEAR (same as the character sheet): giant brown bear, cute but scary, shaggy brown pixel fur, "
        "round ears, small black dot eyes, big wet shiny black nose.")
DOG = ("BLOODHOUND: a bloodhound dog with reddish-tan fur, very long droopy ears, a wrinkly droopy face "
       "and sad eyes.")
PLACE = ("PLACE: thick pine forest at sunset, tall pine trees, ferns and round bushes, mossy ground with "
         "pine needles.")

CHAR_SHEET = (
    "CHARACTER SHEET. Low-poly blocky 3D video game render, PS1 / Roblox look: chunky faceted shapes with "
    "visible flat polygons, slightly pixelated low-resolution textures (pixel noise on hair, clothes and fur), "
    "simple blocky faces with small black square dot eyes, short block eyebrows and a tiny simple mouth. "
    "Soft realistic lighting with soft shadows. Cute and funny.\n\n"
    "Character turnaround sheet on a plain light grey background, wide landscape image, no text, no labels, "
    "no numbers.\n\n"
    "LEFT SIDE - \"YOU\": a young guy, about 20 years old, medium-brown skin, messy spiky dark-brown hair, "
    "bright red hoodie (hood down), dark blue jeans, white sneakers. Show him 3 times: standing front view, "
    "standing side view, and a close-up of his head with a panicked face (eyes wide, one sweat drop).\n\n"
    "RIGHT SIDE - \"BEAR\": a giant brown bear, cute but scary: chunky low-poly body, shaggy brown pixel fur, "
    "round ears, small black dot eyes, a big wet shiny black nose. Show it 3 times: on all fours (side view), "
    "standing up on its hind legs (front view), and a close-up of its head sniffing with the nose up.\n\n"
    "Same scale for both: standing up, the bear is about three times taller than the guy.")

# Caption chunks per voice line (2-4 words, exact script words; trailing , . : are dropped on screen)
CHUNKS = {
    1: ["You just", "pooped in the forest."], 2: ["Behind a tree."], 3: ["No toilet paper."],
    4: ["So you", "grab a leaf."], 5: ["It's itchy."], 6: ["Very itchy."], 7: ["Then a branch", "snaps."],
    8: ["You freeze."], 9: ["Something big", "is coming."], 10: ["It's a bear."], 11: ["A really big bear."],
    12: ["It stops."], 13: ["It sniffs the air."], 14: ["Then it walks", "straight toward you."],
    15: ["You can't run."], 16: ["You're not done yet."], 17: ["You hold your breath."],
    18: ["What you don't know:"],
    19: ["bears can smell", "about seven times", "better than", "a bloodhound."],
    20: ["It smelled you", "from miles away."], 21: ["The bear gets closer."], 22: ["Closer."],
    23: ["It sniffs once."], 24: ["Its eyes", "start watering."], 25: ["It holds its nose."],
    26: ["And runs away crying."], 27: ["Even the birds leave."], 28: ["Enjoy your", "camping trip."],
}

# One entry per shot. "start" = (line, word index in that line) where the shot's voice starts;
# shot 29 starts in the long pause before the last line ("t0" given directly).
SHOTS = [
    dict(start=(1, 0), size="medium close-up", key=False,
         scene="Medium close-up. YOU peeking out from behind the thick trunk of a big pine tree: only his head, "
               "shoulders and one hand on the bark are visible, the rest of him is hidden behind the trunk. Eyes "
               "half closed, a calm relieved little smile, cheeks a bit pink. Warm sunset light on his face, "
               "blurred pine forest behind him. His face is a little above the middle of the image.",
         effect="Hook: green wavy stink lines rise from behind the tree. Slow push-in, quick punch-in on \"pooped\".",
         sound="Forest birds ambience from the first frame."),
    dict(start=(2, 0), size="wide", key=False,
         scene="Wide shot. One big pine tree stands in the middle of a thick pine forest at sunset. YOU's head with "
               "messy hair and the red hoodie peeks out from the side of its trunk, small in the frame. Ferns and "
               "round bushes around the base of the tree. A small orange camping tent far in the background "
               "between the trees. Golden light rays between the trunks.",
         effect="Small green stink lines above the tree. Slow sideways pan.",
         sound="Forest birds."),
    dict(start=(3, 0), size="close-up", key=False,
         scene="Close-up of YOU's hand holding up an empty cardboard toilet paper tube (just the brown cardboard "
               "roll, no paper left), in the center of the image. Behind it, out of focus, YOU's face peeks from "
               "behind the tree, staring at the empty tube with a blank, disappointed face. Warm sunset light.",
         effect="Punch-in on \"paper\". One sweat drop.",
         sound="Tiny cardboard tap."),
    dict(start=(4, 0), size="close-up", key=False,
         scene="Close-up of a GIANT green leaf growing on a forest bush, bigger than a person's head, covered in "
               "tiny fuzzy hairs, with pixel-texture veins. YOU's hand in a red hoodie sleeve reaches in from the "
               "right and grabs the leaf by its edge. Sunset light glowing through the leaf, blurred pine trees "
               "behind.",
         effect="Slow push-in on the giant leaf.",
         sound="Leaf rustle on \"grab\"."),
    dict(start=(5, 0), size="medium", key=False,
         scene="Medium shot. YOU standing behind a big round bush that hides him from the waist down. He freezes "
               "with an uncomfortable face: eyes wide, mouth a tight wobbly line, one eyebrow twitching, shoulders "
               "pulled up. Pine forest at sunset behind him. His face is a little above the middle of the image.",
         effect="Red cartoon itch squiggles pop around him. Tiny shake.",
         sound="Small itch \"twitch\" sound."),
    dict(start=(6, 0), size="medium", key=True,
         scene="Medium shot. YOU behind the same big round bush (it hides him from the waist down), scratching "
               "wildly behind his back with both hands, elbows out, eyes squeezed shut, tongue sticking out, hair "
               "even messier. Leaves flying off the bush around him. Pine forest at sunset behind him.",
         effect="Strong shake, fast zoom pulses with every scratch.",
         sound="Fast scratching sound.",
         kling="He scratches behind his back like crazy: very fast frantic arm movements, body wiggling, leaves "
               "flying off the bush. Camera static. Keep the low-poly style."),
    dict(start=(7, 0), size="extreme close-up", key=False,
         scene="Extreme close-up at ground level. The BEAR's huge furry brown paw with big dark claws steps on a dry "
               "branch on the mossy forest floor; the branch snaps in two, small wood splinters flying. Pine "
               "needles and moss around it, dark trees blurred behind, low orange sunset light.",
         effect="Punch-in + shake on \"snaps\". After the snap ALL sound cuts out.",
         sound="Loud branch SNAP, then silence."),
    dict(start=(8, 0), size="extreme close-up", key=False,
         scene="Extreme close-up of YOU's face peeking over the top of the bush, frozen in shock: eyes stretched "
               "very wide with tiny pupils, eyebrows high, mouth a small straight line, one sweat drop on his "
               "forehead. Dark forest behind him, cold shadow on half of his face. His eyes are a little above the "
               "middle of the image.",
         effect="Slow zoom into his wide eyes, colours slightly drained. Total silence.",
         sound="Silence."),
    dict(start=(9, 0), size="wide", key=False,
         scene="Wide shot looking deep into the forest. Dark shadowy pine trunks, bushes shaking, and a huge dark "
               "silhouette moving between the trees in the distance with two small shiny eyes. A few small birds "
               "fly off a branch. Last orange sunset light at the edges, cold blue shadows in the middle.",
         effect="Slow push into the dark trees.",
         sound="Deep heavy footsteps far away."),
    dict(start=(10, 0), size="low-angle wide", key=True,
         scene="Low-angle shot. The giant BEAR walks out of the dark trees into the warm sunset light, coming "
               "toward the camera: huge and heavy, head low, small black eyes, big wet shiny nose. Dark pine "
               "trunks behind it, golden rim light on its fur, dust and pine needles around its paws.",
         effect="Slow dramatic zoom in.",
         sound="Deep scary music sting on \"bear\".",
         kling="The huge bear slowly walks out of the dark trees toward the camera, heavy steps, head swaying, "
               "fur moving. Slow dramatic camera push-in. Keep the low-poly style."),
    dict(start=(11, 0), size="extreme low angle", key=False,
         scene="Extreme low-angle shot from the ground. The BEAR stands up on its hind legs, enormous, as tall as "
               "the pine trees, towering over a small orange camping tent next to its feet (the tent looks tiny). "
               "Its head is near the top of the image against the orange sunset sky, front paws raised.",
         effect="Slow tilt up from the tent to the bear's head.",
         sound="Bear growl."),
    dict(start=(12, 0), size="medium", key=False,
         scene="Medium shot. The BEAR on all fours in a forest clearing, frozen mid-step with one front paw lifted "
               "in the air, ears up, head raised, alert. Pine trees and bushes around it, golden sunset light.",
         effect="Quick punch-in on \"stops\".",
         sound="Footsteps stop. Quiet."),
    dict(start=(13, 0), size="extreme close-up", key=True,
         scene="Extreme close-up of the BEAR's big wet shiny black nose, filling most of the image, nostrils wide "
               "open, tiny shiny water droplets on it, brown pixel fur of the snout and whiskers around it. Warm "
               "sunset light, blurred forest behind.",
         effect="Small zoom pulse on every sniff, little air swirls going into the nose.",
         sound="Sniff, sniff.",
         kling="The bear's wet nose sniffs the air: nostrils flare open and shut quickly, nose twitching up and "
               "down. Camera static, very close. Keep the low-poly style."),
    dict(start=(14, 0), size="over the shoulder", key=False,
         scene="Over-the-shoulder shot from behind YOU: the back of his messy dark hair and red hood in the "
               "bottom-left corner, hiding behind a bush. In the middle of the image, the BEAR walks straight "
               "toward the camera on all fours, big and heavy, looking right at him. Pine forest at sunset.",
         effect="Slow push-in toward the bear.",
         sound="Heavy footsteps getting closer."),
    dict(start=(15, 0), size="medium close-up", key=False,
         scene="Medium close-up. YOU crouching behind the bush, only his head and shoulders above the leaves, "
               "panicking: eyes wide, mouth open in a silent scream, looking sideways, big sweat drops flying off "
               "his head. Pine forest at sunset behind him. His face is a little above the middle of the image.",
         effect="Sweat drops flying, small shake.",
         sound="Nervous gulp."),
    dict(start=(16, 0), size="close-up", key=False,
         scene="Close-up. YOU behind the bush looking straight into the camera with a flat, embarrassed, deadpan "
               "face: half-closed eyes, mouth a straight line, pink blushing cheeks, one sweat drop. Leaves of the "
               "bush at the bottom of the image. His face is a little above the middle of the image.",
         effect="Hard punch-in on \"done\".",
         sound="Forest quiet."),
    dict(start=(17, 0), size="extreme close-up", key=False,
         scene="Extreme close-up. YOU holding his breath: cheeks puffed out like two balloons, lips pressed tight, "
               "eyes squeezed shut, face turning red, sweat drops on his forehead. Leaves around his face. His "
               "face is a little above the middle of the image.",
         effect="Slow zoom in, cheeks wobble, face gets redder during the long pause.",
         sound="Heartbeat thumps in the pause."),
    dict(start=(18, 0), size="wide aerial", key=False,
         scene="Calm, wide, high shot over the pine forest at sunset, like a nature documentary: tall pine "
               "treetops, golden light rays, soft haze, a small river in the distance. Peaceful. No characters.",
         effect="Calm slow push-in (the twist starts).",
         sound="Soft calm tone."),
    dict(start=(19, 0), size="two-shot", key=False,
         scene="The BEAR and a BLOODHOUND sitting side by side in a forest clearing, both facing the camera like a "
               "size comparison. The bear is huge, on the left, with a big wet shiny nose; the bloodhound is small, "
               "on the right, with long droopy ears and a wrinkly face. Soft sunset forest background. Empty space "
               "above the bear's head.",
         effect="A big \"x7\" sign (pixel font) pops in next to the bear's nose on \"seven\".",
         sound="Ding on \"seven\"."),
    dict(start=(19, 6), size="close-up", key=False,
         scene="Close-up of the BLOODHOUND looking up at something huge above it: long droopy ears, wrinkly face, "
               "sad humbled eyes, one sweat drop, its small nose. Behind it, out of focus, the big brown furry "
               "body of the BEAR. Forest at sunset.",
         effect="Slow push-in on the sad dog.",
         sound="Small sad dog whimper."),
    dict(start=(20, 0), size="map / top-down", key=False,
         scene="Top-down view from very high above a huge pine forest at sunset, like a game map: endless "
               "low-poly pine treetops, a winding river, small hills and clearings. At the bottom of the image, one "
               "small tree with a tiny guy in a red hoodie hiding behind it. At the top of the image, far away, the "
               "BEAR's head sticks out of the trees, nose pointing toward him. A long empty winding path between "
               "them.",
         effect="Animated green wavy stink trail travels for miles from his tree to the bear's nose; the camera "
                "follows it up.",
         sound="Long whoosh, then a sniff at the end."),
    dict(start=(21, 0), size="medium wide", key=False,
         scene="View from behind the bush where YOU hides, big leaves in the foreground at the bottom. The BEAR is "
               "now very close, filling the middle of the image, walking toward the camera with its big head "
               "lowered, sniffing. Pine forest at sunset behind it, long shadows.",
         effect="Slow push-in, small stink lines rising from the bush.",
         sound="Heavy footsteps."),
    dict(start=(22, 0), size="extreme low angle", key=False,
         scene="Low-angle shot looking straight up from behind the bush: the BEAR's huge face leans over the top of "
               "the bush and looks down into the camera, big wet nose very close, small black eyes, its shadow "
               "covering everything. Orange sky and pine treetops behind its head.",
         effect="Hard punch-in + small shake on \"Closer\".",
         sound="Deep thud."),
    dict(start=(23, 0), size="extreme close-up (side)", key=False,
         scene="Extreme close-up of the BEAR's face from the side as it takes one big sniff: eyes closed, nose up, "
               "nostrils wide open, cheeks pulled in. Sunset light, blurred forest behind.",
         effect="Green stink lines get sucked into its nose, then a short freeze.",
         sound="One long sniff."),
    dict(start=(24, 0), size="close-up", key=False,
         scene="Close-up of the BEAR's face, front view: its small black eyes filling up with big shiny tears, "
               "tears starting to run down its furry cheeks, sad eyebrows, mouth trembling. Its face has a slight "
               "green tint. Forest at sunset behind. Its eyes are a little above the middle of the image.",
         effect="Cartoon tears well up and drip. Green fog starts creeping in.",
         sound="Small bear whimper."),
    dict(start=(25, 0), size="medium close-up", key=True,
         scene="Medium close-up. The BEAR sitting back and pinching its nose shut with one big paw, eyes squeezed "
               "shut with tears, cheeks puffed, face slightly green, disgusted. Light green haze in the air around "
               "it. Pine forest at sunset.",
         effect="Green fog, small shake.",
         sound="Muffled bear groan.",
         kling="The bear keeps pinching its nose with its paw, squeezes its eyes shut and shakes its head in "
               "disgust, tears dripping. Camera static. Keep the low-poly style."),
    dict(start=(26, 0), size="wide", key=True,
         scene="The BEAR running away through the pine forest on its hind legs, seen from the side, arms flailing "
               "up, mouth wide open, crying hard with big blue cartoon tears streaming and flying back from its "
               "eyes, dust cloud behind its feet. Golden sunset light between the trees.",
         effect="Big blue tears flying, fast pan with the bear.",
         sound="Bear crying / wailing, footsteps running away.",
         kling="The bear runs away fast on its hind legs, arms flailing, crying with its mouth wide open, big blue "
               "tears flying behind it. Camera pans to follow it. Keep the low-poly style."),
    dict(start=(27, 0), size="wide", key=True,
         scene="Wide shot of pine treetops against an orange sunset sky: a huge flock of small dark birds bursts out "
               "of the trees all at once, flying up and away. On a branch in front, a small red squirrel runs along "
               "with them. Leaves and pine needles falling.",
         effect="Birds burst out, small shake.",
         sound="Birds flying away (lots of wing flaps), squirrel squeak.",
         kling="A huge flock of birds bursts out of the treetops all at once and flies away into the sky; the "
               "squirrel runs along the branch and jumps away. Camera static. Keep the low-poly style."),
    dict(t0=None, start=(28, 0), size="wide (ending)", key=False, pause_cut=0.43,
         scene="Wide shot of the quiet, empty pine forest at sunset: tall pine trees, one big pine tree in front, "
               "the small orange camping tent alone in a clearing, long shadows, pink-orange sky above the "
               "treetops. Peaceful and empty: no people, no animals, no birds.",
         effect="Ending like the plane: green stink lines rising over the trees, green haze, slow zoom out.",
         sound="Quiet forest, no birds. One last cricket."),
]

norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def line_words(li):
    return [w for w in WORDS if w["line"] == li]


def main():
    lines = {l["i"]: l for l in VO["lines"]}
    # caption chunks with start times (first word of each chunk)
    chunks = []
    for li, parts in CHUNKS.items():
        ws, text = line_words(li), lines[li]["text"].split()
        assert " ".join(parts).split() == text, (li, parts, text)
        assert len(ws) == len(text), (li, len(ws), len(text))
        k = 0
        for p in parts:
            n = len(p.split())
            shown = re.sub(r"[,.:;]+$", "", p)
            # a line's first chunk starts at the exact measured line start (STT word times can be late);
            # chunks inside a line use the STT word time (refined on the audio at build time)
            t = lines[li]["start"] if k == 0 else ws[k]["s"]
            chunks.append({"text": shown, "line": li, "t": t, "end": ws[k + n - 1]["e"]})
            k += n
    # shot start times
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
                    "effect": s["effect"], "sound": s["sound"], "kling": s.get("kling"),
                    "image": f"images/shot_{i + 1:02d}.png", "clip": f"clips/shot_{i + 1:02d}.mp4"})
    assert sum(len(o["captions"]) for o in out) == len(chunks)
    json.dump({"fps": FPS, "duration": END, "shots": out}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    write_md(out)
    for o in out:
        print(f"{o['id']:2d} {o['t0']:6.2f}-{o['t1']:6.2f} ({o['dur']:.2f}s) {'KEY ' if o['key'] else '    '}"
              f"{o['size']:24s} | " + " / ".join(c["text"] for c in o["captions"]))
    print(f"{len(out)} shots, {END:.2f}s, mean {END / len(out):.2f}s, key shots: "
          f"{[o['id'] for o in out if o['key']]}")


def write_md(shots):
    key = [o for o in shots if o["key"]]
    L = []
    L.append("# Bear reel - image prompts (\"You just pooped in the forest\")\n")
    L.append(f"Reel: 1080x1920, 30 fps, {END:.1f} s, {len(shots)} shots. Voiceover is done "
             "(`audio/voiceover.mp3`, Nassim, same voice and settings as the last reels).\n")
    L.append("## How to use\n")
    L.append("1. Open ONE new ChatGPT chat. Paste the **character sheet** prompt first.")
    L.append("2. Then paste the shot prompts one by one, in order, in the same chat (so the characters stay the same).")
    L.append("3. Save each image as `shot_01.png`, `shot_02.png` ... (or just send them to me in order).")
    L.append(f"4. For the **{len(key)} KEY shots** (marked with a star), also make a Kling clip from that image "
             "(image-to-video, 9:16, 5 s) with the short Kling prompt. Save as `shot_06.mp4` etc. "
             "I only use the best 1-2 seconds of each clip, so a 5 s clip is plenty.")
    L.append("5. Send me the images and clips. I build `final.mp4` after that (zooms, shake, captions, effects, sound).\n")
    L.append("Tips: if a face drifts, reply \"Same YOU as the character sheet, match the face exactly.\" "
             "If text or letters appear in an image, reply \"Same image with no text.\" "
             "Captions, stink lines, fog, sweat drops, tears and the \"x7\" sign are added by me in the edit, "
             "so they are not needed in the images (except where a prompt asks for tears).\n")
    L.append("## Characters and place\n")
    L.append(f"- {YOU}")
    L.append(f"- {BEAR}")
    L.append(f"- {DOG}")
    L.append(f"- {PLACE} A small orange camping tent in the background.\n")
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
        who = []
        if "YOU" in o["scene"] or "red hoodie" in o["scene"]:
            who.append(YOU)
        if "BEAR" in o["scene"]:
            who.append(BEAR)
        if "BLOODHOUND" in o["scene"]:
            who.append(DOG)
        body = STYLE + "\n\n" + o["scene"] + ("\n\n" + " ".join(who) if who else "") + "\n\n" + PLACE
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
