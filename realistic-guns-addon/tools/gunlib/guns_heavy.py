"""Shotgun (Franchi SPAS-12) and light machine gun (FN M249 SAW)."""
from .model import GunModel


def build_spas12():
    g = GunModel("spas12")
    bore = 2.3
    # ---------------- receiver ----------------
    g.box("alu", -0.68, 0.68, 0.9, 2.75, -1.5, 5.0)                              # receiver
    g.box("alu", -0.55, 0.55, 2.75, 2.95, -1.3, 4.9)                             # top
    g.box("black", 0.68, 0.71, 1.75, 2.45, 1.3, 3.6, pattern="port")             # ejection port
    g.box("steel", 0.68, 1.05, 2.0, 2.3, 2.9, 3.3)                               # bolt handle
    g.box("black", -0.5, 0.5, 0.75, 0.92, 0.6, 4.2, pattern="lines")             # loading port
    g.box("steel", -0.72, -0.68, 1.15, 1.45, 3.6, 4.3)                           # action release
    g.box("black", -0.3, 0.3, 2.95, 3.3, -1.1, -0.6)                             # rear sight
    # ---------------- heat shield + barrel ----------------
    g.tube("black", 0, bore, 5.0, 19.2, 0.52)                                    # barrel
    g.box("black", -0.45, 0.45, bore - 0.25, bore + 0.45, 5.2, 12.6, pattern="holes")   # heat shield
    g.box("black", -0.32, 0.32, bore + 0.45, bore + 0.6, 5.3, 12.5, pattern="holes")
    g.box("black", -0.1, 0.1, bore + 0.25, bore + 0.75, 18.7, 19.0)              # front sight
    g.box("bore", -0.2, 0.2, bore - 0.2, bore + 0.2, 19.2, 19.22, fpat={"north": "muzzle"})
    # ---------------- magazine tube + pump ----------------
    g.tube("black", 0, 1.35, 5.0, 15.6, 0.62)                                    # mag tube
    g.box("black", -0.38, 0.38, 0.97, 1.73, 15.6, 16.3, pattern="knurl")         # mag cap
    g.box("black", -0.32, 0.32, 1.6, 2.15, 14.9, 15.4)                           # barrel band
    g.bone("pump", (0, 1.4, 9.4))
    g.box("polymer", -0.64, 0.64, 0.7, 1.95, 7.0, 11.8, bone="pump", pattern="grooves")  # forend
    g.box("polymer", -0.58, 0.58, 0.6, 0.72, 7.2, 11.6, bone="pump")
    # ---------------- trigger group / grip ----------------
    g.box("alu", -0.22, 0.22, -0.05, 0.2, 0.55, 2.3)
    g.box("alu", -0.22, 0.22, -0.05, 0.92, 2.08, 2.3)
    g.box("steel", -0.1, 0.1, 0.15, 0.9, 1.15, 1.32, pitch=-12, pivot=(0, 0.9, 1.22))
    g.box("steel", -0.72, -0.68, 1.1, 1.35, 1.6, 2.2)                            # safety
    g.box("polymer", -0.48, 0.48, -2.3, 1.0, -0.6, 0.6, pitch=-17, pivot=(0, 1.0, 0.0),
          pattern="checker", fpat={"up": None, "down": None})
    g.box("polymer", -0.5, 0.5, -2.45, -2.2, -0.75, 0.62, pitch=-17, pivot=(0, 1.0, 0.0))
    # ---------------- folding stock (extended) with hook ----------------
    g.box("alu", -0.55, 0.55, 1.2, 2.6, -2.0, -1.5)                              # stock hinge
    g.box("steel", -0.6, 0.6, 2.25, 2.5, -8.4, -1.9)                             # top strut
    g.box("steel", 0.42, 0.6, 1.0, 1.25, -8.3, -2.0, pitch=-6, pivot=(0, 1.25, -2.0))   # side strut R
    g.box("steel", -0.6, -0.42, 1.0, 1.25, -8.3, -2.0, pitch=-6, pivot=(0, 1.25, -2.0)) # side strut L
    g.box("black", -0.62, 0.62, 0.2, 2.6, -8.75, -8.3)                           # butt plate
    g.box("rubber", -0.64, 0.64, 0.1, 2.7, -8.95, -8.72, pattern="ribs")
    g.box("black", -0.18, 0.18, -0.65, 0.25, -8.7, -8.4)                         # forearm hook
    g.box("black", -0.18, 0.18, -0.65, -0.4, -8.7, -7.6)
    g.box("black", -0.18, 0.18, -0.65, -0.1, -7.85, -7.6)
    # shells "magazine" bone for the reload animation (shell held under the tube)
    g.bone("mag", (0, 0.6, 4.2))
    g.box("red", -0.25, 0.25, 0.25, 0.75, 3.2, 4.6, bone="mag", pattern="ribs")  # shell
    g.box("brass", -0.27, 0.27, 0.23, 0.77, 3.0, 3.25, bone="mag")
    return g


