"""Sub-machine guns: H&K MP5 (A3, retractable stock) and IMI UZI (folded stock)."""
from .model import GunModel
from .guns_ak import curved_stack, floor_plate


def build_mp5():
    g = GunModel("mp5")
    bore = 1.75
    # ---------------- receiver (stamped steel tube) ----------------
    g.box("black", -0.56, 0.56, 0.95, 2.35, -2.7, 5.2)                           # receiver
    g.box("black", -0.48, 0.48, 2.35, 2.6, -2.5, 5.2)                            # top round-off
    g.tube("black", -0.12, 2.75, 1.0, 7.9, 0.5)                                  # cocking tube
    g.box("black", -0.58, -0.56, 1.3, 2.1, 0.0, 3.6, pattern="lines")            # pressed ribs L
    g.box("black", 0.56, 0.58, 1.3, 2.1, 0.0, 3.6, pattern="lines")              # pressed ribs R
    g.box("black", 0.56, 0.6, 1.85, 2.3, 0.9, 2.3, pattern="port")               # ejection port
    g.box("steel", -0.85, -0.38, 2.6, 2.85, 6.6, 6.9, yaw=-25, pivot=(-0.38, 2.7, 6.8))  # cocking handle
    g.box("black", -0.5, 0.5, 2.6, 3.25, -2.5, -1.75)                            # rear drum sight base
    g.tube("black", 0, 3.35, -2.45, -1.8, 0.55)                                  # drum
    g.box("black", -0.62, 0.62, 2.35, 2.55, -2.2, -1.9)                          # sight clamp
    # front sight hood
    g.box("black", -0.32, 0.32, 2.75, 3.55, 6.9, 7.45)
    g.box("black", -0.36, -0.24, 3.55, 3.95, 6.95, 7.4)
    g.box("black", 0.24, 0.36, 3.55, 3.95, 6.95, 7.4)
    g.box("black", -0.36, 0.36, 3.95, 4.08, 6.95, 7.4)                           # hood ring top
    g.box("black", -0.05, 0.05, 3.55, 3.85, 7.12, 7.22)                          # post
    # ---------------- trigger group (polymer "Navy" housing) ----------------
    g.box("polymer", -0.5, 0.5, 0.35, 0.97, -1.9, 1.85)                          # housing
    g.box("polymer", -0.22, 0.22, -0.25, 0.0, 0.55, 1.9)                         # guard bottom
    g.box("polymer", -0.22, 0.22, -0.25, 0.4, 1.65, 1.9)                         # guard front
    g.box("black", -0.1, 0.1, -0.05, 0.4, 0.95, 1.1, pitch=-12, pivot=(0, 0.4, 1.02))
    g.box("steel", 0.5, 0.62, 0.55, 0.85, -1.2, -0.75)                           # selector R
    g.box("steel", -0.62, -0.5, 0.55, 0.85, -1.2, -0.75)                         # selector L
    g.box("polymer", -0.45, 0.45, -2.45, 0.6, -0.4, 0.75, pitch=-16, pivot=(0, 0.6, 0.2),
          pattern="stipple", fpat={"up": None, "down": None})                    # grip
    g.box("polymer", -0.47, 0.47, -2.6, -2.4, -0.55, 0.75, pitch=-16, pivot=(0, 0.6, 0.2))
    # ---------------- handguard (slim polymer) ----------------
    g.box("polymer", -0.62, 0.62, 0.85, 2.3, 5.2, 8.0, pattern="lines")
    g.box("polymer", -0.64, 0.64, 1.0, 1.15, 5.4, 7.8)
    # ---------------- barrel / muzzle ----------------
    g.tube("black", 0, bore, 7.8, 9.1, 0.42)
    g.box("black", -0.3, 0.3, bore - 0.3, bore + 0.3, 8.6, 9.1, fpat={"north": "muzzle"})  # 3-lug
    for a in (0, 120, 240):
        g.box("black", -0.08, 0.08, bore + 0.28, bore + 0.4, 8.75, 8.95, roll=a,
              pivot=(0, bore, 8.85))
    # ---------------- retractable stock (A3) ----------------
    g.box("black", -0.5, 0.5, 1.15, 2.2, -3.1, -2.7)                             # end cap
    g.box("steel", 0.42, 0.56, 1.75, 1.95, -8.1, -3.1)                           # strut R
    g.box("steel", -0.56, -0.42, 1.75, 1.95, -8.1, -3.1)                         # strut L
    g.box("steel", 0.42, 0.56, 1.1, 1.3, -8.1, -3.6, pitch=4, pivot=(0, 1.3, -3.6))
    g.box("steel", -0.56, -0.42, 1.1, 1.3, -8.1, -3.6, pitch=4, pivot=(0, 1.3, -3.6))
    g.box("black", -0.6, 0.6, 0.55, 2.1, -8.35, -8.0)                            # butt frame
    g.box("rubber", -0.66, 0.66, 0.35, 2.3, -8.65, -8.35, pattern="ribs")        # butt pad
    g.box("black", -0.6, 0.6, 1.0, 1.55, -3.75, -3.1)                            # stock latch
    # ---------------- curved 9mm magazine ----------------
    g.bone("mag", (0, 0.4, 2.85))
    g.box("black", -0.4, 0.4, 0.4, 0.97, 2.25, 3.45)                             # magwell
    g.box("steel", -0.42, -0.38, 0.55, 0.8, 1.7, 2.1)                            # mag release
    y, f, a = curved_stack(g, "black", 0, 0.45, 2.85, 1.2, 1.1, 0.72, [10, 22, 34],
                           pattern="ribs")
    floor_plate(g, "black", 0.8, y, f, 1.24, a + 3)
    return g


