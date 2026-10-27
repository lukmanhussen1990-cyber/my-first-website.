"""Drawing primitives for the reel: colours, easing, shaped text, characters and props (pycairo)."""
import math, os, random
import cairo
import uharfbuzz as hb

W, H = 1080, 1920
GROUND = 1190          # ground line / top of caption panel
WM_Y = 1265            # watermark centre line
FONT_DIR = os.path.expanduser('~/.fonts')

# ----------------------------------------------------------------------------- colour
def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))

C = {k: hexrgb(v) for k, v in dict(
    out='#100904', sky='#D8DBE6', wall='#E8DFD2', roof='#DED4C2', wood='#A07F53', wood_lt='#C6A276',
    wood_dk='#7E6040', glow='#ECDCBC', cream='#F2EEDE', warm='#F3E5C8', panel='#F5F3EF', panel_edge='#E4E2DE',
    cap_grey='#CFCBC4', cap_dark='#141414', gold='#B8892B', red='#A8322A', green='#2F6B4E',
    jesus_line='#C08D28', jesus_fill='#F5D28F', jesus_fill_lt='#FBE7B8', blue='#D1DFEC', grey='#C9C7C4',
    grey_dk='#A9A6A2', lav='#8E8A96', lav_lt='#A8A4B0', coin='#E0B341', coin_dk='#9A7420', gold_line='#C8962E',
    taupe='#C9BCA8', taupe_dk='#B3A691', beam='#FFF1D2', hat_red='#9C4A3C', hat_dk='#4A4552', hat_ochre='#B98A3E',
    feather='#F6F1E6', beard='#6E5640', bubble='#FBF9F5', handle='#8A6638', mud='#6F6257', mud_dk='#564B43',
    path_lt='#F7E7B5', skin_line='#9C6B45', bed='#E9E2D6', blanket='#B9C6D6', bag='#7A4E32',
).items()}

def set_c(ctx, col, a=1.0):
    ctx.set_source_rgba(col[0], col[1], col[2], a)

# ----------------------------------------------------------------------------- easing / timing
def clamp01(x):
    return 0.0 if x < 0 else 1.0 if x > 1 else x

def prog(t, a, b):
    if b <= a:
        return 1.0 if t >= b else 0.0
    return clamp01((t - a) / (b - a))

def ease_io(x):
    x = clamp01(x)
    return 4 * x * x * x if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2

def ease_out(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3

def ease_in(x):
    x = clamp01(x)
    return x * x * x

def ease_sine(x):
    x = clamp01(x)
    return -(math.cos(math.pi * x) - 1) / 2

def ease_back(x, s=1.5):
    """easeOutBack: ~8% overshoot with s=1.5"""
    x = clamp01(x)
    c3 = s + 1
    return 1 + c3 * (x - 1) ** 3 + s * (x - 1) ** 2

def pop(t, t0, dur=0.38):
    """scale for a pop-in with a small overshoot bounce"""
    return ease_back(prog(t, t0, t0 + dur))

def lerp(a, b, t):
    return a + (b - a) * t

def window(t, a, b, fade_in=0.3, fade_out=0.3):
    """1 inside [a,b] with eased fades"""
    if t < a or t > b:
        return 0.0
    return ease_sine(prog(t, a, a + fade_in)) * (1 - ease_sine(prog(t, b - fade_out, b)))

def breathe(t, period=3.2, phase=0.0):
    return math.sin(2 * math.pi * (t / period + phase))

# ----------------------------------------------------------------------------- text
class Font:
    def __init__(self, fam, file):
        self.fam = fam
        self.face = hb.Face(hb.Blob.from_file_path(os.path.join(FONT_DIR, file)))
        self.hbfont = hb.Font(self.face)
        self.upem = self.face.upem
        self.cface = cairo.ToyFontFace(fam)
        self._cache = {}

    def shape(self, text, size, tracking=0.0, features=None):
        key = (text, size, tracking, tuple(sorted((features or {}).items())))
        if key in self._cache:
            return self._cache[key]
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hbfont, buf, features or {})
        sc = size / self.upem
        x = 0.0
        gl = []
        n = len(buf.glyph_infos)
        for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
            gl.append((info.codepoint, x + pos.x_offset * sc, -pos.y_offset * sc))
            x += pos.x_advance * sc + (tracking if i < n - 1 else 0)
        res = (gl, x)
        self._cache[key] = res
        return res

    def width(self, text, size, tracking=0.0, features=None):
        return self.shape(text, size, tracking, features)[1]

    def glyphs(self, text, size, x, y, tracking=0.0, features=None):
        gl, w = self.shape(text, size, tracking, features)
        return [cairo.Glyph(g, x + gx, y + gy) for g, gx, gy in gl], w

FONTS = {}
def font(name):
    if not FONTS:
        FONTS.update(
            cap=Font('GIM Jakarta XB', 'GIMJakartaXB.ttf'),
            capb=Font('GIM Jakarta B', 'GIMJakartaB.ttf'),
            label=Font('GIM Playfair B', 'GIMPlayfairB.ttf'),
            labelxb=Font('GIM Playfair XB', 'GIMPlayfairXB.ttf'),
            serifk=Font('GIM Playfair K', 'GIMPlayfairK.ttf'),
            title=Font('GIM Cinzel K', 'GIMCinzelK.ttf'),
            titleb=Font('GIM Cinzel B', 'GIMCinzelB.ttf'),
        )
    return FONTS[name]

def text_path(ctx, fnt, text, size, x, y, anchor='center', tracking=0.0, features=None):
    """adds the text outline to the current path; (x,y) = anchor point on the baseline"""
    w = fnt.width(text, size, tracking, features)
    if anchor == 'center':
        x -= w / 2
    elif anchor == 'right':
        x -= w
    gl, _ = fnt.glyphs(text, size, x, y, tracking, features)
    ctx.set_font_face(fnt.cface)
    ctx.set_font_size(size)
    ctx.glyph_path(gl)
    return w

def draw_text(ctx, fnt, text, size, x, y, col, alpha=1.0, anchor='center', tracking=0.0, features=None):
    w = fnt.width(text, size, tracking, features)
    if anchor == 'center':
        x -= w / 2
    elif anchor == 'right':
        x -= w
    gl, _ = fnt.glyphs(text, size, x, y, tracking, features)
    ctx.set_font_face(fnt.cface)
    ctx.set_font_size(size)
    set_c(ctx, col, alpha)
    ctx.show_glyphs(gl)
    return w

def cap_height(fnt, size):
    return size * 0.72

