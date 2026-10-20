"""Pistols: Glock 17 and Desert Eagle."""
from .model import GunModel


def build_glock17():
    g = GunModel("glock17")
    # ---------------- slide (matte black nitride) ----------------
    g.bone("slide", (0, 1.8, 0))
    g.box("black", -0.6, 0.6, 1.25, 2.3, -0.5, 5.95, bone="slide")
    g.box("black", -0.6, 0.6, 1.25, 2.3, -1.85, -0.5, bone="slide",
          fpat={"east": "serration", "west": "serration"})
    g.box("black", -0.5, 0.5, 2.3, 2.45, -1.75, 5.85, bone="slide")               # top chamfer
    g.box("black", -0.62, 0.62, 1.25, 1.42, -1.85, 5.95, bone="slide")            # slide rails
    g.box("black", 0.6, 0.63, 1.8, 2.22, 1.1, 2.75, pattern="port", bone="slide")  # ejection port
    g.box("steel", 0.6, 0.66, 1.62, 1.78, 1.15, 1.65, bone="slide")               # extractor
    g.box("black", -0.45, 0.45, 2.45, 2.75, -1.65, -1.15, bone="slide")           # rear sight
    g.box("white", -0.3, -0.18, 2.5, 2.7, -1.66, -1.62, bone="slide")
    g.box("white", 0.18, 0.3, 2.5, 2.7, -1.66, -1.62, bone="slide")
    g.box("black", -0.1, 0.1, 2.45, 2.72, 5.3, 5.62, bone="slide")                # front sight
    g.box("white", -0.06, 0.06, 2.52, 2.66, 5.29, 5.31, bone="slide")
    g.box("bore", -0.24, 0.24, 1.55, 2.0, 5.95, 5.97, bone="slide",
          fpat={"north": "muzzle"})                                               # muzzle face
    # ---------------- frame (polymer) ----------------
    g.box("polymer", -0.56, 0.56, 0.6, 1.27, -1.5, 5.4)                          # frame top
    g.box("polymer", -0.5, 0.5, 0.25, 0.65, 2.7, 5.4, pattern="rail")            # dust cover rail
    g.box("polymer", -0.48, 0.48, 0.25, 0.65, 2.2, 2.75)
    g.box("polymer", -0.24, 0.24, -0.45, -0.18, 0.6, 2.9)                        # guard bottom
    g.box("polymer", -0.24, 0.24, -0.45, 0.62, 2.62, 2.9, pattern="checker")     # guard front
    g.box("black", -0.1, 0.1, -0.1, 0.6, 1.25, 1.42, pitch=-10, pivot=(0, 0.6, 1.33))  # trigger
    g.box("black", -0.035, 0.035, 0.0, 0.5, 1.29, 1.38, pitch=-10, pivot=(0, 0.6, 1.33))
    g.box("polymer", -0.57, -0.5, 0.75, 1.0, 1.7, 2.4)                           # slide stop
    g.box("steel", -0.58, -0.52, 0.68, 0.88, 2.55, 2.85)                         # takedown
    # grip (22 degree rake)
    g.box("polymer", -0.55, 0.55, -3.15, 1.0, -1.05, 0.95, pitch=-22, pivot=(0, 0.95, 0.0),
          pattern="stipple", fpat={"up": None, "down": None})
    g.box("polymer", -0.5, 0.5, -1.2, 0.95, 0.9, 1.15, pitch=-22, pivot=(0, 0.95, 0.0),
          pattern="grooves")                                                      # finger grooves
    g.box("polymer", -0.48, 0.48, 0.55, 0.95, -1.75, -1.0, pitch=-30, pivot=(0, 0.95, -1.0))  # beavertail
    g.bone("mag", (0, -3.1, -1.2))
    g.box("polymer_dk", -0.57, 0.57, -3.42, -3.1, -1.12, 1.02, pitch=-22, pivot=(0, 0.95, 0.0),
          bone="mag")                                                             # mag base plate
    return g


