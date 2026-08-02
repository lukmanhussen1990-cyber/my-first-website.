"""Builds 64x64 Minecraft-style humanoid skins from a small role description.

The UV layout matches the modern 64x64 player skin, which is what
``geometry.npck.humanoid`` (see gen_rp.py) is mapped to.
"""

from pngwrite import Canvas, grain, rgb, shade

# origin of each cube block in the 64x64 sheet, plus (width, height, depth)
PARTS = {
    "head":       (0, 0, 8, 8, 8),
    "hat":        (32, 0, 8, 8, 8),
    "body":       (16, 16, 8, 12, 4),
    "jacket":     (16, 32, 8, 12, 4),
    "arm_r":      (40, 16, 4, 12, 4),
    "sleeve_r":   (40, 32, 4, 12, 4),
    "arm_l":      (32, 48, 4, 12, 4),
    "sleeve_l":   (48, 48, 4, 12, 4),
    "leg_r":      (0, 16, 4, 12, 4),
    "pants_r":    (0, 32, 4, 12, 4),
    "leg_l":      (16, 48, 4, 12, 4),
    "pants_l":    (0, 48, 4, 12, 4),
}


def faces(part):
    """face name -> (x, y, w, h) inside the sheet."""
    ox, oy, w, h, d = PARTS[part]
    return {
        "top":    (ox + d, oy, w, d),
        "bottom": (ox + d + w, oy, w, d),
        "right":  (ox, oy + d, d, h),
        "front":  (ox + d, oy + d, w, h),
        "left":   (ox + d + w, oy + d, d, h),
        "back":   (ox + d + w + d, oy + d, w, h),
    }