# ----------------------------------------------------------------------------- basic shapes
def rrect(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()

def circle(ctx, x, y, r):
    ctx.new_sub_path()
    ctx.arc(x, y, r, 0, 2 * math.pi)
    ctx.close_path()

def ellipse(ctx, x, y, rx, ry):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(max(rx, 1e-3), max(ry, 1e-3))
    ctx.new_sub_path()
    ctx.arc(0, 0, 1, 0, 2 * math.pi)
    ctx.close_path()
    ctx.restore()

def stroke_style(ctx, lw, col=None, a=1.0):
    ctx.set_line_width(lw)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    if col is not None:
        set_c(ctx, col, a)

def fill_stroke(ctx, fill, line, lw, a=1.0):
    if fill is not None:
        set_c(ctx, fill, a)
        if line is not None:
            ctx.fill_preserve()
        else:
            ctx.fill()
    if line is not None:
        stroke_style(ctx, lw, line, a)
        ctx.stroke()

def line(ctx, pts, col, lw, a=1.0):
    ctx.move_to(*pts[0])
    for p in pts[1:]:
        ctx.line_to(*p)
    stroke_style(ctx, lw, col, a)
    ctx.stroke()

def glow(ctx, x, y, r, col, a=0.6, falloff=None):
    """soft radial glow limited to its bounding box"""
    if r <= 1 or a <= 0.002:
        return
    g = cairo.RadialGradient(x, y, 0, x, y, r)
    stops = falloff or [(0, 1.0), (0.35, 0.55), (0.7, 0.18), (1.0, 0.0)]
    for s, k in stops:
        g.add_color_stop_rgba(s, col[0], col[1], col[2], a * k)
    ctx.set_source(g)
    ctx.rectangle(x - r, y - r, 2 * r, 2 * r)
    ctx.fill()

def glow_ellipse(ctx, x, y, rx, ry, col, a=0.6):
    if rx <= 1 or ry <= 1 or a <= 0.002:
        return
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, ry / rx)
    glow(ctx, 0, 0, rx, col, a)
    ctx.restore()

def star4(ctx, x, y, r, col, a=1.0):
    """tiny 4-point sparkle"""
    ctx.move_to(x, y - r)
    k = r * 0.28
    ctx.curve_to(x + k * 0.3, y - k, x + k, y - k * 0.3, x + r, y)
    ctx.curve_to(x + k, y + k * 0.3, x + k * 0.3, y + k, x, y + r)
    ctx.curve_to(x - k * 0.3, y + k, x - k, y + k * 0.3, x - r, y)
    ctx.curve_to(x - k, y - k * 0.3, x - k * 0.3, y - k, x, y - r)
    ctx.close_path()
    set_c(ctx, col, a)
    ctx.fill()

# ----------------------------------------------------------------------------- characters
class Pose:
    """parameters of a stick figure; angles in radians measured from straight down, +ve = outward"""
    def __init__(self, **kw):
        self.la = 0.22     # left arm angle (screen-left arm), from vertical
        self.ra = 0.22
        self.lel = 0.0     # elbow bend
        self.rel = 0.0
        self.lhand = None  # explicit hand target (dx,dy) relative to shoulder
        self.rhand = None
        self.lelbow = None
        self.relbow = None
        self.walk = None   # walk phase (radians) or None
        self.stride = 1.0
        self.head_dx = 0.0
        self.head_dy = 0.0
        self.lean = 0.0    # body lean (radians, +ve to the right)
        self.breath = 0.0  # -1..1
        self.seated = False
        self.slump = 0.0   # 0..1 slumped posture
        self.chest_out = 0.0
        self.lhand_abs = None  # absolute hand targets (x,y); elbow bulges outward by *bulge px
        self.rhand_abs = None
        self.lbulge = 14.0
        self.rbulge = 14.0
        self.arms_front = False  # draw arms over the torso (hands resting on a table in front)
        for k, v in kw.items():
            setattr(self, k, v)

PERSON = dict(head_r=40, gap=6, torso_h=150, torso_wt=94, torso_wb=84, torso_r=24, leg=140, hip=17, lw=4.8)

def person_height(s=1.0):
    P = PERSON
    return (P['leg'] + P['torso_h'] + P['gap'] + 2 * P['head_r']) * s

def _abs_arm(sx, sy, side, hx, hy, bulge):
    mx, my = (sx + hx) / 2, (sy + hy) / 2
    dx, dy = hx - sx, hy - sy
    L = math.hypot(dx, dy) or 1.0
    # perpendicular pointing outward (away from the body centre) / downward
    nx, ny = -dy / L, dx / L
    if nx * side < 0 or (abs(nx) < 1e-3 and ny < 0):
        nx, ny = -nx, -ny
    return (sx, sy), (mx + nx * bulge, my + ny * bulge), (hx, hy)

def _arm_points(sx, sy, side, ang, bend, target, elbow, length):
    """returns (shoulder, elbow, hand) points. side: -1 left, +1 right"""
    if target is not None:
        hx, hy = sx + target[0], sy + target[1]
        if elbow is not None:
            ex, ey = sx + elbow[0], sy + elbow[1]
        else:
            ex, ey = (sx + hx) / 2, (sy + hy) / 2
        return (sx, sy), (ex, ey), (hx, hy)
    a1 = ang
    ex = sx + side * math.sin(a1) * length * 0.5
    ey = sy + math.cos(a1) * length * 0.5
    a2 = ang + bend
    hx = ex + side * math.sin(a2) * length * 0.5
    hy = ey + math.cos(a2) * length * 0.5
    return (sx, sy), (ex, ey), (hx, hy)

