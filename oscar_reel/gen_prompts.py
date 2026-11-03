"""shots.json -> prompts.md (ChatGPT image prompts per shot + captions + effects + Kling prompts for the key shots)."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SH = json.load(open(os.path.join(HERE, "shots.json")))

STYLE = ("Low-poly blocky 3D render, PS1 / Roblox style, chunky faceted shapes, slightly pixelated textures, simple faces "
         "with small black dot eyes, soft realistic lighting. Vertical portrait image (9:16), subject in the center, no text.")
YOU = ("YOU: a made-up famous actor (must NOT look like any real actor), slicked-back black hair, black tuxedo, black bow tie, "
       "white shirt")
STATUE = "a shiny golden award statue (a generic golden trophy figure, NOT a copy of any real award)"
THEATRE = "a huge golden awards theatre, red velvet curtains, warm spotlights, a giant screen behind the stage"
LUMP = {1: "normal tuxedo trousers, no lump",
        2: "a small round cartoon lump in the back of his tuxedo trousers, a few green wavy stink lines",
        3: "a bigger round lump in the back of his trousers, like a balloon, more green stink lines",
        4: "an even bigger lump, the tuxedo tails lifting up over it, lots of green stink lines",
        5: "a HUGE lump, the trousers stretched like a beach ball, two buttons popping off, thick green stink lines"}
LUMP_SHOT = (f"{YOU}, standing at a golden mic stand on the stage of {THEATRE}, seen from behind and a little to the side so we see "
             f"his back and his proud face turned to the crowd, one hand holding {STATUE} high.")

P = {
    1: (f"Wide shot of {THEATRE}: a huge crowd of made-up celebrities in tuxedos and sparkly gowns cheering in rows of red seats, "
        f"{YOU} walking toward the stage holding {STATUE}.", "Cheering crowd + applause. Slow push-in."),
    2: (f"Close-up of a hand in a tuxedo sleeve raising {STATUE} into a spotlight, golden sparkles.", "Sparkles, punch-in on 'Oscar'."),
    3: (f"Low angle: {YOU} walking up the stage stairs, holding {STATUE}, huge proud smile, spotlight from above.", "Slow tilt up."),
    4: (f"LUMP A. {LUMP_SHOT} {LUMP[1]}. Big proud smile.", "Slow push-in. (Base image for the lump series.)"),
    5: (f"Close-up of {YOU}'s face at the mic: a big proud smile that starts to freeze, eyes going wide.", "Smile freeze, small zoom."),
    6: (f"LUMP B. {LUMP_SHOT} {LUMP[2]}. His eyes wide.", "Punch-in on the lump, small shake, 'squish', green fog starts."),
    7: (f"A family on a sofa in a cozy living room watching a big TV that shows a man in a tuxedo at a mic (shot from behind the sofa).", "TV glow."),
    8: ("A sweet grandma in an armchair holding a bowl of popcorn, staring wide-eyed at her TV, popcorn falling from her hand.", "Popcorn falls."),
    9: (f"Close-up of {YOU} leaning into a golden mic, saying 'thank you', stage lights behind.", "Mic feedback squeal."),
    10: (f"Extreme close-up of {YOU}'s face, big blue sweat drops, mouth half open, voice cracking.", "Sweat drops, voice-crack sound."),
    11: ("Wide shot of the front row of made-up celebrities in tuxedos and gowns, all sniffing the air at the same time, noses up.", "Crowd sniffing sound."),
    12: ("Two made-up celebrities in the front row slowly turning to look at each other, suspicious faces.", "Quick pan between them."),
    13: (f"Close-up of {YOU}'s eyes darting left and right, sweat on his forehead.", "Sweat drops."),
    14: (f"LUMP C. {LUMP_SHOT} {LUMP[3]}. Nervous smile.", "Punch-in, shake, 'SQUISH', thicker green fog."),
    15: (f"{YOU} at the mic pointing into the audience with a big emotional smile.", "Small push-in."),
    16: ("His mom in the audience: a sweet older lady in a fancy purple dress, proud tears on her cheeks, a tissue in her hand, "
         "then sniffing with her smile frozen.", "Tears, then smile freeze."),
    17: (f"LUMP D. {LUMP_SHOT} {LUMP[4]}. Worried smile.", "Punch-in, shake, louder 'SQUISH', thick green fog."),
    18: ("A glamorous made-up actress in a sparkly silver gown with perfect hair in row one, smiling for the cameras while pinching "
         "her nose with one hand.", "Camera flashes."),
    19: (f"A big TV camera on a crane swinging toward the stage, a red LIVE light on it, {THEATRE}.", "Crane whir, red light blinking."),
    20: (f"{YOU}'s giant face on the huge theatre screen, one eye twitching, sweat drops.", "Eye twitch, zoom."),
    21: (f"LUMP E. {LUMP_SHOT} {LUMP[5]}. Panicked smile.", "Big punch-in, strong shake, 'SQUOOOSH', thickest green fog."),
    22: (f"Wide shot of the stage: {YOU} at the mic, frozen smile, thick green fog all around him, front row covering noses.", "Green fog."),
    23: ("The director in row one: an old man with a white beard, round glasses and a velvet jacket, watching seriously.", "Slow push-in."),
    24: ("Close-up of the director: a single tear rolling down his cheek.", "Tear."),
    25: ("Close-up of the director holding a white handkerchief over his nose, eyes watering, green fog around.", "Green fog."),
    26: ("Wide shot of the orchestra pit below the stage: musicians with violins, trumpets and cellos, a thin conductor with wild hair "
         "in front.", "Stopwatch appears in the corner (added by code)."),
    27: ("A thin conductor with wild grey hair slowly raising his baton, staring at a stopwatch in his other hand.", "Slow zoom."),
    28: ("Close-up of a silver stopwatch in the conductor's hand.", "Ticking."),
    29: ("The orchestra ready to play, all musicians looking up at the stage, instruments raised.", "Pan."),
    30: (f"Over the conductor's shoulder: {YOU} far away at the mic on the stage, green fog around him.", "Slow zoom on him."),
    31: (f"Extreme close-up of {YOU}'s sweating face.", "COUNTDOWN timer 0:40 (added by code), ticking."),
    32: ("Close-up of the conductor's raised baton, trembling.", "COUNTDOWN timer 0:44, ticking faster."),
    33: (f"Extreme close-up of {YOU}'s eyes going wide.", "COUNTDOWN timer 0:45, flash."),
    34: ("The conductor swinging his baton down dramatically, the orchestra bursting into music, the spotlight swinging away.", "Loud play-off music."),
    35: (f"Wide shot from behind: {YOU} walking off the stage stiff-legged like a penguin, the huge lump in his trousers, green fog trailing "
         "behind him.", "Penguin footsteps, slow pan."),
    36: (f"Side view of the stage: {YOU} still walking very slowly, the whole crowd watching in silence.", "Slow."),
    37: ("Wide shot of the orchestra still playing violins, trumpets and cellos.", "Orchestra music."),
    38: ("Violin, trumpet and cello players playing with ONE hand, every musician pinching their nose with the other hand.", "Orchestra music, sniffs."),
    39: ("The conductor conducting with one hand, pinching his nose with the other, eyes squeezed.", "Orchestra music."),
    40: ("Wide night shot outside the glowing golden theatre, searchlights in the sky, green wavy stink lines rising from the roof.", "Slow zoom out, music fades."),
}
KLING = {
    3: "He walks up the stairs to the mic, proud, holding the statue up; the crowd cheers; camera tilts up slowly.",
    19: "The TV camera on the crane swings toward the stage; the red LIVE light blinks.",
    21: "The lump in his trousers swells bigger, a button pops off, green stink lines wobble; small camera shake.",
    34: "The conductor swings his baton down; the orchestra starts playing; the spotlight swings away.",
    35: "He walks off the stage very slowly and stiff-legged like a penguin; green fog trails behind him.",
    38: "The musicians keep playing with one hand while pinching their noses; small sway to the music.",
}


def main():
    out = ["# You just won the Oscar - image prompts", "",
           "Voice: your recording (girly_poop.mp3), timed. Video length: %.1f s, %d shots." % (SH["duration"], len(SH["shots"])), "",
           "**How to make them:** paste the CHARACTER SHEET prompt first and keep it in the same ChatGPT chat. Then make each shot. "
           "Save each image as `shot_01.png` ... `shot_40.png` and send them to me. Kling clips (only the 6 marked shots): "
           "`shot_03.mp4` etc.", "",
           "**The lump shots (4, 6, 14, 17, 21) must be the same picture:** make shot 4 (LUMP A) first. Then upload it to ChatGPT and say "
           "\"keep everything the same, only make the lump in his trousers bigger and add more stink lines\" to get shot 6. Do the same "
           "with shot 6 to get shot 14, with 14 to get 17, and with 17 to get 21.", "",
           "**Style (in every prompt):** " + STYLE, "",
           "## Character sheet", "",
           "```", f"Character sheet, 6 characters standing side by side on a plain light background: {YOU}, holding {STATUE}; "
           "CO-STAR: glamorous actress, sparkly silver gown, perfect wavy hair; YOUR MOM: sweet older lady, grey bun, fancy purple dress, "
           "pearls; DIRECTOR: old man, white beard, round glasses, burgundy velvet jacket; CONDUCTOR: thin man, wild grey hair, black "
           "tailcoat, baton; ORCHESTRA PLAYER: musician in black holding a violin. All made-up people, none of them look like real "
           f"celebrities. {STYLE}", "```", ""]
    for s in SH["shots"]:
        i = s["id"]
        prompt, effect = P[i]
        caps = " / ".join(c["text"] for c in s["captions"]) or "-"
        key = " ⭐ KEY SHOT" if i in KLING else ""
        out += [f"## Shot {i:02d} ({s['t0']:.2f}-{s['t1']:.2f} s, {s['dur']:.1f} s){key}", "",
                "```", f"{prompt} {STYLE}", "```",
                f"- Caption: {caps}", f"- Effect: {effect}"]
        if i in KLING:
            out.append(f"- Kling (5 s): {KLING[i]}")
        out.append("")
    open(os.path.join(HERE, "prompts.md"), "w").write("\n".join(out))
    print(f"prompts.md: {len(SH['shots'])} shots, {len(KLING)} key shots")


if __name__ == "__main__":
    main()
