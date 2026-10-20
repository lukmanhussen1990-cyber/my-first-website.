"""Sniper rifles: AWP-style (AI Arctic Warfare) and Barrett M82A1."""
from .model import GunModel


def scope(g, f_rear, f_front, y, tube=0.78, eye=1.02, obj=1.34, turret_f=None,
          ring_fs=(), ring_base_y=None, mat="black"):
    """Rifle scope along f centred at height y."""
    g.tube(mat, 0, y, f_rear + 0.6, f_front - 1.6, tube)                         # main tube
    g.tube(mat, 0, y, f_rear, f_rear + 1.2, eye, pattern="knurl")                # eyepiece
    g.tube(mat, 0, y, f_rear + 1.2, f_rear + 1.6, (eye + tube) / 2)              # ocular taper
    g.tube(mat, 0, y, f_front - 2.0, f_front - 1.55, (obj + tube) / 2)           # objective taper
    g.tube(mat, 0, y, f_front - 1.6, f_front, obj)                               # objective bell
    g.box("lens", -obj * 0.36, obj * 0.36, y - obj * 0.36, y + obj * 0.36, f_front, f_front + 0.02,
          fpat={"north": "scope_lens"})
    g.box("lens", -eye * 0.34, eye * 0.34, y - eye * 0.34, y + eye * 0.34, f_rear - 0.02, f_rear,
          fpat={"south": "scope_lens"})
    tf = turret_f if turret_f is not None else (f_rear + f_front) / 2 - 0.4
    g.tube(mat, 0, y + 0.55, tf - 0.3, tf + 0.3, 0.5)                              # (base ring)
    g.box(mat, -0.27, 0.27, y + tube / 2, y + tube / 2 + 0.55, tf - 0.27, tf + 0.27,
          pattern="knurl")                                                          # elevation turret
    g.box(mat, tube / 2, tube / 2 + 0.5, y - 0.27, y + 0.27, tf - 0.27, tf + 0.27,
          pattern="knurl")                                                          # windage turret
    g.box(mat, -tube / 2 - 0.35, -tube / 2, y - 0.22, y + 0.22, tf - 0.22, tf + 0.22)  # parallax knob
    base_y = ring_base_y if ring_base_y is not None else y - 1.0
    for rf in ring_fs:
        g.box(mat, -0.5, 0.5, y - tube / 2 - 0.12, y + tube / 2 + 0.12, rf - 0.28, rf + 0.28)  # ring
        g.box(mat, -0.42, 0.42, base_y, y - tube / 2, rf - 0.3, rf + 0.3)        # ring base