def person(ctx, x, gy, s=1.0, fill=None, line=None, pose=None, alpha=1.0, hat=None, beard=False, glasses=False,
           hair=None, patch=False, head_only=False, draw_legs=True, extra=None):
    """front-facing stick figure standing on ground y=gy, centred at x"""
    p = pose or Pose()
    fill = fill or C['blue']
    line = line or C['out']
    P = PERSON
    lw = P['lw'] * s
    hr = P['head_r'] * s
    th = P['torso_h'] * s * (1 + 0.012 * p.breath)
    leg = P['leg'] * s
    bob = 0.0
    if p.walk is not None:
        bob = -abs(math.sin(p.walk)) * 6 * s
    if p.seated:
        leg = 0.0
    hip_y = gy - leg + bob
    if p.seated:
        hip_y = gy
    top_y = hip_y - th
    ctx.save()
    if alpha < 1:
        ctx.push_group()
    ctx.translate(x, hip_y)
    ctx.rotate(p.lean)
    ctx.translate(-x, -hip_y)
    # legs
    if draw_legs and not p.seated:
        if p.walk is not None:
            sw = math.sin(p.walk) * 30 * s * p.stride
            feet = [(x - P['hip'] * s + sw, gy), (x + P['hip'] * s - sw, gy)]
            knees = [(x - P['hip'] * s + sw * 0.45, hip_y + leg * 0.52 - abs(sw) * 0.05),
                     (x + P['hip'] * s - sw * 0.45, hip_y + leg * 0.52 - abs(sw) * 0.05)]
            for (fx, fy), (kx, ky), hx in zip(feet, knees, (x - P['hip'] * s, x + P['hip'] * s)):
                ctx.move_to(hx, hip_y - 2)
                ctx.line_to(kx, ky)
                ctx.line_to(fx, fy)
        else:
            for hx in (x - P['hip'] * s, x + P['hip'] * s):
                ctx.move_to(hx, hip_y - 2)
                ctx.line_to(hx + (hx - x) * 0.08, gy)
        stroke_style(ctx, lw, line)
        ctx.stroke()
    # arms (behind torso edges)
    arm_len = 112 * s
    sw_arm = math.sin(p.walk) * 0.22 if p.walk is not None else 0.0
    shl = (x - P['torso_wt'] * s / 2 + 6 * s, top_y + 16 * s)
    shr = (x + P['torso_wt'] * s / 2 - 6 * s, top_y + 16 * s)
    if p.lhand_abs is not None:
        la = _abs_arm(shl[0], shl[1], -1, p.lhand_abs[0], p.lhand_abs[1], p.lbulge * s)
    else:
        la = _arm_points(shl[0], shl[1], -1, p.la + sw_arm, p.lel, p.lhand, p.lelbow, arm_len)
    if p.rhand_abs is not None:
        ra = _abs_arm(shr[0], shr[1], 1, p.rhand_abs[0], p.rhand_abs[1], p.rbulge * s)
    else:
        ra = _arm_points(shr[0], shr[1], 1, p.ra - sw_arm, p.rel, p.rhand, p.relbow, arm_len)
    def draw_arms():
        for pts in (la, ra):
            ctx.move_to(*pts[0])
            ctx.line_to(*pts[1])
            ctx.line_to(*pts[2])
        stroke_style(ctx, lw, line)
        ctx.stroke()
    if not p.arms_front:
        draw_arms()
    # torso (slightly tapered rounded shape)
    wt, wb, r = P['torso_wt'] * s * (1 + 0.05 * p.chest_out), P['torso_wb'] * s, P['torso_r'] * s
    ctx.new_path()
    ctx.move_to(x - wt / 2 + r, top_y)
    ctx.line_to(x + wt / 2 - r, top_y)
    ctx.curve_to(x + wt / 2 - r * 0.3, top_y, x + wt / 2, top_y + r * 0.3, x + wt / 2, top_y + r)
    ctx.line_to(x + wb / 2, hip_y - 6 * s)
    ctx.curve_to(x + wb / 2, hip_y, x + wb / 2 - 4 * s, hip_y, x + wb / 2 - 8 * s, hip_y)
    ctx.line_to(x - wb / 2 + 8 * s, hip_y)
    ctx.curve_to(x - wb / 2 + 4 * s, hip_y, x - wb / 2, hip_y, x - wb / 2, hip_y - 6 * s)
    ctx.line_to(x - wt / 2, top_y + r)
    ctx.curve_to(x - wt / 2, top_y + r * 0.3, x - wt / 2 + r * 0.3, top_y, x - wt / 2 + r, top_y)
    ctx.close_path()
    fill_stroke(ctx, fill, line, lw)
    if patch:
        rrect(ctx, x + 8 * s, top_y + th * 0.55, 22 * s, 20 * s, 3 * s)
        fill_stroke(ctx, mix(fill, C['out'], 0.12), line, lw * 0.6)
    if extra:
        extra(ctx, x, top_y, hip_y, s)
    if p.arms_front:
        draw_arms()
    # head
    hx = x + p.head_dx * s
    hy = top_y - P['gap'] * s - hr + p.head_dy * s
    circle(ctx, hx, hy, hr)
    fill_stroke(ctx, fill, line, lw)
    if hair is not None:
        ctx.save()
        circle(ctx, hx, hy, hr)
        ctx.clip()
        ellipse(ctx, hx, hy - hr * 0.95, hr * 1.05, hr * 0.55)
        set_c(ctx, hair)
        ctx.fill()
        ctx.restore()
        circle(ctx, hx, hy, hr)
        stroke_style(ctx, lw, line)
        ctx.stroke()
    if beard:
        ctx.save()
        circle(ctx, hx, hy, hr - lw * 0.5)
        ctx.clip()
        ctx.move_to(hx - hr, hy + hr * 0.05)
        ctx.curve_to(hx - hr * 0.6, hy + hr * 0.35, hx - hr * 0.2, hy + hr * 0.28, hx, hy + hr * 0.36)
        ctx.curve_to(hx + hr * 0.2, hy + hr * 0.28, hx + hr * 0.6, hy + hr * 0.35, hx + hr, hy + hr * 0.05)
        ctx.line_to(hx + hr, hy + hr * 1.2)
        ctx.line_to(hx - hr, hy + hr * 1.2)
        ctx.close_path()
        set_c(ctx, C['beard'])
        ctx.fill()
        ctx.restore()
        # beard tip
        ctx.move_to(hx - hr * 0.55, hy + hr * 0.82)
        ctx.curve_to(hx - hr * 0.3, hy + hr * 1.32, hx + hr * 0.3, hy + hr * 1.32, hx + hr * 0.55, hy + hr * 0.82)
        ctx.close_path()
        fill_stroke(ctx, C['beard'], line, lw * 0.8)
        circle(ctx, hx, hy, hr)
        stroke_style(ctx, lw, line)
        ctx.stroke()
    if glasses:
        for gx in (-0.38, 0.38):
            circle(ctx, hx + gx * hr, hy - hr * 0.05, hr * 0.27)
        ctx.move_to(hx - 0.11 * hr, hy - hr * 0.08)
        ctx.line_to(hx + 0.11 * hr, hy - hr * 0.08)
        stroke_style(ctx, lw * 0.6, line)
        ctx.stroke()
    if hat:
        draw_hat(ctx, hx, hy, hr, hat, line, lw)
    if alpha < 1:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    ctx.restore()
    return dict(head=(hx, hy), hr=hr, lhand=la[2], rhand=ra[2], lshoulder=la[0], rshoulder=ra[0], top=top_y, hip=hip_y)

