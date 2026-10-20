"""Assault rifles: AK-47 and M4A1."""
import math

from .model import GunModel


def curved_stack(g, mat, top_s, top_y, top_f, seg_len, depth, width, angles, bone="mag",
                 pattern=None, fpat=None, overlap=0.06):
    """Chain of boxes hanging down from (top_y, top_f), curving forward.
    angles: absolute pitch (deg) per segment, positive = bottom swings forward.
    Returns the bottom centre (y, f) and the last angle."""
    py, pf = top_y, top_f
    for a in angles:
        g.box(mat, top_s - width / 2, top_s + width / 2, py - seg_len, py + overlap,
              pf - depth / 2, pf + depth / 2, bone=bone, pitch=a, pivot=(top_s, py, pf),
              pattern=pattern, fpat=fpat)
        r = math.radians(a)
        py -= seg_len * math.cos(r)
        pf += seg_len * math.sin(r)
    return py, pf, angles[-1]


def floor_plate(g, mat, s_w, y, f, depth, angle, thick=0.22, bone="mag"):
    g.box(mat, -s_w / 2, s_w / 2, y - thick, y + 0.04, f - depth / 2, f + depth / 2,
          bone=bone, pitch=angle, pivot=(0, y, f))


def build_ak47():
    g = GunModel("ak47")
    bore = 1.9
    # ---------------- receiver ----------------
    g.box("blued", -0.62, 0.62, 0.75, 2.55, -1.8, 4.6)                           # receiver body
    g.box("blued", -0.55, 0.55, 2.55, 2.92, -1.6, 3.9)                           # dust cover
    g.box("blued", -0.42, 0.42, 2.92, 3.02, -1.2, 3.6)                           # cover crown
    g.box("blued", -0.5, 0.5, 2.3, 2.85, -2.05, -1.6, pitch=-25, pivot=(0, 2.3, -1.6))
    g.box("black", -0.645, -0.62, 1.15, 1.9, 2.3, 4.0, pattern="lines")          # mag-well dimple L
    g.box("black", 0.62, 0.66, 2.05, 2.45, 1.0, 2.9, pattern="port")             # ejection port R
    g.box("steel", 0.62, 1.12, 2.12, 2.42, 2.6, 2.95)                            # charging handle
    g.box("blued", 0.62, 0.74, 1.95, 2.25, -1.4, 1.6, pitch=4, pivot=(0.7, 2.1, 1.6))  # selector
    g.box("blued", 0.64, 0.8, 1.7, 2.1, 1.35, 1.7)                               # selector tab
    g.box("black", -0.64, 0.64, 0.75, 0.95, -1.8, 4.6)                           # receiver bottom
    for f in (-1.2, 0.4, 3.2, 4.2):                                              # rivets
        g.box("steel", 0.62, 0.68, 1.12, 1.24, f, f + 0.12)
        g.box("steel", -0.68, -0.62, 1.12, 1.24, f, f + 0.12)
    # rear sight block + leaf
    g.box("blued", -0.42, 0.42, 2.55, 3.25, 4.15, 5.25)
    g.box("black", -0.32, 0.32, 3.25, 3.42, 4.25, 5.15, pattern="lines")
    g.box("black", -0.12, 0.12, 3.42, 3.55, 4.3, 4.6)
    # ---------------- trigger group ----------------
    g.box("blued", -0.2, 0.2, 0.0, 0.2, 0.55, 2.35)                              # guard bottom
    g.box("blued", -0.2, 0.2, 0.0, 0.78, 2.15, 2.35)                             # guard front
    g.box("black", -0.11, 0.11, 0.2, 0.78, 1.3, 1.48, pitch=-15, pivot=(0, 0.78, 1.4))  # trigger
    # ---------------- pistol grip ----------------
    g.box("wood_dark", -0.46, 0.46, -1.95, 0.8, -0.05, 0.98, pitch=-18, pivot=(0, 0.8, 0.45),
          pattern="checker", fpat={"up": None, "down": None})
    g.box("black", -0.48, 0.48, -2.1, -1.9, -0.18, 0.95, pitch=-18, pivot=(0, 0.8, 0.45))
    # ---------------- stock (wood) ----------------
    g.box("blued", -0.5, 0.5, 1.0, 2.5, -2.35, -1.8)                             # rear trunnion
    g.box("wood", -0.52, 0.52, 1.18, 2.42, -7.7, -2.3, pitch=3.5, pivot=(0, 2.42, -2.3),
          pattern="grain")                                                        # comb
    g.box("wood", -0.55, 0.55, -0.55, 1.35, -7.7, -3.6, pitch=14, pivot=(0, 1.35, -7.7),
          pattern="grain")                                                        # lower stock
    g.box("wood", -0.5, 0.5, 0.55, 1.4, -4.4, -2.4, pitch=14, pivot=(0, 1.4, -2.4),
          pattern="grain")                                                        # wrist
    g.box("blued", -0.6, 0.6, -0.85, 2.3, -8.05, -7.65, pitch=3, pivot=(0, 2.3, -7.65))  # butt plate
    g.box("steel", -0.25, 0.25, 1.95, 2.18, -6.4, -6.0)                          # trap door
    # ---------------- handguards ----------------
    g.box("wood", -0.6, 0.6, 1.05, 2.35, 4.6, 9.4, pattern="grain")              # lower handguard
    g.box("wood_dark", -0.62, 0.62, 1.05, 1.25, 5.2, 9.0, pattern="grooves")     # finger grooves
    g.box("blued", -0.64, 0.64, 1.0, 2.4, 4.6, 4.85)                             # rear retainer
    g.box("blued", -0.64, 0.64, 1.0, 2.4, 9.3, 9.6)                              # front cap
    g.box("wood", -0.45, 0.45, 2.38, 3.0, 5.4, 9.2, pattern="grain")             # upper handguard
    g.box("blued", -0.27, 0.27, 2.45, 2.95, 9.2, 10.4)                           # gas tube
    g.box("blued", -0.27, 0.27, 2.45, 2.95, 4.6, 5.4)
    # ---------------- barrel & front ----------------
    g.tube("black", 0, bore, 4.6, 13.0, 0.56)                                    # barrel
    g.box("blued", -0.36, 0.36, 1.45, 3.05, 10.2, 10.85)                         # gas block
    g.box("steel", -0.12, 0.12, 1.25, 1.42, 9.6, 12.6)                           # cleaning rod
    g.box("blued", -0.36, 0.36, 1.4, 2.35, 11.9, 12.55)                          # front sight base
    g.box("blued", -0.36, 0.36, 2.35, 2.75, 12.1, 12.55)
    g.box("black", 0.24, 0.34, 2.75, 3.45, 12.2, 12.5)                           # sight ears
    g.box("black", -0.34, -0.24, 2.75, 3.45, 12.2, 12.5)
    g.box("black", -0.05, 0.05, 2.75, 3.3, 12.28, 12.42)                         # sight post
    g.box("blued", -0.22, 0.22, 1.25, 1.45, 11.6, 12.3)                          # bayonet lug
    g.box("black", -0.38, 0.38, bore - 0.38, bore + 0.38, 13.0, 14.25,
          fpat={"north": "muzzle"})                                              # slant brake
    g.box("black", -0.39, 0.39, bore + 0.08, bore + 0.39, 13.6, 14.27, pitch=-14,
          pivot=(0, bore + 0.39, 14.25))
    # ---------------- magazine (curved steel) ----------------
    g.bone("mag", (0, 0.8, 3.05))
    g.box("black", -0.5, 0.5, 0.55, 0.95, 2.25, 3.85, bone="mag")                # mag lip
    y, f, a = curved_stack(g, "black", 0, 0.62, 3.05, 1.3, 1.5, 0.92, [4, 12, 20, 28],
                           pattern="ribs")
    floor_plate(g, "blued", 1.04, y, f, 1.64, 30)
    return g