def build_awp():
    g = GunModel("awp")
    bore = 2.1
    # ---------------- action ----------------
    g.tube("black", 0, bore, -0.8, 3.6, 0.98)                                    # receiver
    g.box("black", -0.32, 0.32, bore + 0.4, bore + 0.62, -0.6, 3.4, pattern="rail")  # receiver rail
    g.box("black", 0.48, 0.52, bore - 0.15, bore + 0.32, 0.4, 2.0, pattern="port")   # ejection port
    g.bone("bolt", (0, bore, -0.3))
    g.tube("steel", 0, bore, -1.75, -0.6, 0.72, bone="bolt")                     # bolt shroud
    g.box("steel", 0.3, 1.25, bore - 0.05, bore + 0.18, -0.45, -0.2, bone="bolt", roll=28,
          pivot=(0.3, bore, -0.3))                                                # bolt handle
    g.box("black", 1.0, 1.42, bore - 0.62, bore - 0.2, -0.55, -0.1, bone="bolt")  # bolt knob
    # ---------------- scope ----------------
    scope(g, -2.4, 7.2, 3.95, tube=0.8, eye=1.05, obj=1.42, turret_f=2.1,
          ring_fs=(0.3, 3.1), ring_base_y=bore + 0.5)
    # ---------------- stock (olive drab polymer, thumbhole) ----------------
    g.box("polymer_od", -0.74, 0.74, 1.1, 2.4, 3.6, 10.0)                        # fore-end
    g.box("polymer_od", -0.76, 0.76, 1.35, 2.1, 9.6, 10.0)                       # fore-end tip
    g.box("polymer_od", -0.74, 0.74, 0.85, 1.62, -0.8, 3.6)                      # centre
    g.box("polymer_od", -0.6, 0.6, 1.65, 2.6, -1.8, -0.8, pitch=-10, pivot=(0, 1.65, -0.8))  # rear tang
    g.box("polymer_od", -0.52, 0.52, -1.65, 1.35, -1.0, 0.35, pitch=-11, pivot=(0, 1.0, -0.35),
          pattern="stipple", fpat={"up": None, "down": None})                    # thumbhole grip
    g.box("polymer_od", -0.55, 0.55, -1.95, -1.25, -6.6, -1.2)                   # lower bridge
    g.box("polymer_od", -0.62, 0.62, 1.75, 2.6, -6.7, -1.6)                      # comb
    g.box("polymer_od", -0.56, 0.56, 2.6, 2.95, -6.2, -2.6)                      # cheek piece
    g.box("black", -0.3, 0.3, 2.35, 2.95, -2.6, -2.35)                           # cheek adjust
    g.box("polymer_od", -0.7, 0.7, -1.95, 2.6, -9.1, -6.6)                       # butt
    g.box("black", -0.72, 0.72, -1.95, 2.62, -9.3, -9.1)                         # spacer
    g.box("rubber", -0.74, 0.74, -2.05, 2.72, -9.75, -9.3, pattern="ribs")       # butt pad
    g.box("black", -0.18, 0.18, -2.25, -1.95, -8.4, -7.6)                        # monopod stub
    # trigger guard + trigger
    g.box("black", -0.2, 0.2, 0.3, 0.5, -0.2, 1.4)
    g.box("black", -0.2, 0.2, 0.3, 0.9, 1.2, 1.4)
    g.box("steel", -0.09, 0.09, 0.5, 0.88, 0.45, 0.6, pitch=-12, pivot=(0, 0.88, 0.52))
    # ---------------- barrel ----------------
    g.tube("black", 0, bore, 10.0, 15.3, 0.6, pattern="lines")                   # fluted barrel
    g.box("black", -0.43, 0.43, bore - 0.43, bore + 0.43, 15.3, 16.6, pattern="vents",
          fpat={"north": "muzzle"})                                              # muzzle brake
    # ---------------- bipod (folded) ----------------
    g.box("black", -0.5, 0.5, 0.9, 1.2, 9.3, 9.9)                                # bipod mount
    g.box("black", 0.16, 0.4, 0.62, 0.88, 4.6, 9.6)                              # leg R
    g.box("black", -0.4, -0.16, 0.62, 0.88, 4.6, 9.6)                            # leg L
    g.box("rubber", 0.14, 0.42, 0.58, 0.9, 4.4, 4.7)
    g.box("rubber", -0.42, -0.14, 0.58, 0.9, 4.4, 4.7)
    # ---------------- magazine ----------------
    g.bone("mag", (0, 0.6, 2.1))
    g.box("black", -0.48, 0.48, 0.05, 0.9, 1.35, 2.85, bone="mag", pattern="ribs")
    g.box("black", -0.52, 0.52, -0.12, 0.08, 1.3, 2.9, bone="mag")
    return g