def draw_hat(ctx, hx, hy, hr, hat, line, lw):
    """feathered beret. hat = dict(col=..., tilt=rad, feather=True)"""
    col = hat.get('col', C['hat_red'])
    tilt = hat.get('tilt', -0.18)
    ctx.save()
    ctx.translate(hx, hy - hr * 0.62)
    ctx.rotate(tilt)
    # feather (behind the crown)
    if hat.get('feather', True):
        ctx.move_to(hr * 0.35, -hr * 0.25)
        ctx.curve_to(hr * 0.95, -hr * 1.35, hr * 1.9, -hr * 1.25, hr * 2.05, -hr * 1.05)
        ctx.curve_to(hr * 1.55, -hr * 0.85, hr * 1.0, -hr * 0.45, hr * 0.62, -hr * 0.05)
        ctx.close_path()
        fill_stroke(ctx, hat.get('fcol', C['feather']), line, lw * 0.75)
        ctx.move_to(hr * 0.5, -hr * 0.15)
        ctx.curve_to(hr * 1.05, -hr * 0.8, hr * 1.5, -hr * 1.0, hr * 1.95, -hr * 1.08)
        stroke_style(ctx, lw * 0.45, line)
        ctx.stroke()
    # crown (soft dome)
    ctx.move_to(-hr * 1.12, hr * 0.12)
    ctx.curve_to(-hr * 1.1, -hr * 0.75, hr * 1.1, -hr * 0.75, hr * 1.12, hr * 0.12)
    ctx.curve_to(hr * 0.5, hr * 0.28, -hr * 0.5, hr * 0.28, -hr * 1.12, hr * 0.12)
    ctx.close_path()
    fill_stroke(ctx, col, line, lw * 0.9)
    ctx.restore()

def jesus(ctx, x, gy, s=1.0, pose=None, alpha=1.0, aura=1.0, t=0.0, facing=0.0, point_cam=0.0, hand_detail=True,
          bag=0.0, bag_side='left'):
    """Jesus: gold outline, warm yellow robe, cross on chest, soft aura.
    point_cam 0..1: right arm raises and points at the viewer (foreshortened)."""
    p = pose or Pose()
    J = C['jesus_line']
    s_lw = 4.8 * s
    hr = 40 * s
    robe_h = 250 * s * (1 + 0.010 * p.breath)
    legv = 46 * s
    bob = -abs(math.sin(p.walk)) * 6 * s if p.walk is not None else 0.0
    hem_y = gy - legv + bob
    top_y = hem_y - robe_h
    head_y = top_y - 6 * s - hr
    ctx.save()
    if alpha < 1:
        ctx.push_group()
    # aura
    if aura > 0:
        pul = 1 + 0.06 * math.sin(t * 2 * math.pi / 2.6)
        glow(ctx, x, top_y + robe_h * 0.25, 330 * s * pul, C['glow'], 0.55 * aura)
        glow(ctx, x, head_y, 150 * s * pul, mix(C['glow'], (1, 1, 1), 0.4), 0.55 * aura)
    # legs
    if p.walk is not None:
        sw = math.sin(p.walk) * 20 * s * p.stride
    else:
        sw = 0
    for hx, d in ((x - 16 * s, sw), (x + 16 * s, -sw)):
        ctx.move_to(hx, hem_y - 4 * s)
        ctx.line_to(hx + d, gy)
    stroke_style(ctx, s_lw, J)
    ctx.stroke()
    # arms
    arm_len = 112 * s
    sw_arm = math.sin(p.walk) * 0.2 if p.walk is not None else 0.0
    shl = (x - 40 * s, top_y + 18 * s)
    shr = (x + 40 * s, top_y + 18 * s)
    if p.lhand_abs is not None:
        la = _abs_arm(shl[0], shl[1], -1, p.lhand_abs[0], p.lhand_abs[1], p.lbulge * s)
    else:
        la = _arm_points(shl[0], shl[1], -1, p.la + sw_arm, p.lel, p.lhand, p.lelbow, arm_len)
    if p.rhand_abs is not None:
        ra = _abs_arm(shr[0], shr[1], 1, p.rhand_abs[0], p.rhand_abs[1], p.rbulge * s)
    else:
        ra = _arm_points(shr[0], shr[1], 1, p.ra - sw_arm, p.rel, p.rhand, p.relbow, arm_len)
    arms = [la]
    if point_cam < 0.999:
        arms.append(ra)
    for pts in arms:
        ctx.move_to(*pts[0])
        ctx.line_to(*pts[1])
        ctx.line_to(*pts[2])
    stroke_style(ctx, s_lw, J)
    ctx.stroke()
    # robe
    wt, wb = 98 * s, 132 * s
    ctx.new_path()
    ctx.move_to(x - wt / 2 + 18 * s, top_y)
    ctx.line_to(x + wt / 2 - 18 * s, top_y)
    ctx.curve_to(x + wt / 2 - 4 * s, top_y, x + wt / 2, top_y + 8 * s, x + wt / 2 + 1 * s, top_y + 24 * s)
    ctx.line_to(x + wb / 2, hem_y - 4 * s)
    ctx.curve_to(x + wb / 2, hem_y, x + wb / 2 - 3 * s, hem_y, x + wb / 2 - 6 * s, hem_y)
    ctx.line_to(x - wb / 2 + 6 * s, hem_y)
    ctx.curve_to(x - wb / 2 + 3 * s, hem_y, x - wb / 2, hem_y, x - wb / 2, hem_y - 4 * s)
    ctx.line_to(x - wt / 2 - 1 * s, top_y + 24 * s)
    ctx.curve_to(x - wt / 2, top_y + 8 * s, x - wt / 2 + 4 * s, top_y, x - wt / 2 + 18 * s, top_y)
    ctx.close_path()
    g = cairo.RadialGradient(x, top_y + robe_h * 0.32, 0, x, top_y + robe_h * 0.32, robe_h * 0.8)
    a1, a2 = C['jesus_fill_lt'], C['jesus_fill']
    g.add_color_stop_rgb(0, *a1)
    g.add_color_stop_rgb(1, *a2)
    ctx.set_source(g)
    ctx.fill_preserve()
    stroke_style(ctx, s_lw, J)
    ctx.stroke()
    # belt line
    by = top_y + robe_h * 0.56
    ctx.move_to(x - (wt + (wb - wt) * 0.56) / 2 + 2 * s, by)
    ctx.curve_to(x - 20 * s, by + 5 * s, x + 20 * s, by + 5 * s, x + (wt + (wb - wt) * 0.56) / 2 - 2 * s, by)
    stroke_style(ctx, s_lw * 0.7, J)
    ctx.stroke()
    # cross
    cx, cy = x + facing * 0, top_y + robe_h * 0.24
    ctx.move_to(cx, cy - 26 * s)
    ctx.line_to(cx, cy + 26 * s)
    ctx.move_to(cx - 15 * s, cy - 8 * s)
    ctx.line_to(cx + 15 * s, cy - 8 * s)
    stroke_style(ctx, s_lw * 0.85, J)
    ctx.stroke()
    # bag (held in one hand, in front of the robe)
    if bag > 0:
        bx, by = la[2] if bag_side == 'left' else ra[2]
        doctor_bag(ctx, bx, by + 6 * s, s * 0.9, alpha=bag)
    # head
    hx = x + p.head_dx * s
    hy = head_y + p.head_dy * s
    circle(ctx, hx, hy, hr)
    g = cairo.RadialGradient(hx - hr * 0.2, hy - hr * 0.2, 0, hx, hy, hr)
    g.add_color_stop_rgb(0, *C['jesus_fill_lt'])
    g.add_color_stop_rgb(1, *C['jesus_fill'])
    ctx.set_source(g)
    ctx.fill_preserve()
    stroke_style(ctx, s_lw, J)
    ctx.stroke()
    # pointing at the camera: foreshortened arm + big fingertip toward the viewer
    if point_cam > 0:
        k = ease_io(point_cam)
        sx, sy = shr
        hand_x = lerp(ra[2][0], x + 26 * s, k)
        hand_y = lerp(ra[2][1], top_y + 22 * s, k)
        ctx.move_to(sx, sy)
        ctx.line_to(lerp(ra[1][0], x + 52 * s, k), lerp(ra[1][1], top_y + 52 * s, k))
        ctx.line_to(hand_x, hand_y)
        stroke_style(ctx, s_lw * (1 + 0.5 * k), J)
        ctx.stroke()
        hand_front(ctx, hand_x, hand_y, s * (0.55 + 0.85 * k), k)
    if alpha < 1:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    ctx.restore()
    return dict(head=(hx, hy), hr=hr, lhand=la[2], rhand=ra[2], top=top_y, lshoulder=shl, rshoulder=shr)

