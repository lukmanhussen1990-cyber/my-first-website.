"""Generates the 16x16 item icons from hand-made pixel grids (needs Pillow)."""
import os

from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "UrbanLegends_RP", "textures", "items")

PALETTE = {
    ".": (0, 0, 0, 0),
    "k": (26, 26, 28, 255),     # outline
    "g": (60, 60, 64, 255),     # dark grey
    "G": (110, 110, 116, 255),  # grey
    "l": (168, 168, 176, 255),  # light grey
    "w": (242, 242, 236, 255),  # white
    "Y": (255, 236, 120, 255),  # lens yellow
    "q": (255, 246, 176, 150),  # light beam (see-through)
    "r": (200, 30, 30, 255),    # red
    "o": (240, 150, 40, 255),   # orange
    "y": (250, 220, 60, 255),   # yellow
    "e": (60, 210, 100, 255),   # green
    "D": (14, 38, 26, 255),     # dark screen
    "u": (250, 206, 70, 255),   # gold
    "U": (176, 124, 30, 255),   # dark gold
    "c": (110, 230, 255, 255),  # holy cyan
    "S": (26, 88, 100, 255),    # soul steel
    "s": (120, 250, 255, 255),  # soul edge
    "b": (120, 80, 44, 255),    # wood
    "B": (70, 44, 22, 255),     # dark wood
    "p": (120, 66, 170, 255),   # purple frame
    "P": (60, 28, 90, 255),     # dark purple
    "m": (34, 38, 56, 255),     # mirror glass
    "n": (86, 96, 130, 255),    # glass shine
}

ICONS = {
    "flashlight": [
        "................",
        "................",
        "...........kk...",
        "..........kYk..q",
        ".........kGYk.q.",
        ".kkkkkkkkgGwkq..",
        "kllllllrlgGwkqqq",
        "kGGGGGGGGgGwkqqq",
        "kGGGGGGGGgGwkqqq",
        "kgggggggggGwkqqq",
        ".kkkkkkkkgGwkq..",
        ".........kGYk.q.",
        "..........kYk..q",
        "...........kk...",
        "................",
        "................",
    ],
    "emf_reader": [
        "...kk...........",
        "...kk...........",
        "..kkkkkkkkkkkk..",
        "..klGGGGGGGGGk..",
        "..klkkkkkkkkGk..",
        "..klkDDDDDrkGk..",
        "..klkDDDDorkGk..",
        "..klkDDyyorkGk..",
        "..klkeeyyorkGk..",
        "..klkkkkkkkkGk..",
        "..klGGGGGGGGGk..",
        "..klGrGGGGeGGk..",
        "..klGGGGGGGGGk..",
        "..kggggggggggk..",
        "..kkkkkkkkkkkk..",
        "................",
    ],
    "holy_talisman": [
        "...U........U...",
        "....U......U....",
        ".....U....U.....",
        "......U..U......",
        ".......UU.......",
        "......kuuk......",
        "....kkuUUukk....",
        "...kuuUUUUuuk...",
        "..kuUUUwwUUUuk..",
        "..kuUUwccwUUuk..",
        "..kuUwccccwUuk..",
        "..kuUUwccwUUuk..",
        "..kuUUUwwUUUuk..",
        "...kuuUUUUuuk...",
        "....kkuuuukk....",
        "......kkkk......",
    ],
    "soul_scythe": [
        "....kkkkkkk.....",
        "..kkSSSSSSSk....",
        ".kSSSSSSSSSSk...",
        "kSSsssskkSSSbk..",
        "kSskkkk..kkbBk..",
        "ksk.......bBk...",
        "kk.......bBk....",
        "........bBk.....",
        ".......bBk......",
        "......bBk.......",
        ".....bBk........",
        "....bBk.........",
        "...bBk..........",
        "..uBk...........",
        ".uuk............",
        ".kk.............",
    ],
    "haunted_mirror": [
        ".....kkkkkk.....",
        "....kppppppk....",
        "...kpPmmmmPpk...",
        "..kpPmnmmmmPpk..",
        "..kpmnmmmmmmpk..",
        "..kpmrmmmmrmpk..",
        "..kpmmmmmmmmpk..",
        "..kpmwmmmmwmpk..",
        "..kpPmwwwwmPpk..",
        "...kpPmmmmPpk...",
        "....kppppppk....",
        ".....kkPPkk.....",
        "......kPPk......",
        "......kPPk......",
        "......kPPk......",
        "......kkkk......",
    ],
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, rows in ICONS.items():
        assert len(rows) == 16 and all(len(r) == 16 for r in rows), name
        img = Image.new("RGBA", (16, 16))
        img.putdata([PALETTE[ch] for row in rows for ch in row])
        img.save(os.path.join(OUT, name + ".png"))
    print("item icons written:", ", ".join(ICONS))
