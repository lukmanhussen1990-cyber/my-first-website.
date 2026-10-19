"""Pedestrian instancing from the humans library (see humans_build.py).

Each pedestrian = its own armature object (shared bone data) + linked-duplicate
body / clothing / hair / accessory meshes.  Colors come from object colors so
all instances can share the same mesh data and materials.
"""
import bpy
import math
import random
from mathutils import Vector, Matrix, Euler

LIB = "/opt/work/assets/humans.blend"
P = "mixamorig:"

SKIN = [(0.93, 0.74, 0.62), (0.87, 0.66, 0.52), (0.76, 0.55, 0.40), (0.62, 0.42, 0.29),
        (0.47, 0.31, 0.21), (0.34, 0.21, 0.14), (0.24, 0.15, 0.10), (0.85, 0.70, 0.55)]
HAIR = [(0.02, 0.015, 0.012), (0.035, 0.022, 0.015), (0.08, 0.05, 0.03), (0.16, 0.10, 0.06),
        (0.42, 0.30, 0.16), (0.55, 0.45, 0.30), (0.35, 0.33, 0.32), (0.015, 0.012, 0.01)]
JACKET = [(0.02, 0.02, 0.022), (0.03, 0.04, 0.07), (0.12, 0.13, 0.08), (0.36, 0.26, 0.15),
          (0.15, 0.15, 0.16), (0.10, 0.06, 0.04), (0.25, 0.04, 0.05), (0.12, 0.18, 0.28),
          (0.45, 0.42, 0.38), (0.05, 0.08, 0.06)]
TOP = [(0.8, 0.8, 0.78), (0.70, 0.66, 0.58), (0.3, 0.3, 0.31), (0.03, 0.03, 0.035), (0.05, 0.08, 0.18),
       (0.45, 0.05, 0.05), (0.08, 0.22, 0.12), (0.55, 0.40, 0.08), (0.6, 0.35, 0.35), (0.25, 0.35, 0.5)]
PANTS = [(0.06, 0.09, 0.16), (0.12, 0.18, 0.30), (0.25, 0.34, 0.48), (0.02, 0.02, 0.025),
         (0.40, 0.34, 0.24), (0.20, 0.20, 0.21), (0.05, 0.06, 0.10)]
SHOES = [(0.85, 0.85, 0.84), (0.02, 0.02, 0.02), (0.18, 0.10, 0.05), (0.6, 0.6, 0.62), (0.08, 0.08, 0.09)]
BAGS = [(0.03, 0.03, 0.035), (0.30, 0.18, 0.08), (0.55, 0.45, 0.30), (0.05, 0.10, 0.25), (0.5, 0.05, 0.05)]


def srgb(c):
    """Palette values are display (sRGB) colors; object colors are linear."""
    f = lambda x: x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return tuple(f(v) for v in c) + (1.0,)


def load_library(path=LIB):
    names = {}
    with bpy.data.libraries.load(path, link=False) as (df, dt):
        dt.objects = list(df.objects)
        dt.actions = list(df.actions)
    lib = {"male": {}, "female": {}, "actions": {}}
    for o in dt.objects:
        if o is None:
            continue
        for kind in ("male", "female"):
            if o.name == f"Rig_{kind}":
                lib[kind]["rig"] = o
            elif o.get("part") and o.parent and o.parent.name == f"Rig_{kind}":
                lib[kind][o["part"]] = o
    for a in dt.actions:
        if a is not None:
            lib["actions"][a.name] = a
    return lib


def _assign_slot(owner, action):
    try:
        if action.slots:
            owner.action_slot = action.slots[0]
    except Exception:
        pass