def hand_front(ctx, x, y, s, k):
    """hand pointing straight at the viewer: fist seen from the front, index fingertip toward the camera"""
    J = C['jesus_line']
    lw = 4.8
    fill_lt, fill = C['jesus_fill_lt'], C['jesus_fill']
    def paint(path_fn, width=None):
        path_fn()
        g = cairo.RadialGradient(x, y - 10 * s, 0, x, y, 60 * s)
        g.add_color_stop_rgb(0, *fill_lt)
        g.add_color_stop_rgb(1, *fill)
        ctx.set_source(g)
        ctx.fill_preserve()
        stroke_style(ctx, width or lw, J)
        ctx.stroke()
    glow(ctx, x, y - 20 * s, 120 * s, (1, 0.95, 0.75), 0.55 * k)
    # back of the fist
    paint(lambda: rrect(ctx, x - 34 * s, y - 26 * s, 68 * s, 60 * s, 22 * s))
    # curled fingers (three knuckle bumps along the bottom)
    for i in range(3):
        fx = x - 20 * s + i * 20 * s
        paint(lambda fx=fx: (ctx.new_path(), rrect(ctx, fx - 10 * s, y + 8 * s, 20 * s, 28 * s, 9 * s)), lw * 0.8)
    # thumb tucked across the front
    paint(lambda: rrect(ctx, x - 30 * s, y - 2 * s, 46 * s, 18 * s, 9 * s), lw * 0.8)
    # index finger coming toward us: foreshortened finger + fingertip with nail
    paint(lambda: rrect(ctx, x + 2 * s, y - 52 * s, 30 * s, 40 * s, 14 * s))
    paint(lambda: circle(ctx, x + 17 * s, y - 50 * s, 17 * s))
    rrect(ctx, x + 9 * s, y - 62 * s, 16 * s, 14 * s, 6 * s)
    stroke_style(ctx, lw * 0.6, J)
    ctx.stroke()

def doctor_bag(ctx, x, y, s=1.0, alpha=1.0):
    """small doctor's bag hanging from (x,y)"""
    lw = 4.2 * s
    ctx.save()
    # handle
    ctx.move_to(x - 14 * s, y + 10 * s)
    ctx.curve_to(x - 14 * s, y - 8 * s, x + 14 * s, y - 8 * s, x + 14 * s, y + 10 * s)
    stroke_style(ctx, lw, C['out'], alpha)
    ctx.stroke()
    # body
    ctx.move_to(x - 40 * s, y + 18 * s)
    ctx.curve_to(x - 36 * s, y + 8 * s, x + 36 * s, y + 8 * s, x + 40 * s, y + 18 * s)
    ctx.line_to(x + 44 * s, y + 58 * s)
    ctx.curve_to(x + 44 * s, y + 64 * s, x + 40 * s, y + 66 * s, x + 34 * s, y + 66 * s)
    ctx.line_to(x - 34 * s, y + 66 * s)
    ctx.curve_to(x - 40 * s, y + 66 * s, x - 44 * s, y + 64 * s, x - 44 * s, y + 58 * s)
    ctx.close_path()
    fill_stroke(ctx, C['bag'], C['out'], lw, alpha)
    # clasp + cross
    ctx.move_to(x - 40 * s, y + 24 * s)
    ctx.line_to(x + 40 * s, y + 24 * s)
    stroke_style(ctx, lw * 0.6, C['out'], alpha)
    ctx.stroke()
    ctx.rectangle(x - 4 * s, y + 32 * s, 8 * s, 24 * s)
    ctx.rectangle(x - 12 * s, y + 40 * s, 24 * s, 8 * s)
    set_c(ctx, C['feather'], alpha)
    ctx.fill()
    ctx.restore()

def halo(ctx, x, y, r, a=1.0, bright=0.0, t=0.0):
    """gold ring above a head with a soft glow"""
    glow(ctx, x, y, r * (2.6 + 0.8 * bright), mix(C['glow'], (1, 0.95, 0.75), 0.4), (0.45 + 0.45 * bright) * a)
    ellipse(ctx, x, y, r, r * 0.32)
    stroke_style(ctx, 5.5, C['gold_line'], a)
    ctx.stroke()
    ellipse(ctx, x, y, r, r * 0.32)
    stroke_style(ctx, 2.0, mix(C['gold_line'], (1, 1, 1), 0.55 + 0.3 * bright), a)
    ctx.stroke()

# ----------------------------------------------------------------------------- props
def coin(ctx, x, y, r=15, flat=1.0, a=1.0, rot=0.0):
    """gold coin. flat=1 lying (perspective ellipse) .. 0 edge-on; rot spins in the image plane"""
    ry = max(2.0, r * (0.42 + 0.58 * (1 - flat)))
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    if flat > 0.2:
        ellipse(ctx, 0, 3, r, ry)
        fill_stroke(ctx, C['coin_dk'], C['out'], 3.0, a)
    ellipse(ctx, 0, 0, r, ry)
    fill_stroke(ctx, C['coin'], C['out'], 3.0, a)
    ellipse(ctx, -r * 0.15, -ry * 0.15, r * 0.55, ry * 0.5)
    stroke_style(ctx, 1.8, mix(C['coin'], (1, 1, 1), 0.55), a)
    ctx.stroke()
    ctx.restore()

