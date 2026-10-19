"""The target tower (NE corner): glass curtain wall with a 45-degree chamfer facing the
intersection.  The four floors hit by the heat vision are left open in the main facade
and rebuilt from individually breakable panels (shattered later by fx_destruction)."""
import math
import numpy as np
import bpy

from city import MB, Facade
import timeline as TL

T = TL.TOWER


def faces():
    """Facade edges in CCW order: name -> (p0, p1)."""
    ax, ay = TL.CHAMFER_A
    bx, by = TL.CHAMFER_B
    return {
        "S": ((bx, by), (T["x1"], T["y0"])),
        "E": ((T["x1"], T["y0"]), (T["x1"], T["y1"])),
        "N": ((T["x1"], T["y1"]), (T["x0"], T["y1"])),
        "W": ((T["x0"], T["y1"]), (ax, ay)),
        "C": ((ax, ay), (bx, by)),
    }


# damage band: which part (u-range in metres) of which face is breakable
WRAP = 6.0


def damage_ranges():
    F = faces()
    rngs = {}
    LW = math.dist(*F["W"])
    rngs["W"] = (LW - WRAP, LW)                      # last metres of the west face before the chamfer
    rngs["C"] = (0.0, math.dist(*F["C"]))
    rngs["S"] = (0.0, WRAP)                          # first metres of the south face after the chamfer
    return rngs


def build_tower(coll, M):
    z0 = TL.CURB_H
    lobby = T["lobby_h"]
    fh = T["floor_h"]
    H = T["height"]
    dz0, dz1 = TL.DAMAGE_Z
    bay = 1.5
    mb = MB()        # main tower
    rng = damage_ranges()
    panels = []      # breakable glass panels
    slabs = []       # breakable slab-edge / spandrel segments
    mullions = []
    for name, (p0, p1) in faces().items():
        F = Facade(p0, p1)
        L = F.L
        # lobby: tall storefront-like glass with dark frames
        F.quad(mb, 0, L, z0, z0 + lobby, -0.6, "storefront")
        for uu in np.arange(0, L + 0.01, 3.0):
            F.box(mb, uu - 0.06, uu + 0.06, z0, z0 + lobby, -0.6, 0.0, "metal_dark", skip=("back",))
        F.box(mb, 0, L, z0 + lobby - 0.5, z0 + lobby, -0.6, 0.15, "metal_alu", skip=("back",))
        if name in ("W", "C", "S"):
            F.quad(mb, 0, L, z0, z0 + lobby, -6.0, "intimg6", uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
            mb.poly([F.P(0, -0.6, z0 + 0.02), F.P(L, -0.6, z0 + 0.02), F.P(L, -6.0, z0 + 0.02), F.P(0, -6.0, z0 + 0.02)],
                    "interior_floor")
            mb.poly([F.P(0, -0.6, z0 + lobby), F.P(0, -6.0, z0 + lobby), F.P(L, -6.0, z0 + lobby), F.P(L, -0.6, z0 + lobby)],
                    "interior_ceiling")
        zf0 = z0 + lobby
        r = rng.get(name)
        nb = max(1, int(round(L / bay)))
        b = L / nb

        def glass_span(u0, u1, za, zb):
            F.quad(mb, u0, u1, za, zb, 0.0, "glass_tower",
                   uv=[(u0, za - zf0), (u1, za - zf0), (u1, zb - zf0), (u0, zb - zf0)])
        if r is None:
            glass_span(0, L, zf0, H)
        else:
            ua, ub = r
            # snap the damage range to bay boundaries
            ua = math.floor(ua / b + 1e-6) * b
            ub = math.ceil(ub / b - 1e-6) * b
            glass_span(0, L, zf0, dz0)
            glass_span(0, L, dz1, H)
            if ua > 0:
                glass_span(0, ua, dz0, dz1)
            if ub < L:
                glass_span(ub, L, dz0, dz1)
            # breakable panels in the band
            nfl = int(round((dz1 - dz0) / fh))
            for j in range(nfl):
                za = dz0 + j * fh
                for i in range(int(round((ub - ua) / b))):
                    u0 = ua + i * b
                    panels.append(dict(face=name, o=tuple(F.o), d=tuple(F.d), n=tuple(F.n),
                                       u0=u0, u1=u0 + b, z0=za, z1=za + fh, zf0=zf0))
                    # spandrel / slab edge segment at the bottom of each floor
                    slabs.append(dict(face=name, o=tuple(F.o), d=tuple(F.d), n=tuple(F.n),
                                      u0=u0, u1=u0 + b, z0=za - 0.35, z1=za + 0.35))
            for i in range(int(round((ub - ua) / b)) + 1):
                u = ua + i * b
                for j in range(nfl):
                    za = dz0 + j * fh
                    mullions.append(dict(face=name, o=tuple(F.o), d=tuple(F.d), n=tuple(F.n),
                                         u=u, z0=za, z1=za + fh))
            # interior of the damaged floors: slabs, columns, dark offices, back wall
            for j in range(nfl + 1):
                zz = dz0 + j * fh
                F.box(mb, ua, ub, zz - 0.3, zz, -9.0, -0.4, "charred")
            for uu in np.arange(ua + 4.5, ub, 9.0):
                F.box(mb, uu - 0.45, uu + 0.45, dz0, dz1, -2.2, -1.3, "charred")
            F.quad(mb, ua, ub, dz0, dz1, -9.0, "charred")
        # mullion fins and transoms (outside the band only where glass is intact)
        for i in range(nb + 1):
            uc = i * b
            if r is not None and r[0] - 1e-3 <= uc <= r[1] + b:
                F.box(mb, max(0, uc - 0.035), min(L, uc + 0.035), zf0, dz0, 0.0, 0.14, "metal_alu", skip=("back",))
                F.box(mb, max(0, uc - 0.035), min(L, uc + 0.035), dz1, H, 0.0, 0.14, "metal_alu", skip=("back",))
            else:
                F.box(mb, max(0, uc - 0.035), min(L, uc + 0.035), zf0, H, 0.0, 0.14, "metal_alu", skip=("back",))
        nf = int(round((H - zf0) / fh))
        for j in range(nf + 1):
            zc = zf0 + j * fh
            if r is not None and dz0 - 0.1 <= zc <= dz1 + 0.1:
                ua, ub = r
                if ua > 0:
                    F.box(mb, 0, ua, zc - 0.05, zc + 0.05, 0.0, 0.05, "metal_alu", skip=("back",))
                if ub < L:
                    F.box(mb, ub, L, zc - 0.05, zc + 0.05, 0.0, 0.05, "metal_alu", skip=("back",))
            else:
                F.box(mb, 0, L, zc - 0.05, zc + 0.05, 0.0, 0.05, "metal_alu", skip=("back",))
        F.box(mb, 0, L, H - 1.5, H + 1.2, 0.0, 0.2, "metal_alu", skip=("back",))
    # roof
    ax, ay = TL.CHAMFER_A
    bx, by = TL.CHAMFER_B
    roof = [(bx, by, H), (T["x1"], T["y0"], H), (T["x1"], T["y1"], H), (T["x0"], T["y1"], H), (ax, ay, H)]
    mb.poly(roof, "roof")
    mb.box((30, 25, H), (50, 42, H + 9), "metal_dark")
    mb.box((38, 31, H + 9), (39, 32, H + 40), "metal_galv")
    ob = mb.build("E1_target_tower", coll, M)
    ob["cell_w"] = bay
    ob["cell_h"] = fh
    return ob, panels, slabs, mullions