def random_outfit(kind, rng):
    o = {}
    o["top"] = rng.choices(["jacket", "long", "tee"], [0.5, 0.35, 0.15])[0]
    o["bottom"] = "pants" if rng.random() < 0.93 else "shorts"
    if o["bottom"] == "shorts":
        o["top"] = "tee"
    if kind == "female":
        o["hair"] = rng.choices(["long", "cap", "short"], [0.55, 0.3, 0.15])[0]
    else:
        o["hair"] = rng.choices(["short", "cap", "none"], [0.75, 0.15, 0.1])[0]
    o["skin"] = rng.choice(SKIN)
    o["hair_col"] = rng.choice(HAIR)
    o["top_col"] = rng.choice(JACKET if o["top"] == "jacket" else TOP)
    o["top_mat"] = "leather" if (o["top"] == "jacket" and rng.random() < 0.25) else "cloth"
    o["pants_col"] = rng.choice(PANTS)
    o["pants_mat"] = "denim" if rng.random() < 0.55 else "cloth"
    o["shoe_col"] = rng.choice(SHOES)
    acc = []
    r = rng.random()
    if r < 0.18:
        acc.append("Backpack")
    elif r < 0.30:
        acc.append("HipBag")
    if rng.random() < 0.12:
        acc.append("ShopBag")
    if rng.random() < 0.10:
        acc.append("Cup")
    if kind == "male" and o["hair"] != "none" and rng.random() < 0.12:
        acc.append("Cap")
    if rng.random() < 0.15:
        acc.append("Glasses")
    o["acc"] = acc
    o["acc_col"] = rng.choice(BAGS)
    o["height"] = rng.uniform(0.97, 1.11) if kind == "male" else rng.uniform(0.95, 1.06)
    o["girth"] = rng.uniform(0.93, 1.12)
    return o


def spawn_person(lib, kind, outfit, name, collection, loc=(0, 0, 0), heading=0.0, lod=1):
    """Create a pedestrian. heading: radians, 0 = facing -Y (south), pi/2 = facing +X... (Z rotation)."""
    L = lib[kind]
    rig = L["rig"].copy()                      # shares the armature data, own pose
    rig.name = name
    rig.animation_data_clear()
    collection.objects.link(rig)
    rig.location = loc
    rig.rotation_euler = (0, 0, heading)
    h, g = outfit["height"], outfit["girth"]
    rig.scale = (h * g, h * (0.5 + 0.5 * g), h)
    rig["kind"] = kind
    body_key = {"tee": "Body_tee", "long": "Body_long", "jacket": "Body_long"}[outfit["top"]]
    if outfit["bottom"] == "shorts":
        body_key = "Body_teeshorts"
    parts = [(body_key, outfit["skin"], None),
             ("Top_" + outfit["top"], outfit["top_col"], outfit["top_mat"]),
             ("Pants" if outfit["bottom"] == "pants" else "Shorts", outfit["pants_col"],
              outfit["pants_mat"] if outfit["bottom"] == "pants" else "cloth"),
             ("Shoes", outfit["shoe_col"], None)]
    if outfit["hair"] == "short":
        parts.append(("Hair_short", outfit["hair_col"], None))
    elif outfit["hair"] == "cap":
        parts.append(("Hair_cap", outfit["hair_col"], None))
    elif outfit["hair"] == "long":
        parts.append(("Hair_cap", outfit["hair_col"], None))
        parts.append(("Hair_longback", outfit["hair_col"], None))
    for a in outfit["acc"]:
        col = outfit["acc_col"] if a in ("Backpack", "HipBag") else (
            (0.85, 0.82, 0.75) if a in ("ShopBag", "Cup") else outfit["top_col"])
        parts.append((a, col, None))
    objs = []
    for key, col, mat in parts:
        src = L.get(key + "_L0") if lod == 0 and L.get(key + "_L0") is not None else L.get(key)
        if src is None:
            continue
        ob = src.copy()
        ob.name = f"{name}_{key}"
        collection.objects.link(ob)
        ob.parent = rig
        ob.matrix_parent_inverse = Matrix.Identity(4)
        for m in ob.modifiers:
            if m.type == 'ARMATURE':
                m.object = rig
        ob.color = srgb(col)
        if mat:
            mm = bpy.data.materials.get(f"H_{mat}")
            if mm:
                ob.material_slots[0].link = 'OBJECT'
                ob.material_slots[0].material = mm
        objs.append(ob)
    rig["parts"] = [o.name for o in objs]
    return rig


def add_strip(rig, action, start, repeat=1.0, scale=1.0, blend_in=0.0, blend_out=0.0, track_name=None,
              influence=None):
    ad = rig.animation_data or rig.animation_data_create()
    tr = None
    if track_name:
        tr = ad.nla_tracks.get(track_name)
    if tr is None:
        tr = ad.nla_tracks.new()
        if track_name:
            tr.name = track_name
    st = tr.strips.new(action.name, int(start), action)
    _assign_slot(st, action)
    st.scale = scale
    st.repeat = repeat
    st.blend_in = blend_in
    st.blend_out = blend_out
    st.extrapolation = 'HOLD_FORWARD'
    st.use_auto_blend = False
    if influence is not None:
        st.use_animated_influence = True
    return st