def coin_stack(ctx, x, y, n, r=15, a=1.0):
    for i in range(n):
        coin(ctx, x, y - i * 7, r, 1.0, a)

def bubble(ctx, cx, cy, text, size=46, col=None, scale=1.0, alpha=1.0, tail='bl', fnt='labelxb', pad=(30, 18)):
    """speech bubble (reference style): near-white rounded rect, black outline, serif caps text"""
    if scale <= 0.01 or alpha <= 0.01:
        return
    f = font(fnt)
    tw = f.width(text, size, 2)
    w, h = tw + pad[0] * 2, size * 0.98 + pad[1] * 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    if alpha < 1:
        ctx.push_group()
    x0, y0 = -w / 2, -h / 2
    rrect(ctx, x0, y0, w, h, 24)
    fill_stroke(ctx, C['bubble'], C['out'], 5.0)
    # tail
    if tail:
        if tail == 'bl':
            tx, d = x0 + w * 0.28, -1
        elif tail == 'br':
            tx, d = x0 + w * 0.72, 1
        else:
            tx, d = 0, 0
        ctx.move_to(tx - 18, y0 + h - 2.5)
        ctx.line_to(tx + d * 30 - 6, y0 + h + 30)
        ctx.line_to(tx + 16, y0 + h - 2.5)
        set_c(ctx, C['bubble'])
        ctx.fill_preserve()
        stroke_style(ctx, 5.0, C['out'])
        ctx.stroke()
        # hide outline segment under the tail
        ctx.rectangle(tx - 15, y0 + h - 6, 29, 7)
        set_c(ctx, C['bubble'])
        ctx.fill()
    draw_text(ctx, f, text, size, 0, size * 0.36, col or C['red'], tracking=2)
    if alpha < 1:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    ctx.restore()

def quote_icon(ctx, cx, cy, r=90, scale=1.0, alpha=1.0, t=0.0):
    """gold quote marks over a soft glowing cream circle (reference style)"""
    if scale <= 0.01 or alpha <= 0.01:
        return
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    pul = 1 + 0.05 * math.sin(t * 2 * math.pi / 2.4)
    glow(ctx, 0, 0, r * 2.1 * pul, C['glow'], 0.55 * alpha)
    circle(ctx, 0, 0, r)
    g = cairo.RadialGradient(0, 0, 0, 0, 0, r)
    g.add_color_stop_rgba(0, *mix(C['glow'], (1, 1, 1), 0.35), alpha)
    g.add_color_stop_rgba(1, *C['glow'], alpha)
    ctx.set_source(g)
    ctx.fill()
    # opening (66) and closing (99) quote marks drawn as shapes
    def mark(bx, by, flip):
        ctx.save()
        ctx.translate(bx, by)
        if flip:
            ctx.rotate(math.pi)
        rr = r * 0.135
        circle(ctx, 0, 0, rr)
        ctx.move_to(-rr * 0.98, -rr * 0.1)
        ctx.curve_to(-rr * 1.05, -rr * 2.0, rr * 0.2, -rr * 2.75, rr * 1.15, -rr * 2.85)
        ctx.curve_to(rr * 0.35, -rr * 2.2, -rr * 0.05, -rr * 1.3, rr * 0.25, -rr * 0.6)
        ctx.close_path()
        ctx.restore()
    for qx, flip in ((-r * 0.34, False), (r * 0.34, True)):
        for dx in (-r * 0.13, r * 0.13):
            mark(qx + dx, r * 0.12 if not flip else -r * 0.16, flip)
    set_c(ctx, C['gold'], alpha)
    ctx.fill()
    ctx.restore()

def magnifier(ctx, cx, cy, r, draw_inside, angle=0.78, alpha=1.0, handle=1.0, zoom=2.0, focus=None):
    """magnifying glass. draw_inside(ctx) redraws the scene; it is rendered at `zoom` around `focus` inside the lens"""
    fx, fy = focus if focus else (cx, cy)
    ctx.save()
    if alpha < 1:
        ctx.push_group()
    # handle
    if handle > 0:
        hx0, hy0 = cx + math.cos(angle) * r * 1.02, cy + math.sin(angle) * r * 1.02
        L = r * 1.25 * handle
        hx1, hy1 = hx0 + math.cos(angle) * L, hy0 + math.sin(angle) * L
        ctx.move_to(hx0, hy0)
        ctx.line_to(hx1, hy1)
        stroke_style(ctx, r * 0.24 + 6, C['out'])
        ctx.stroke()
        ctx.move_to(hx0, hy0)
        ctx.line_to(hx1, hy1)
        stroke_style(ctx, r * 0.24 - 3, C['handle'])
        ctx.stroke()
    # lens content
    ctx.save()
    circle(ctx, cx, cy, r)
    ctx.clip()
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(zoom, zoom)
    ctx.translate(-fx, -fy)
    draw_inside(ctx)
    ctx.restore()
    # glass tint + shine
    circle(ctx, cx, cy, r)
    set_c(ctx, (1, 0.98, 0.92), 0.10)
    ctx.fill()
    ctx.new_path()
    ctx.arc(cx, cy, r * 0.72, math.radians(200), math.radians(245))
    stroke_style(ctx, r * 0.07, (1, 1, 1), 0.75)
    ctx.stroke()
    ctx.restore()
    # rim
    circle(ctx, cx, cy, r)
    stroke_style(ctx, r * 0.16 + 6, C['out'])
    ctx.stroke()
    circle(ctx, cx, cy, r)
    stroke_style(ctx, r * 0.16 - 2, C['gold_line'])
    ctx.stroke()
    circle(ctx, cx, cy, r - r * 0.04)
    stroke_style(ctx, 1.6, mix(C['gold_line'], (1, 1, 1), 0.5))
    ctx.stroke()
    if alpha < 1:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    ctx.restore()

def red_circle(ctx, cx, cy, rx, ry, p, lw=9, dashed=False, a=1.0, start=-1.7):
    """red annotation circle drawn on progressively (p 0..1), slight overshoot of the loop"""
    if p <= 0:
        return
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1, ry / rx)
    ctx.new_path()
    ctx.arc(0, 0, rx, start, start + 2 * math.pi * 1.04 * p)
    ctx.restore()
    if dashed:
        ctx.set_dash([lw * 2.2, lw * 1.6])
    stroke_style(ctx, lw, C['red'], a)
    ctx.stroke()
    ctx.set_dash([])

def red_x(ctx, cx, cy, r, p, lw=8, a=1.0):
    if p <= 0:
        return
    p1 = clamp01(p * 2)
    p2 = clamp01(p * 2 - 1)
    ctx.move_to(cx - r, cy - r)
    ctx.line_to(cx - r + 2 * r * p1, cy - r + 2 * r * p1)
    if p2 > 0:
        ctx.move_to(cx + r, cy - r)
        ctx.line_to(cx + r - 2 * r * p2, cy - r + 2 * r * p2)
    stroke_style(ctx, lw, C['red'], a)
    ctx.stroke()