def build_uzi():
    g = GunModel("uzi")
    bore = 1.75
    # ---------------- boxy receiver ----------------
    g.box("parkerized", -0.72, 0.72, 0.8, 2.55, -3.0, 5.2)                       # receiver
    g.box("parkerized", -0.62, 0.62, 2.55, 2.85, -2.8, 4.6, pattern="ribs")      # top cover
    g.box("parkerized", -0.74, 0.74, 1.15, 1.35, -2.6, 4.9)                      # side pressing
    g.box("black", 0.72, 0.75, 1.55, 2.25, 0.4, 2.2, pattern="port")             # ejection port
    g.box("steel", -0.22, 0.22, 2.85, 3.3, 3.2, 3.75, pattern="knurl")           # cocking knob
    g.box("parkerized", -0.38, 0.38, 2.85, 3.05, 2.9, 4.0)                       # knob base
    g.box("parkerized", -0.5, 0.5, 2.85, 3.25, -2.8, -2.2)                       # rear sight
    g.box("black", -0.15, 0.15, 3.25, 3.4, -2.7, -2.35)
    g.box("parkerized", -0.28, -0.18, 2.85, 3.5, 4.5, 4.85)                      # front sight ears
    g.box("parkerized", 0.18, 0.28, 2.85, 3.5, 4.5, 4.85)
    g.box("black", -0.05, 0.05, 2.85, 3.35, 4.62, 4.72)
    # ---------------- barrel nut / barrel ----------------
    g.tube("parkerized", 0, bore, 5.2, 5.8, 1.05, pattern="knurl")
    g.tube("black", 0, bore, 5.8, 6.9, 0.48)
    g.box("bore", -0.18, 0.18, bore - 0.18, bore + 0.18, 6.9, 6.92, fpat={"north": "muzzle"})
    # ---------------- grip with magazine inside ----------------
    g.box("polymer", -0.62, 0.62, -3.2, 0.85, -0.95, 0.75, pitch=-6, pivot=(0, 0.85, -0.1),
          pattern="checker", fpat={"up": None, "down": None})                    # grip panels
    g.box("parkerized", -0.5, 0.5, -3.15, 0.85, -1.15, -0.85, pitch=-6, pivot=(0, 0.85, -0.1))  # grip safety
    g.box("parkerized", -0.24, 0.24, -0.65, -0.4, 0.65, 2.6)                     # guard bottom
    g.box("parkerized", -0.24, 0.24, -0.65, 0.82, 2.38, 2.62)                    # guard front
    g.box("black", -0.1, 0.1, -0.35, 0.82, 1.3, 1.48, pitch=-10, pivot=(0, 0.82, 1.4))
    g.box("steel", -0.78, -0.72, 0.95, 1.25, -0.9, -0.55)                        # selector
    # ---------------- folded stock (under the receiver) ----------------
    g.box("parkerized", 0.6, 0.74, 0.55, 0.78, -2.8, 4.9)                        # stock arm R
    g.box("parkerized", -0.74, -0.6, 0.55, 0.78, -2.8, 4.9)                      # stock arm L
    g.box("parkerized", -0.74, 0.74, 0.0, 0.8, 4.6, 5.15)                        # folded butt plate
    g.box("parkerized", -0.62, 0.62, 0.45, 0.85, -3.25, -2.75)                   # stock hinge
    # ---------------- magazine (32 rds) ----------------
    g.bone("mag", (0, -3.2, -0.1))
    g.box("black", -0.48, 0.48, -6.3, -3.0, -0.65, 0.5, pitch=-6, pivot=(0, 0.85, -0.1),
          bone="mag", pattern="ribs")
    g.box("black", -0.52, 0.52, -6.55, -6.25, -0.72, 0.58, pitch=-6, pivot=(0, 0.85, -0.1),
          bone="mag")
    return g