def build_m249():
    g = GunModel("m249")
    bore = 2.15
    # ---------------- receiver ----------------
    g.box("parkerized", -0.78, 0.78, 0.65, 2.75, -1.7, 5.4)                      # receiver
    g.box("black", -0.7, 0.7, 2.75, 3.3, -0.7, 3.8, pattern="lines")             # feed cover
    g.box("black", -0.5, 0.5, 3.3, 3.45, -0.5, 3.5, pattern="rail")              # cover rail
    g.box("black", -0.38, 0.38, 3.3, 3.85, -0.6, -0.15)                          # rear sight
    g.box("black", -0.78, -0.7, 2.75, 3.1, 3.8, 4.3)                             # cover latch
    g.box("black", 0.78, 0.82, 1.45, 2.25, 2.3, 4.6, pattern="port")             # ejection port
    g.box("steel", 0.78, 1.25, 1.65, 1.95, 4.4, 4.85)                            # charging handle
    g.box("black", -0.82, -0.78, 2.0, 2.65, 1.2, 3.6)                            # feed tray port L
    for f in (-1.2, 0.2, 4.9):
        g.box("steel", 0.78, 0.84, 1.0, 1.15, f, f + 0.15)
        g.box("steel", -0.84, -0.78, 1.0, 1.15, f, f + 0.15)
    # ---------------- barrel group ----------------
    g.tube("black", 0, bore, 5.4, 16.6, 0.6)                                     # barrel
    g.box("black", -0.48, 0.48, bore + 0.15, bore + 0.62, 5.6, 10.6, pattern="lines")   # heat shield
    g.tube("black", 0, 1.15, 5.4, 11.4, 0.5)                                     # gas tube
    g.box("black", -0.4, 0.4, 0.8, 2.6, 11.0, 11.8)                              # gas block
    g.box("black", -0.15, 0.15, 2.6, 3.4, 15.9, 16.25)                           # front sight
    g.box("black", -0.32, 0.32, bore - 0.32, bore + 0.32, 16.6, 17.8, pattern="vents",
          fpat={"north": "muzzle"})                                              # flash hider
    # carry handle (folded)
    g.box("black", -0.14, 0.14, bore + 0.6, bore + 1.25, 6.6, 6.9)
    g.box("black", -0.14, 0.14, bore + 0.6, bore + 1.25, 8.6, 8.9)
    g.box("polymer", -0.2, 0.2, bore + 1.25, bore + 1.55, 6.5, 9.0, pattern="knurl")
    # bipod (folded)
    g.box("black", -0.45, 0.45, 0.55, 0.85, 10.8, 11.4)
    g.box("black", 0.12, 0.36, 0.45, 0.7, 5.9, 11.0)
    g.box("black", -0.36, -0.12, 0.45, 0.7, 5.9, 11.0)
    # ---------------- trigger group / grip ----------------
    g.box("parkerized", -0.5, 0.5, 0.3, 0.68, -1.4, 1.6)                         # trigger housing
    g.box("black", -0.22, 0.22, -0.3, -0.06, 0.45, 1.75)
    g.box("black", -0.22, 0.22, -0.3, 0.35, 1.52, 1.75)
    g.box("steel", -0.1, 0.1, -0.1, 0.35, 0.9, 1.06, pitch=-12, pivot=(0, 0.35, 0.98))
    g.box("polymer", -0.48, 0.48, -2.45, 0.6, -0.55, 0.62, pitch=-15, pivot=(0, 0.6, 0.0),
          pattern="checker", fpat={"up": None, "down": None})
    g.box("steel", -0.6, -0.5, 0.35, 0.6, -0.9, -0.5)                            # safety
    # ---------------- stock ----------------
    g.box("polymer", -0.62, 0.62, 1.15, 2.6, -8.4, -1.7)                         # stock top
    g.box("polymer", -0.58, 0.58, -0.45, 1.2, -8.4, -5.8)                        # stock rear lower
    g.box("polymer", -0.56, 0.56, 0.45, 1.2, -6.0, -2.0, pitch=13, pivot=(0, 1.2, -2.0))
    g.box("rubber", -0.66, 0.66, -0.55, 2.7, -8.8, -8.4, pattern="ribs")         # butt plate
    g.box("black", -0.68, 0.68, 1.8, 2.15, -4.3, -3.4)                           # buffer clamp
    # ---------------- ammo box + belt ----------------
    g.bone("mag", (0, 0.5, 2.9))
    g.box("polymer_od", -1.35, 0.42, -2.55, 0.62, 1.2, 4.6, bone="mag", pattern="ribs")  # ammo box
    g.box("polymer_od", -1.38, 0.45, 0.62, 0.78, 1.15, 4.65, bone="mag")         # box lid
    g.box("black", -1.0, -0.2, 0.0, 0.66, 4.6, 4.8, bone="mag")                  # latch
    g.box("brass", -1.25, -0.8, 0.75, 2.25, 2.35, 3.15, bone="mag", pattern="belt")      # belt rising
    g.box("brass", -1.05, -0.78, 1.9, 2.55, 2.35, 3.15, bone="mag", pattern="belt")      # belt entering
    return g