def label(ctx, text, y=300, alpha=1.0, size=46, col=None, x=W / 2):
    """small gold serif caps label with a soft cream halo (reference style)"""
    if alpha <= 0.01:
        return
    f = font('label')
    ctx.save()
    # halo: stacked soft outlines
    for lw, a in ((20, 0.16), (12, 0.42), (6.5, 0.85)):
        text_path(ctx, f, text, size, x, y, tracking=3)
        stroke_style(ctx, lw, (0.985, 0.955, 0.875), a * alpha)
        ctx.stroke()
    draw_text(ctx, f, text, size, x, y, col or C['gold'], alpha, tracking=3)
    ctx.restore()

def title_emboss(ctx, text, x, y, size, alpha=1.0, scale=1.0):
    """embossed / outlined gold serif caps title (like the reference 'C.S. LEWIS')"""
    if alpha <= 0.01 or scale <= 0.01:
        return
    f = font('title')
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    if alpha < 1:
        ctx.push_group()
    # drop shadow
    text_path(ctx, f, text, size, 3, 5, tracking=4)
    stroke_style(ctx, 16, (0.2, 0.17, 0.22), 0.35)
    ctx.stroke_preserve()
    ctx.fill()
    # cream outline
    text_path(ctx, f, text, size, 0, 0, tracking=4)
    stroke_style(ctx, 15, (0.98, 0.95, 0.88))
    ctx.stroke()
    text_path(ctx, f, text, size, 0, 0, tracking=4)
    stroke_style(ctx, 3, mix(C['gold'], C['out'], 0.45))
    ctx.stroke_preserve()
    # gold fill with a subtle vertical sheen
    g = cairo.LinearGradient(0, -size * 0.75, 0, 0)
    g.add_color_stop_rgb(0, *mix(C['gold'], (1, 0.95, 0.7), 0.35))
    g.add_color_stop_rgb(0.55, *C['gold'])
    g.add_color_stop_rgb(1, *mix(C['gold'], C['out'], 0.12))
    ctx.set_source(g)
    ctx.fill()
    # inner highlight line
    text_path(ctx, f, text, size, -1.2, -1.6, tracking=4)
    ctx.save()
    ctx.clip()
    text_path(ctx, f, text, size, 1.5, 2.2, tracking=4)
    stroke_style(ctx, 2.2, (1, 0.97, 0.85), 0.55)
    ctx.stroke()
    ctx.restore()
    ctx.new_path()
    if alpha < 1:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    ctx.restore()

def bible_icon(ctx, cx, cy, r=150, alpha=1.0, scale=1.0, t=0.0, title=None, title_a=0.0, disc=None, rays=1.0):
    """open Bible with gold rays on a beige disc; optional glowing page title"""
    if alpha <= 0.01 or scale <= 0.01:
        return
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    if alpha < 1:
        ctx.push_group()
    # rays
    if rays > 0:
        n = 13
        for i in range(n):
            a = math.pi + math.pi * (i + 0.5) / n
            wob = 0.05 * math.sin(t * 3 + i)
            r0, r1 = r * 1.12, r * (1.38 + wob + (0.08 if i % 2 else 0))
            ctx.move_to(math.cos(a) * r0, math.sin(a) * r0)
            ctx.line_to(math.cos(a) * r1, math.sin(a) * r1)
        stroke_style(ctx, 7, C['gold_line'], rays)
        ctx.stroke()
    glow(ctx, 0, 0, r * 1.6, C['glow'], 0.45 + 0.4 * title_a)
    circle(ctx, 0, 0, r)
    set_c(ctx, disc or mix(C['glow'], C['wall'], 0.3))
    ctx.fill()
    # book
    bw, bh = r * 1.58, r * 0.9
    for side in (-1, 1):
        ctx.new_path()
        ctx.move_to(0, -bh * 0.42)
        ctx.curve_to(side * bw * 0.18, -bh * 0.56, side * bw * 0.36, -bh * 0.54, side * bw * 0.5, -bh * 0.46)
        ctx.line_to(side * bw * 0.5, bh * 0.44)
        ctx.curve_to(side * bw * 0.36, bh * 0.36, side * bw * 0.18, bh * 0.38, 0, bh * 0.5)
        ctx.close_path()
        fill_stroke(ctx, (0.985, 0.98, 0.97), C['out'], 6)
        # text lines
        for i in range(5):
            ly = -bh * 0.26 + i * bh * 0.14
            if title is not None and i == 0 and side == 1:
                continue
            x0, x1 = side * bw * 0.1, side * bw * 0.42
            ctx.move_to(x0, ly + (0.03 * bh if side < 0 else 0.03 * bh))
            ctx.line_to(x1, ly)
        stroke_style(ctx, 3.2, (0.62, 0.6, 0.57))
        ctx.stroke()
    ctx.move_to(0, -bh * 0.42)
    ctx.line_to(0, bh * 0.5)
    stroke_style(ctx, 5, C['out'])
    ctx.stroke()
    if title is not None and title_a > 0:
        fz = r * 0.26
        fw = font('labelxb').width(title, fz, 1.5)
        fz = min(fz, fz * (bw * 0.44) / fw)
        tx, ty = bw * 0.26, -bh * 0.26
        glow(ctx, tx, ty, r * 0.62, (1, 0.88, 0.5), 0.75 * title_a)
        draw_text(ctx, font('labelxb'), title, fz, tx, ty + fz * 0.36, C['gold'], title_a, tracking=1.5)
    if alpha < 1:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    ctx.restore()

def sun(ctx, cx, cy, r, t=0.0, bright=0.0, n_rays=20, ray_a=1.0):
    """big glowing sun: soft glow, gold disc outline, dashed rays (reference style)"""
    pul = 1 + 0.04 * math.sin(t * 2 * math.pi / 3.0)
    glow(ctx, cx, cy, r * (3.2 + 0.6 * bright) * pul, mix(C['glow'], (1, 0.93, 0.7), 0.3), 0.75)
    glow(ctx, cx, cy, r * 1.6, (1, 0.97, 0.86), 0.7)
    for i in range(n_rays):
        a = 2 * math.pi * i / n_rays + t * 0.05
        r0 = r * 1.45
        r1 = r * (2.05 + (0.18 if i % 2 else 0) + 0.06 * math.sin(t * 2 + i))
        ctx.move_to(cx + math.cos(a) * r0, cy + math.sin(a) * r0)
        ctx.line_to(cx + math.cos(a) * r1, cy + math.sin(a) * r1)
    stroke_style(ctx, 6.5, C['gold_line'], ray_a)
    ctx.stroke()
    circle(ctx, cx, cy, r)
    g = cairo.RadialGradient(cx, cy, 0, cx, cy, r)
    g.add_color_stop_rgb(0, 1.0, 0.97, 0.86)
    g.add_color_stop_rgb(1, *mix(C['glow'], C['jesus_fill'], 0.5))
    ctx.set_source(g)
    ctx.fill_preserve()
    stroke_style(ctx, 6, C['gold_line'])
    ctx.stroke()