def build_deagle():
    g = GunModel("deagle")
    # ---------------- barrel (with the iconic triangular top rail) ----------------
    g.box("chrome", -0.68, 0.68, 1.3, 2.2, 2.2, 7.6)                              # barrel block
    g.box("chrome", -0.5, 0.5, 2.2, 2.5, 2.2, 7.6)                                # upper bevel
    g.box("chrome", -0.3, 0.3, 2.5, 2.72, 2.3, 7.6, pattern="rail")              # top rib
    g.box("chrome", -0.68, 0.68, 0.95, 1.3, 4.6, 7.6)                             # lower barrel lug
    g.box("bore", -0.3, 0.3, 1.6, 2.2, 7.6, 7.62, fpat={"north": "muzzle"})
    g.box("black", -0.1, 0.1, 2.72, 3.0, 7.0, 7.35)                              # front sight
    g.box("stainless", -0.7, -0.68, 1.45, 2.05, 3.0, 5.8, pattern="lines")       # engraving L
    g.box("stainless", 0.68, 0.7, 1.45, 2.05, 3.0, 5.8, pattern="lines")         # engraving R
    # ---------------- slide ----------------
    g.bone("slide", (0, 1.8, 0))
    g.box("chrome", -0.74, 0.74, 1.2, 2.5, -1.0, 2.25, bone="slide")
    g.box("chrome", -0.74, 0.74, 1.2, 2.5, -2.4, -1.0, bone="slide",
          fpat={"east": "serration", "west": "serration"})
    g.box("chrome", -0.55, 0.55, 2.5, 2.65, -2.3, 2.2, bone="slide")
    g.box("black", -0.48, 0.48, 2.6, 2.95, -2.25, -1.75, bone="slide")           # rear sight
    g.box("black", 0.74, 0.76, 1.85, 2.35, -0.2, 1.2, pattern="port", bone="slide")
    g.box("chrome", -0.9, 0.9, 1.75, 2.15, -2.05, -1.45, bone="slide")           # ambi safety
    # ---------------- frame ----------------
    g.box("chrome", -0.66, 0.66, 0.4, 1.25, -2.15, 4.6)                          # frame
    g.box("chrome", -0.66, 0.66, 0.0, 0.45, 2.6, 4.6)                            # dust cover lower
    g.box("chrome", -0.22, 0.22, -0.85, -0.55, 0.65, 3.0)                        # guard bottom
    g.box("chrome", -0.22, 0.22, -0.85, 0.45, 2.7, 3.0)                          # guard front
    g.box("chrome", -0.22, 0.22, -0.55, -0.15, 2.7, 3.15, pitch=25, pivot=(0, -0.55, 2.9))
    g.box("black", -0.11, 0.11, -0.4, 0.4, 1.35, 1.55, pitch=-12, pivot=(0, 0.4, 1.45))  # trigger
    g.box("chrome", -0.7, -0.66, 0.65, 0.95, 0.4, 1.4)                           # slide stop
    g.box("black", -0.66, 0.66, 1.25, 2.05, -2.8, -2.35, pitch=-20, pivot=(0, 1.25, -2.35))  # hammer
    # grip (14 degree rake) with black rubber panels
    g.box("chrome", -0.55, 0.55, -3.6, 0.55, -1.15, 1.05, pitch=-14, pivot=(0, 0.55, 0.0))
    g.box("rubber", -0.66, 0.66, -3.35, 0.35, -0.95, 0.8, pitch=-14, pivot=(0, 0.55, 0.0),
          pattern="grooves")
    g.box("chrome", -0.5, 0.5, -0.1, 0.55, -2.05, -1.0, pitch=-35, pivot=(0, 0.55, -1.0))  # beavertail
    g.bone("mag", (0, -3.5, 0))
    g.box("chrome", -0.58, 0.58, -3.85, -3.55, -1.3, 1.1, pitch=-14, pivot=(0, 0.55, 0.0),
          bone="mag")                                                             # mag base
    return g