def build_m4a1():
    g = GunModel("m4a1")
    bore = 1.95
    # ---------------- upper receiver ----------------
    g.box("alu", -0.55, 0.55, 1.45, 2.55, -1.6, 4.2)                             # upper
    g.box("alu", -0.38, 0.38, 2.55, 2.85, -1.45, 4.2, pattern="rail")            # top rail
    g.box("alu", 0.55, 0.6, 1.85, 2.35, 0.2, 1.9, pattern="port")                # ejection port
    g.tube("alu", 0.72, 2.12, -1.2, -0.45, 0.4)                                  # forward assist
    g.box("black", 0.9, 1.02, 1.98, 2.26, -1.15, -0.5)
    g.box("alu", -0.32, 0.32, 2.35, 2.75, -1.9, -1.5)                            # charging handle
    g.box("alu", -0.55, 0.55, 2.4, 2.75, -2.05, -1.85)                           # handle latch
    # ---------------- lower receiver ----------------
    g.box("alu", -0.52, 0.52, 0.65, 1.45, -1.6, 3.7)                             # lower
    g.box("alu", -0.56, 0.56, 0.05, 1.0, 2.0, 3.75)                              # magwell
    g.box("alu", -0.58, 0.58, -0.1, 0.12, 1.95, 3.8)                             # magwell flare
    g.box("steel", 0.52, 0.6, 1.0, 1.25, 2.2, 2.45)                              # mag release
    g.box("black", -0.62, -0.52, 1.05, 1.3, -0.65, -0.05)                        # selector
    g.box("alu", -0.6, -0.52, 1.5, 1.95, 1.6, 2.2)                               # bolt catch
    g.box("alu", -0.5, 0.5, 0.95, 1.55, -2.3, -1.6)                              # receiver extension base
    # trigger guard + trigger
    g.box("alu", -0.24, 0.24, 0.0, 0.26, 0.5, 2.05)
    g.box("alu", -0.24, 0.24, 0.0, 0.7, 1.82, 2.05)
    g.box("black", -0.1, 0.1, 0.25, 0.7, 1.05, 1.2, pitch=-12, pivot=(0, 0.7, 1.1))
    # pistol grip (A2)
    g.box("polymer", -0.45, 0.45, -1.95, 0.7, -0.15, 0.8, pitch=-20, pivot=(0, 0.7, 0.35),
          pattern="stipple", fpat={"up": None, "down": None})
    g.box("polymer", -0.42, 0.42, -1.6, 0.3, 0.75, 0.95, pitch=-20, pivot=(0, 0.7, 0.35))  # finger rest
    # ---------------- stock ----------------
    g.tube("alu", 0, 2.0, -6.2, -2.3, 0.72)                                      # buffer tube
    g.box("polymer", -0.48, 0.48, 1.5, 2.62, -7.6, -4.4)                         # stock body
    g.box("polymer", -0.44, 0.44, 0.15, 1.55, -7.6, -6.5)                        # rear lower
    g.box("polymer", -0.4, 0.4, 0.95, 1.55, -6.7, -4.5, pitch=14, pivot=(0, 1.55, -4.5))
    g.box("rubber", -0.5, 0.5, 0.05, 2.66, -7.85, -7.55, pattern="ribs")          # butt pad
    g.box("alu", -0.22, 0.22, 1.25, 1.5, -5.9, -4.9)                             # adjust lever
    g.box("steel", -0.5, 0.5, 2.05, 2.25, -7.2, -6.9)                            # sling slot
    # ---------------- RIS handguard ----------------
    g.box("alu", -0.6, 0.6, 1.33, 2.57, 4.2, 8.6, pattern="vents")              # rail body
    g.box("alu", -0.33, 0.33, 2.57, 2.8, 4.3, 8.5, pattern="rail")               # top rail
    g.box("alu", -0.33, 0.33, 1.1, 1.33, 4.3, 8.5, pattern="rail")               # bottom rail
    g.box("alu", 0.6, 0.83, 1.62, 2.28, 4.3, 8.5, pattern="rail")                # right rail
    g.box("alu", -0.83, -0.6, 1.62, 2.28, 4.3, 8.5, pattern="rail")              # left rail
    g.box("alu", -0.64, 0.64, 1.3, 2.6, 4.2, 4.45)                               # delta ring
    # ---------------- barrel / front sight ----------------
    g.tube("black", 0, bore, 8.6, 11.0, 0.44)
    g.box("black", -0.34, 0.34, 1.6, 2.32, 8.75, 9.35)                           # gas block
    g.box("black", -0.16, 0.16, 2.32, 3.55, 8.95, 9.3, pitch=-9, pivot=(0, 2.32, 9.1))  # A-frame
    g.box("black", -0.32, 0.32, 3.35, 3.55, 8.85, 9.15)                          # sight wings
    g.box("black", -0.05, 0.05, 3.55, 3.85, 8.95, 9.05)                          # post
    g.box("black", -0.2, 0.2, 1.38, 1.6, 8.8, 9.3)                               # bayonet lug
    g.box("black", -0.3, 0.3, bore - 0.3, bore + 0.3, 11.0, 12.15, pattern="vents",
          fpat={"north": "muzzle"})                                              # birdcage
    # ---------------- red dot sight ----------------
    g.box("alu", -0.38, 0.38, 2.82, 3.05, 1.0, 2.6)                              # mount
    g.tube("alu", 0, 3.45, 1.2, 2.55, 0.85)                                       # body tube
    g.box("lens", -0.3, 0.3, 3.15, 3.75, 2.55, 2.6)                              # front lens
    g.box("lens", -0.3, 0.3, 3.15, 3.75, 1.15, 1.2)                              # rear lens
    g.box("black", -0.18, 0.18, 3.88, 4.0, 1.7, 2.05, pattern="knurl")           # turret
    g.box("black", 0.42, 0.55, 3.28, 3.62, 1.7, 2.05)
    # ---------------- magazine (STANAG) ----------------
    g.bone("mag", (0, 0.1, 2.88))
    y, f, a = curved_stack(g, "alu", 0, 0.12, 2.88, 1.35, 1.45, 0.88, [2, 6, 10],
                           pattern="ribs")
    floor_plate(g, "polymer", 0.98, y, f, 1.6, a + 2)
    return g