def build_barrett():
    g = GunModel("barrett")
    bore = 2.2
    # ---------------- upper receiver ----------------
    g.box("parkerized", -0.86, 0.86, 1.45, 3.0, -3.4, 6.0)                       # upper rear
    g.box("parkerized", -0.86, 0.86, 1.45, 3.0, 6.0, 10.4, pattern="holes")      # cooling holes section
    g.box("parkerized", -0.6, 0.6, 3.0, 3.22, -2.6, 6.2, pattern="rail")         # scope rail
    g.box("black", 0.86, 0.9, 1.9, 2.7, 0.2, 2.6, pattern="port")                # ejection port
    g.box("steel", 0.86, 1.25, 2.25, 2.55, 3.4, 3.9)                             # charging handle
    for f in (-2.6, -1.0, 4.4, 7.6, 9.6):                                       # cross pins
        g.box("steel", 0.86, 0.92, 1.65, 1.82, f, f + 0.18)
        g.box("steel", -0.92, -0.86, 1.65, 1.82, f, f + 0.18)
    # carry handle (folded, in front of scope)
    g.box("black", -0.12, 0.12, 3.0, 3.75, 7.0, 7.25)
    g.box("black", -0.12, 0.12, 3.0, 3.75, 8.9, 9.15)
    g.box("black", -0.15, 0.15, 3.75, 4.0, 7.0, 9.15, pattern="knurl")
    # ---------------- lower receiver & butt ----------------
    g.box("parkerized", -0.82, 0.82, 0.45, 1.5, -9.4, 3.2)                       # lower receiver
    g.box("parkerized", -0.84, 0.84, 1.45, 2.5, -9.4, -3.4)                      # rear upper of lower
    g.box("polymer", -0.7, 0.7, 2.5, 2.82, -8.0, -4.2)                           # cheek rest
    g.box("parkerized", -0.84, 0.84, -1.05, 0.5, -9.4, -6.6)                     # butt lower
    g.box("rubber", -0.9, 0.9, -1.2, 2.65, -10.25, -9.4, pattern="ribs")         # recoil pad
    g.box("black", -0.25, 0.25, -1.75, -1.05, -7.6, -6.9)                        # monopod socket
    g.box("parkerized", -0.8, 0.8, -0.2, 0.5, -6.6, -2.8, pitch=8, pivot=(0, 0.5, -2.8))  # lower slope
    # ---------------- grip / trigger ----------------
    g.box("polymer", -0.5, 0.5, -2.2, 0.75, -0.6, 0.65, pitch=-12, pivot=(0, 0.75, 0.0),
          pattern="checker", fpat={"up": None, "down": None})
    g.box("parkerized", -0.22, 0.22, -0.05, 0.2, 0.6, 2.0)
    g.box("parkerized", -0.22, 0.22, -0.05, 0.5, 1.8, 2.0)
    g.box("steel", -0.1, 0.1, 0.15, 0.48, 1.1, 1.26, pitch=-12, pivot=(0, 0.48, 1.18))
    g.box("steel", -0.98, -0.82, 0.7, 1.0, -0.6, -0.2)                           # safety
    # ---------------- scope ----------------
    scope(g, -1.8, 7.0, 4.35, tube=0.86, eye=1.12, obj=1.5, turret_f=2.4,
          ring_fs=(0.6, 4.0), ring_base_y=3.22)
    # ---------------- barrel, brake, bipod ----------------
    g.tube("black", 0, bore, 10.4, 17.4, 0.78, pattern="lines")
    g.box("parkerized", -0.95, 0.95, bore - 0.62, bore + 0.62, 17.4, 19.6)      # brake body
    g.box("bore", 0.95, 0.97, bore - 0.5, bore + 0.5, 17.7, 18.4)                # brake window R1
    g.box("bore", 0.95, 0.97, bore - 0.5, bore + 0.5, 18.75, 19.4)               # brake window R2
    g.box("bore", -0.97, -0.95, bore - 0.5, bore + 0.5, 17.7, 18.4)
    g.box("bore", -0.97, -0.95, bore - 0.5, bore + 0.5, 18.75, 19.4)
    g.box("parkerized", -0.62, 0.62, bore - 0.5, bore + 0.5, 19.6, 20.15, fpat={"north": "muzzle"})
    g.box("parkerized", -0.4, 0.4, bore - 0.45, bore + 0.45, 20.15, 20.4)
    g.box("parkerized", -0.95, 0.95, 1.2, 1.5, 10.2, 10.8)                       # bipod yoke
    g.box("black", 0.62, 0.86, 1.25, 1.5, 10.6, 15.8, yaw=3, pivot=(0.74, 1.4, 10.6))   # leg R
    g.box("black", -0.86, -0.62, 1.25, 1.5, 10.6, 15.8, yaw=-3, pivot=(-0.74, 1.4, 10.6))
    g.box("black", 0.6, 1.25, 1.2, 1.55, 15.6, 16.0, yaw=3, pivot=(0.74, 1.4, 10.6))    # feet
    g.box("black", -1.25, -0.6, 1.2, 1.55, 15.6, 16.0, yaw=-3, pivot=(-0.74, 1.4, 10.6))
    # ---------------- magazine (10 rds) ----------------
    g.bone("mag", (0, 0.45, 3.3))
    g.box("parkerized", -0.62, 0.62, -1.45, 0.5, 2.3, 4.3, bone="mag", pattern="ribs")
    g.box("parkerized", -0.66, 0.66, -1.6, -1.4, 2.25, 4.35, bone="mag")
    return g