def moon(ctx, cx, cy, r, a=1.0):
    glow(ctx, cx, cy, r * 3.2, (0.95, 0.955, 0.975), 0.8 * a)
    ctx.new_path()
    ctx.arc(cx, cy, r, math.radians(105), math.radians(255))
    stroke_style(ctx, 4.5, C['gold_line'], a)
    ctx.stroke()

def arrow_drawn(ctx, pts, p=1.0, col=None, lw=6, a=1.0, head=26):
    """hand-drawn style curved arrow along a cubic (4 points), drawn on with p"""
    col = col or C['cap_dark']
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = pts
    n = 40
    m = max(2, int(n * clamp01(p)))
    def bez(u):
        return ((1 - u) ** 3 * x0 + 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3 * x3,
                (1 - u) ** 3 * y0 + 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3 * y3)
    ptsl = [bez(i / n) for i in range(m + 1)]
    ctx.move_to(*ptsl[0])
    for q in ptsl[1:]:
        ctx.line_to(*q)
    stroke_style(ctx, lw, col, a)
    ctx.stroke()
    if p >= 0.98:
        ex, ey = bez(1.0)
        px, py = bez(0.94)
        ang = math.atan2(ey - py, ex - px)
        for da in (2.55, -2.55):
            ctx.move_to(ex, ey)
            ctx.line_to(ex + math.cos(ang + da) * head, ey + math.sin(ang + da) * head)
        stroke_style(ctx, lw, col, a)
        ctx.stroke()

# ----------------------------------------------------------------------------- hands
# local hand coordinates: wrist at (0,0), fingers toward -x, back of the hand up (-y)
HAND_POSES = {
    # limp, receiving hand (Adam / Caravaggio's Christ): index gently extended, others drooping in a fan
    'limp': dict(index=[(-46, -8), (-70, -7), (-95, -3)], middle=[(-48, -1), (-71, 4), (-92, 12)],
                 ring=[(-46, 5), (-66, 13), (-83, 24)], little=[(-42, 10), (-58, 19), (-71, 32)],
                 thumb=[(-18, 9), (-33, 17), (-47, 21)]),
    # God's hand: index straight and reaching, others loosely curled
    'reach': dict(index=[(-46, -7), (-72, -9), (-99, -10)], middle=[(-48, 0), (-70, 5), (-84, 15)],
                  ring=[(-46, 6), (-64, 13), (-73, 24)], little=[(-42, 11), (-55, 18), (-61, 28)],
                  thumb=[(-20, 9), (-38, 13), (-54, 9)]),
    # pointing: index extended, others curled into the palm
    'point': dict(index=[(-46, -6), (-70, -6), (-92, -5)], middle=[(-48, 1), (-61, 9), (-53, 16)],
                  ring=[(-45, 6), (-57, 13), (-49, 19)], little=[(-41, 10), (-51, 16), (-44, 21)],
                  thumb=[(-24, 7), (-40, 7), (-49, 3)]),
}

def hand(ctx, x, y, s=1.0, ang=0.0, pose='limp', fill=None, line=None, lw=4.8, flip=False, forearm=0.0,
         sleeve=None, alpha=1.0, mixpose=None, mixk=0.0):
    """cartoon hand: union of capsules with a clean merged outline.
    ang rotates the hand (0 = pointing left). forearm = length of forearm capsule toward +x."""
    fill = fill or C['jesus_fill']
    line = line or C['jesus_line']
    P = HAND_POSES[pose]
    if mixpose is not None and mixk > 0:
        Q = HAND_POSES[mixpose]
        P = {k: [(a[0] + (b[0] - a[0]) * mixk, a[1] + (b[1] - a[1]) * mixk) for a, b in zip(P[k], Q[k])] for k in P}
    widths = dict(index=10.5, middle=10.5, ring=10, little=9, thumb=11)
    ctx.save()
    if alpha < 1:
        ctx.push_group()
    ctx.translate(x, y)
    if flip:
        ctx.scale(-1, 1)
    ctx.rotate(ang)
    ctx.scale(s, s)
    def palm_path():
        ctx.new_path()
        ctx.move_to(4, -11)
        ctx.curve_to(-12, -14, -36, -14, -48, -10)
        ctx.curve_to(-53, -6, -52, 9, -44, 13)
        ctx.curve_to(-28, 16, -10, 15, 4, 11)
        ctx.close_path()
    def caps():
        for k, pts in P.items():
            ctx.move_to(*pts[0])
            for q in pts[1:]:
                ctx.line_to(*q)
            yield k
    lw_l = lw / s
    # outline pass
    if forearm > 0:
        ctx.move_to(0, 0)
        ctx.line_to(forearm, -4)
        stroke_style(ctx, 24 + 2 * lw_l, line)
        ctx.stroke()
    for k in caps():
        stroke_style(ctx, widths[k] + 2 * lw_l, line)
        ctx.stroke()
    palm_path()
    stroke_style(ctx, 2 * lw_l, line)
    ctx.stroke_preserve()
    ctx.fill()
    # fill pass
    if forearm > 0:
        ctx.move_to(0, 0)
        ctx.line_to(forearm, -4)
        stroke_style(ctx, 24, sleeve or fill)
        ctx.stroke()
    for k in caps():
        stroke_style(ctx, widths[k], fill)
        ctx.stroke()
    palm_path()
    set_c(ctx, fill)
    ctx.fill()
    # knuckle / finger separation hints
    for (k1, k2) in (('index', 'middle'), ('middle', 'ring'), ('ring', 'little')):
        p1, p2 = P[k1], P[k2]
        mx0 = ((p1[0][0] + p2[0][0]) / 2, (p1[0][1] + p2[0][1]) / 2)
        mx1 = ((p1[1][0] + p2[1][0]) / 2, (p1[1][1] + p2[1][1]) / 2)
        ctx.move_to(mx0[0] + 2, mx0[1])
        ctx.line_to(mx0[0] + (mx1[0] - mx0[0]) * 0.55, mx0[1] + (mx1[1] - mx0[1]) * 0.55)
    stroke_style(ctx, lw_l * 0.5, line, 0.75)
    ctx.stroke()
    if alpha < 1:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    ctx.restore()