class Skin(Canvas):
    def __init__(self):
        super().__init__(64, 64)

    # -- whole-part helpers -------------------------------------------------
    def fill_part(self, part, color, top=None, bottom=None, back=None):
        for name, (x, y, w, h) in faces(part).items():
            col = color
            if name == "top" and top is not None:
                col = top
            elif name == "bottom" and bottom is not None:
                col = bottom
            elif name == "back" and back is not None:
                col = back
            elif name in ("right", "left"):
                col = shade(color, 0.93)
            self.rect(x, y, w, h, col)

    def band(self, part, y_from, y_to, color, sides=("front", "back", "right", "left")):
        """Horizontal band across the vertical faces of a part.

        ``y_from``/``y_to`` are measured from the top of the face.
        """
        for name in sides:
            x, y, w, h = faces(part)[name]
            self.rect(x, y + y_from, w, y_to - y_from, color)

    def stripe_v(self, part, face, x_from, x_to, color):
        x, y, w, h = faces(part)[face]
        self.rect(x + x_from, y, x_to - x_from, h, color)

    def px_on(self, part, face, dx, dy, color):
        x, y, _w, _h = faces(part)[face]
        self.set(x + dx, y + dy, color)

    def grain_part(self, part, amount=0.09, salt=0):
        ox, oy, w, h, d = PARTS[part]
        grain(self, ox, oy, 2 * (w + d), d + h, amount, salt)

    # -- composed features --------------------------------------------------
    def face_features(self, eye=rgb(0x2A2118), sclera=rgb(0xE8E4DC),
                      brow=None, mouth=rgb(0x5B4030), beard=None):
        f = faces("head")["front"]
        fx, fy = f[0], f[1]
        for ex in (1, 5):
            self.rect(fx + ex, fy + 3, 2, 1, sclera)
            self.set(fx + ex + (1 if ex == 1 else 0), fy + 3, eye)
        if brow:
            self.rect(fx + 1, fy + 2, 2, 1, brow)
            self.rect(fx + 5, fy + 2, 2, 1, brow)
        self.rect(fx + 3, fy + 5, 2, 1, mouth)
        if beard:
            self.rect(fx + 1, fy + 6, 6, 2, beard)
            self.rect(fx + 2, fy + 5, 1, 1, beard)
            self.rect(fx + 5, fy + 5, 1, 1, beard)

    def hair(self, color, fringe=2):
        """Hair on the top/back/sides of the head plus a fringe at the front."""
        for name in ("top", "back", "right", "left"):
            x, y, w, h = faces("head")[name]
            if name == "top":
                self.rect(x, y, w, h, color)
            else:
                self.rect(x, y, w, min(fringe + 1, h), color)
        x, y, w, h = faces("head")["front"]
        self.rect(x, y, w, fringe, color)

    def helmet(self, color, trim=None, visor=False):
        """Draw a helmet onto the hat (overlay) layer."""
        for name in ("top", "front", "back", "right", "left"):
            x, y, w, h = faces("hat")[name]
            if name == "top":
                self.rect(x, y, w, h, color)
            else:
                self.rect(x, y, w, 3, color)
        if visor:
            x, y, w, h = faces("hat")["front"]
            self.rect(x, y + 3, w, 2, color)
            self.rect(x + 2, y + 3, 4, 1, (0, 0, 0, 0))
        if trim:
            for name in ("front", "back", "right", "left"):
                x, y, w, h = faces("hat")[name]
                self.rect(x, y + 2, w, 1, trim)

    def crown(self, gold=rgb(0xF5D64C), dark=rgb(0xB3910F), gem=rgb(0xD0332F)):
        """Crown drawn on the hat layer: a band plus alternating spikes."""
        for name in ("front", "back", "right", "left"):
            x, y, w, h = faces("hat")[name]
            self.rect(x, y + 2, w, 2, gold)
            self.rect(x, y + 3, w, 1, dark)
            for i in range(0, w, 2):
                self.rect(x + i, y, 1, 2, gold)
            if name in ("front", "back"):
                self.set(x + w // 2, y + 2, gem)

    def hood(self, color, shade_col=None):
        shade_col = shade_col or shade(color, 0.8)
        for name in ("top", "back", "right", "left"):
            x, y, w, h = faces("hat")[name]
            self.rect(x, y, w, h, color)
        x, y, w, h = faces("hat")["front"]
        self.rect(x, y, w, 3, color)
        self.rect(x, y, 2, h, color)
        self.rect(x + w - 2, y, 2, h, color)
        self.rect(x, y + h - 1, w, 1, shade_col)

    def shoulder_pads(self, color):
        for part in ("sleeve_r", "sleeve_l"):
            for name in ("top", "front", "back", "right", "left"):
                x, y, w, h = faces(part)[name]
                if name == "top":
                    self.rect(x, y, w, h, color)
                else:
                    self.rect(x, y, w, 4, color)

    def tabard(self, color, emblem=None):
        for name in ("front", "back"):
            x, y, w, h = faces("jacket")[name]
            self.rect(x + 2, y, w - 4, h - 2, color)
        if emblem:
            x, y, w, h = faces("jacket")["front"]
            self.rect(x + 3, y + 3, 2, 4, emblem)
            self.rect(x + 2, y + 4, 4, 2, emblem)

    def belt(self, color, buckle=None):
        self.band("body", 8, 10, color)
        if buckle:
            self.px_on("body", "front", 3, 8, buckle)
            self.px_on("body", "front", 4, 8, buckle)

    def boots(self, color, height=4):
        for part in ("leg_r", "leg_l"):
            for name in ("front", "back", "right", "left"):
                x, y, w, h = faces(part)[name]
                self.rect(x, y + h - height, w, height, color)
            x, y, w, h = faces(part)["bottom"]
            self.rect(x, y, w, h, shade(color, 0.75))

    def gloves(self, color, height=3):
        for part in ("arm_r", "arm_l"):
            for name in ("front", "back", "right", "left"):
                x, y, w, h = faces(part)[name]
                self.rect(x, y + h - height, w, height, color)
            x, y, w, h = faces(part)["bottom"]
            self.rect(x, y, w, h, shade(color, 0.8))

    def finish(self, salt=0):
        for part in PARTS:
            self.grain_part(part, 0.08, salt)


def build_skin(spec):
    """spec is a dict; see gen_textures.ROLE_SKINS for the accepted keys."""
    s = Skin()
    tone = spec["skin"]
    shirt = spec["shirt"]
    pants = spec["pants"]

    s.fill_part("head", tone, top=shade(tone, 1.03), bottom=shade(tone, 0.82))
    s.fill_part("body", shirt, top=shade(shirt, 1.05), bottom=shade(shirt, 0.8))
    for part in ("arm_r", "arm_l"):
        s.fill_part(part, tone, top=shade(shirt, 1.02), bottom=shade(tone, 0.85))
        # short sleeves by default
        for name in ("front", "back", "right", "left"):
            x, y, w, h = faces(part)[name]
            s.rect(x, y, w, spec.get("sleeve_len", 4), shirt)
    for part in ("leg_r", "leg_l"):
        s.fill_part(part, pants, top=shade(pants, 1.03), bottom=shade(pants, 0.7))

    if spec.get("hair"):
        s.hair(spec["hair"], spec.get("fringe", 2))
    s.face_features(
        eye=spec.get("eye", rgb(0x2A2118)),
        sclera=spec.get("sclera", rgb(0xE8E4DC)),
        brow=spec.get("brow"),
        beard=spec.get("beard"),
    )
    if spec.get("hood"):
        s.hood(spec["hood"])
    if spec.get("helmet"):
        s.helmet(spec["helmet"], spec.get("helmet_trim"), spec.get("visor", False))
    if spec.get("crown"):
        s.crown(*spec["crown"]) if isinstance(spec["crown"], tuple) else s.crown()
    if spec.get("tabard"):
        s.tabard(spec["tabard"], spec.get("emblem"))
    if spec.get("pads"):
        s.shoulder_pads(spec["pads"])
    if spec.get("belt"):
        s.belt(spec["belt"], spec.get("buckle"))
    if spec.get("boots"):
        s.boots(spec["boots"], spec.get("boot_h", 4))
    if spec.get("gloves"):
        s.gloves(spec["gloves"])
    for extra in spec.get("extras", []):
        extra(s)
    s.finish(spec.get("salt", 0))
    return s
