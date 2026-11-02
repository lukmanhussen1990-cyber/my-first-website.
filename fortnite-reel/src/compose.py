import numpy as np, subprocess, sys, os, math, json, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
FR_DIR, AUDIO, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ONLY = [float(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else None  # preview times -> PNGs
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
FPS, NF = TL['fps'], len(TL['frames'])
W, H = 1080, 1920
PIX = os.path.join(HERE, 'PixelifySans.ttf')
INTER_B = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
INTER_SB = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
EMOJI = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'
if not os.path.exists(INTER_B):
    import glob; c = glob.glob('/usr/share/fonts/**/Inter-Bold.*', recursive=True); INTER_B = c[0]; INTER_SB = glob.glob('/usr/share/fonts/**/Inter-SemiBold.*', recursive=True)[0]

def pix_font(size, wght=600):
    f = ImageFont.truetype(PIX, size)
    try: f.set_variation_by_axes([wght])
    except Exception: pass
    return f
clamp = lambda x, a=0, b=1: max(a, min(b, x))
def ease_out(x): x = clamp(x); return 1 - (1 - x) ** 3
def spring(t, k=16, d=7): return 0 if t <= 0 else 1 - math.exp(-d * t) * math.cos(k * t)

# ---------------- captions ----------------
CAPS = [
 (0.70, "You're live"), (2.10, "70,000 people"), (3.40, "watching"), (4.50, "Final circle"), (5.10, "in Fortnite"),
 (6.35, "And you just"), (7.12, "pooped your pants"), (8.68, "It's one versus one"), (10.12, "The storm"), (10.55, "is closing"),
 (11.53, "You can't leave"), (12.47, "You can't pause"), (13.47, "You can't even move"), (15.18, "Chat notices"),
 (16.41, "“Why is he sweating?”"), (17.73, "“Bro is shaking”"), (19.28, "The enemy"), (19.68, "is building"),
 (20.56, "You're building"), (21.66, "Your stomach"), (22.18, "is building too"), (23.46, "Then the smell"), (24.24, "reaches your nose"),
 (25.78, "Your eyes"), (26.22, "start watering"), (27.41, "On camera"), (28.43, "Chat thinks"), (28.88, "you're crying"),
 (29.89, "“He's so emotional”"), (31.66, "What you don't know"), (32.94, "A 16-year-old"), (33.92, "once won"),
 (34.40, "$3,000,000", 'gold'), (35.80, "at the Fortnite"), (36.52, "World Cup"), (37.51, "He was probably"), (38.30, "not sitting"),
 (39.06, "in poop"), (39.98, "You aim"), (40.74, "You shoot"), (41.53, "Victory Royale"), (42.88, "Chat explodes"),
 (44.42, "You stand up"), (45.00, "to celebrate…"), (46.03, "and chat"), (46.66, "sees the chair"), (47.90, "GG", 'gold'),
]
CAP_END = {}
for i, c in enumerate(CAPS):
    nxt = CAPS[i + 1][0] if i + 1 < len(CAPS) else 99
    CAP_END[i] = min(nxt, c[0] + (2.4 if len(c) > 2 else 1.9)) if i + 1 < len(CAPS) else 99
CAP_Y = 1095
_capcache = {}
def caption_img(i):
    if i in _capcache: return _capcache[i]
    c = CAPS[i]; gold = len(c) > 2
    lines = c[1].split('|')
    if gold:
        size = 150 if len(c[1]) < 12 else 128
        f = pix_font(size, 700); stroke = 12
    else:
        f = pix_font(84, 600); stroke = 8
    pad = 40
    sizes = [f.getbbox(l, stroke_width=stroke) for l in lines]
    lw = max(b[2] - b[0] for b in sizes); lh = max(b[3] - b[1] for b in sizes)
    while lw > W - 80 and not gold:
        f = pix_font(f.size - 4, 600); sizes = [f.getbbox(l, stroke_width=stroke) for l in lines]; lw = max(b[2] - b[0] for b in sizes); lh = max(b[3] - b[1] for b in sizes)
    gap = int(lh * 0.15)
    iw, ih = lw + pad * 2, lh * len(lines) + gap * (len(lines) - 1) + pad * 2
    img = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
    for j, l in enumerate(lines):
        bb = f.getbbox(l, stroke_width=stroke); x = (iw - (bb[2] - bb[0])) // 2 - bb[0]; y = pad + j * (lh + gap) - bb[1]
        if gold:
            # shadow
            sh = Image.new('RGBA', (iw, ih), (0, 0, 0, 0)); ImageDraw.Draw(sh).text((x + 6, y + 8), l, font=f, fill=(40, 15, 0, 200), stroke_width=stroke, stroke_fill=(40, 15, 0, 200))
            img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(4)))
            d = ImageDraw.Draw(img); d.text((x, y), l, font=f, fill=(0, 0, 0, 0), stroke_width=stroke, stroke_fill=(74, 30, 0, 255))
            mask = Image.new('L', (iw, ih), 0); ImageDraw.Draw(mask).text((x, y), l, font=f, fill=255)
            grad = np.zeros((ih, iw, 4), np.uint8); top = pad + j * (lh + gap); yy = np.clip((np.arange(ih) - top) / max(1, lh), 0, 1)[:, None]
            c1, c2, c3 = np.array([255, 250, 200]), np.array([255, 205, 40]), np.array([255, 140, 0])
            col = np.where(yy < 0.5, c1 + (c2 - c1) * (yy / 0.5), c2 + (c3 - c2) * ((yy - 0.5) / 0.5))
            grad[..., :3] = np.broadcast_to(col[:, None, :], (ih, iw, 3)).astype(np.uint8)
            grad[..., 3] = np.array(mask)
            img = Image.alpha_composite(img, Image.fromarray(grad, 'RGBA'))
        else:
            d = ImageDraw.Draw(img); d.text((x, y), l, font=f, fill=(255, 255, 255, 255), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    _capcache[i] = img; return img

# ---------------- emoji / chat text ----------------
_ef = ImageFont.truetype(EMOJI, 109)
def is_emo(ch): o = ord(ch); return o >= 0x1F000 or 0x2600 <= o <= 0x27BF or o in (0xFE0F, 0x200D) or 0x2B00 <= o <= 0x2BFF
def runs(s):
    out = []; cur = ''; ce = None
    for ch in s:
        e = is_emo(ch)
        if ce is None or e == ce: cur += ch; ce = e
        else: out.append((cur, ce)); cur = ch; ce = e
    if cur: out.append((cur, ce))
    return out
_emo_cache = {}
def emoji_img(seq, size):
    key = (seq, size)
    if key in _emo_cache: return _emo_cache[key]
    ims = []
    for ch in [c for c in seq if c not in '️‍']:
        s = ch + ('️' if ord(ch) < 0x1F000 else '')
        im = Image.new('RGBA', (136, 128), (0, 0, 0, 0)); ImageDraw.Draw(im).text((0, 0), s, font=_ef, embedded_color=True)
        bb = im.getbbox() or (0, 0, 128, 128); im = im.crop(bb); r = size / im.height; ims.append(im.resize((max(1, int(im.width * r)), size), Image.LANCZOS))
    w = sum(i.width for i in ims) + 3 * (len(ims) - 1); out = Image.new('RGBA', (max(1, w), size), (0, 0, 0, 0)); x = 0
    for i in ims: out.paste(i, (x, 0), i); x += i.width + 3
    _emo_cache[key] = out; return out

USERS = ["sus_potato", "lil_cheese", "pizza_goblin", "mango_mike", "cozy_cat", "storm_chaser", "sweaty_sam", "yeet_queen", "hotdog_hank",
         "potato_aim", "zoomer_zak", "goblin_mode", "bananaman77", "toasty_bread", "lagmaster", "w_spammer", "kevin_irl", "boba_bandit",
         "noodle_ninja", "captain_crunch3", "big_chungo", "pixel_pete", "llama_drama", "snackattack"]
UCOL = [(255, 92, 92), (79, 195, 255), (105, 240, 174), (255, 210, 63), (255, 122, 224), (179, 136, 255), (255, 158, 64), (0, 229, 255)]
F_USER = ImageFont.truetype(INTER_B, 30); F_MSG = ImageFont.truetype(INTER_SB, 30)
PHASES = [  # start, end, rate/s, messages
 (2.0, 15.2, 3.2, ["LETS GOOO", "final circle!!", "W streamer", "1v1 him 🔥", "clutch time", "ez dub", "gg incoming", "he's cracked fr", "first time here 👋", "POG", "build build build", "you got this", "🔥🔥🔥", "70k watching??", "no way he loses", "dub incoming", "lock in bro"]),
 (15.2, 19.2, 7, ["something's wrong", "💀💀💀", "he froze??", "u good bro?", "lag?", "why is he so still", "bro is SWEATING", "?????", "💀", "he's not moving", "is he ok", "blink twice bro"]),
 (19.2, 23.4, 6, ["BUILD FIGHT", "what was that sound 💀", "his stomach??", "💀💀", "build!!", "EDIT EDIT", "lmaooo", "why is his chair squeaking", "bro's mic picked that up 💀"]),
 (23.4, 28.4, 6, ["is he ok", "why is he sniffing", "his eyes??", "💀💀💀", "bro is tearing up", "allergies?", "😭", "he's about to cry"]),
 (28.4, 31.6, 9, ["❤️❤️❤️", "so emotional 😭", "W streamer ❤️", "he's crying 😭", "stay strong king ❤️", "❤️", "this means so much to him", "🥺❤️", "real ones cry", "❤️❤️"]),
 (31.6, 32.85, 4, ["focus!!", "storm closing", "❤️", "you got this"]),
 (37.4, 41.45, 5, ["CLUTCH IT", "aim aim aim", "come on!!", "🙏🙏", "1 HP??", "SHOOT", "he's locked in"]),
 (41.45, 46.35, 12, ["VICTORY ROYALE 🏆", "W W W W", "LETS GOOOO 🔥", "👑👑👑", "GG", "INSANE", "🔥🔥🔥🔥", "W", "HE DID IT", "🏆🏆🏆", "clip that W", "GOAT", "W W W"]),
 (47.35, 51.0, 15, ["💩💩💩", "THE CHAIR 💀", "💩", "BRO", "NOOOO 💀💀", "clip it", "💩💩💩💩", "ggs 💩", "WHAT IS THAT", "💀💀💀", "the chair 😭😭", "💩💩", "he stood up 💀", "CHAIR CAM 💩", "nahhh 💀"]),
]
FORCED = [(15.3, "something's wrong", False), (16.42, "why is he sweating", True), (17.74, "bro is shaking", True), (29.9, "he's so emotional", True), (42.9, "W W W W W", False)]
random.seed(11)
MSGS = []
for (a, b, rate, pool) in PHASES:
    t = a; i = 0
    while t < b:
        MSGS.append([t, random.choice(USERS), pool[i % len(pool)] if i < len(pool) else random.choice(pool), False]); i += 1
        t += random.expovariate(rate) * 0.7 + 0.3 / rate
for (t, m, hl) in FORCED: MSGS.append([t, random.choice(USERS), m, hl])
MSGS.sort(key=lambda m: m[0])
for i, m in enumerate(MSGS): m[1] = USERS[(i * 7) % len(USERS)]
CHAT_X, CHAT_Y, CHAT_W, CHAT_H = 34, 1240, 560, 420
ROW_H = 46
_msg_cache = {}
def msg_img(i):
    if i in _msg_cache: return _msg_cache[i]
    t, u, text, hl = MSGS[i]; col = UCOL[USERS.index(u) % len(UCOL)]
    img = Image.new('RGBA', (CHAT_W - 24, ROW_H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    if hl: d.rounded_rectangle((0, 2, CHAT_W - 26, ROW_H - 2), 10, fill=(255, 210, 63, 70))
    x = 8; y = 6
    d.text((x, y), u, font=F_USER, fill=col + (255,)); x += int(d.textlength(u, font=F_USER)); d.text((x, y), ": ", font=F_MSG, fill=(255, 255, 255, 255)); x += int(d.textlength(": ", font=F_MSG))
    for s, e in runs(text):
        if e:
            em = emoji_img(s, 32); img.paste(em, (x, y + 2), em); x += em.width + 4
        else:
            d.text((x, y), s, font=F_MSG, fill=(255, 255, 255, 255)); x += int(d.textlength(s, font=F_MSG))
    _msg_cache[i] = img; return img
def chat_visible(t): return 2.0 <= t < 32.85 or t >= 37.4
def draw_chat(base, t):
    if not chat_visible(t): return
    a_in = clamp((t - 2.0) / 0.25) if t < 3 else (clamp((t - 37.4) / 0.2) if 37.4 <= t < 38 else 1)
    panel = Image.new('RGBA', (CHAT_W, CHAT_H), (0, 0, 0, 0)); pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle((0, 0, CHAT_W - 1, CHAT_H - 1), 24, fill=(10, 8, 18, 150))
    pd.text((18, 12), "STREAM CHAT", font=ImageFont.truetype(INTER_B, 22), fill=(180, 170, 210, 255))
    vis = [i for i, m in enumerate(MSGS) if m[0] <= t]
    if t >= 46.35 and t < 47.35: vis = [i for i in vis if MSGS[i][0] < 46.35]
    if vis:
        newest = vis[-1]; s = ease_out((t - MSGS[newest][0]) / 0.09)
        y = CHAT_H - 12 - ROW_H + int(ROW_H * (1 - s))
        for i in reversed(vis[-12:]):
            if y < 40: break
            im = msg_img(i)
            if i == newest and s < 1:
                im = im.copy(); im.putalpha(im.getchannel('A').point(lambda v: int(v * s)))
            panel.paste(im, (12, y), im); y -= ROW_H
    # fade top
    fade = np.array(panel); h = 90; fade[44:44 + h, :, 3] = (fade[44:44 + h, :, 3] * np.linspace(0.0, 1, h)[:, None]).astype(np.uint8); fade[:44, :, 3] = np.where(np.array(panel)[:44, :, 3] > 0, np.minimum(fade[:44, :, 3], 150), 0)
    panel = Image.fromarray(fade)
    hdr = ImageDraw.Draw(panel); hdr.rounded_rectangle((0, 0, CHAT_W - 1, 44), 24, fill=(10, 8, 18, 150)); hdr.text((18, 10), "STREAM CHAT", font=ImageFont.truetype(INTER_B, 22), fill=(190, 180, 220, 255))
    if a_in < 1: panel.putalpha(panel.getchannel('A').point(lambda v: int(v * a_in)))
    base.alpha_composite(panel, (CHAT_X, CHAT_Y))

# ---------------- LIVE badge + counter ----------------
F_BADGE = ImageFont.truetype(INTER_B, 34)
def viewers(t):
    if t < 2.1: return 69412 + int(t * 100)
    if t < 3.9: return int(70000 * ease_out((t - 2.1) / 1.6))
    if t < 42.9: return 70000 + int(140 * math.sin(t * 1.3) + 60 * math.sin(t * 3.7))
    if t < 47.35: return int(70000 + 14000 * ease_out((t - 42.9) / 2.0))
    return int(84000 + 1120000 * ease_out((t - 47.35) / 2.2) ** 1.6)
def draw_badge(base, t):
    if 32.85 <= t < 37.4: return
    v = viewers(t) if t >= 2.1 else 0
    d = ImageDraw.Draw(base); x, y = 40, 150
    d.rounded_rectangle((x, y, x + 120, y + 56), 12, fill=(229, 25, 22, 255))
    blink = 1 if (t * 1.5) % 1 < 0.7 else 0.35
    d.ellipse((x + 16, y + 20, x + 32, y + 36), fill=(255, 255, 255, int(255 * blink)))
    d.text((x + 40, y + 9), "LIVE", font=F_BADGE, fill=(255, 255, 255, 255))
    if t >= 2.1:
        txt = f"{v:,} watching"; tw = d.textlength(txt, font=F_BADGE)
        pop = 1 + 0.12 * max(0, 1 - abs(t - 3.9) / 0.15) + (0.1 if t > 47.35 and (t * 8) % 1 < 0.5 else 0)
        d.rounded_rectangle((x + 132, y, x + 132 + tw + 80, y + 56), 12, fill=(0, 0, 0, 160))
        ex, ey = x + 152, y + 28  # eye icon
        d.ellipse((ex, ey - 10, ex + 30, ey + 10), outline=(255, 255, 255, 255), width=4); d.ellipse((ex + 9, ey - 6, ex + 21, ey + 6), fill=(255, 255, 255, 255))
        col = (255, 255, 255, 255) if t < 47.35 else (255, 230, 80, 255)
        d.text((x + 194, y + 9), txt, font=F_BADGE, fill=col)

# ---------------- effects schedule ----------------
SHAKES = [(7.10, 0.4, 24), (8.42, 0.18, 7), (10.05, 0.3, 8), (19.2, 0.12, 6), (20.55, 0.1, 8), (20.80, 0.1, 8), (21.05, 0.1, 8), (21.30, 0.1, 8),
          (22.72, 0.4, 16), (40.80, 0.3, 22), (41.45, 0.55, 18), (42.95, 0.5, 12), (44.35, 0.3, 10), (46.0, 0.25, 8), (47.30, 0.35, 12)]
CONT_SHAKE = [(17.65, 19.2, 9), (21.6, 23.4, 6), (13.4, 15.1, 1.5)]
def shake(t):
    a = 0
    for (t0, d, amp) in SHAKES:
        if t0 <= t < t0 + d: a = max(a, amp * (1 - (t - t0) / d))
    for (a0, b0, amp) in CONT_SHAKE:
        if a0 <= t < b0: a = max(a, amp)
    if a == 0: return 0, 0
    return a * math.sin(t * 97.3) * math.cos(t * 23.1), a * math.cos(t * 83.7) * math.sin(t * 31.9 + 1)
ZOOMS = [(7.10, 0.12, 0.10, 0.9), (34.40, 0.12, 0.12, 1.4), (40.80, 0.08, 0.07, 0.6), (41.45, 0.1, 0.10, 1.2), (12.42, 0.1, 0.05, 0.9), (24.45, 0.1, 0.05, 1.2)]
def zoom(t):
    z = 1
    for (t0, rise, amt, hold) in ZOOMS:
        if t0 <= t < t0 + rise + hold + 0.4:
            lt = t - t0; k = ease_out(lt / rise) if lt < rise else (1 if lt < rise + hold else 1 - ease_out((lt - rise - hold) / 0.4))
            z = max(z, 1 + amt * k)
    return z
FLASHES = [(7.10, 0.08, (255, 255, 255), 0.35), (32.85, 0.12, (255, 255, 255), 0.6), (40.82, 0.12, (255, 255, 255), 0.85), (41.45, 0.35, (255, 210, 90), 0.65), (34.40, 0.1, (255, 230, 150), 0.45), (47.33, 0.08, (255, 255, 255), 0.25)]
def tints(t):
    out = []
    if 10.05 <= t < 11.45: out.append(((120, 40, 200), 0.13))
    if 23.4 <= t < 27.3: out.append(((60, 200, 60), 0.05 + 0.05 * clamp((t - 23.4) / 2)))
    if t >= 47.8: out.append(((70, 170, 50), 0.45 * ease_out((t - 47.8) / 2.2)))
    for (t0, d, c, a) in FLASHES:
        if t0 <= t < t0 + d: out.append((c, a * (1 - (t - t0) / d)))
    return out
WEBCAM = [(0, 2.0), (16.35, 17.65), (27.3, 28.4), (29.8, 31.55), (42.8, 44.35), (45.95, 47.8)]
def webcam_frame(base, t):
    if not any(a <= t < b for a, b in WEBCAM): return
    d = ImageDraw.Draw(base); m = 70; L = 90; c = (255, 255, 255, 200); w = 7; top = 260; bot = H - 330
    for (x, y, dx, dy) in [(m, top, 1, 1), (W - m, top, -1, 1), (m, bot, 1, -1), (W - m, bot, -1, -1)]:
        d.line([(x, y), (x + dx * L, y)], fill=c, width=w); d.line([(x, y), (x, y + dy * L)], fill=c, width=w)
    d.ellipse((W - m - 150, top + 24, W - m - 130, top + 44), fill=(255, 40, 40, 255) if (t * 2) % 1 < 0.6 else (255, 40, 40, 80))
    d.text((W - m - 120, top + 18), "REC", font=ImageFont.truetype(INTER_B, 26), fill=(255, 255, 255, 220))
# 2D confetti
CONF = [(random.random(), random.random(), random.random(), random.choice([(255, 210, 63), (64, 196, 255), (255, 255, 255), (255, 79, 163), (124, 77, 255), (105, 240, 174)])) for _ in range(160)]
def confetti(base, t, t0, t1, amount=1.0):
    if not (t0 <= t < t1): return
    d = ImageDraw.Draw(base); lt = t - t0
    for i, (a, b, c, col) in enumerate(CONF):
        if i / len(CONF) > amount: break
        y = (-200 + (b * 2200 + lt * (500 + c * 700))) % 2300 - 150; x = a * W + 40 * math.sin(lt * 3 + i)
        ang = lt * (4 + c * 6) + i; w, h = 26 * (0.6 + c), 14 * (0.6 + c)
        pts = [(x + math.cos(ang) * dx - math.sin(ang) * dy, y + math.sin(ang) * dx * abs(math.cos(lt * 5 + i)) + math.cos(ang) * dy) for dx, dy in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]]
        d.polygon(pts, fill=col + (235,))
# vignette
yy, xx = np.mgrid[0:H, 0:W]; rr = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
VIG = Image.fromarray((np.clip((rr - 0.75) / 0.6, 0, 1) * 110).astype(np.uint8), 'L')
BLACK = Image.new('RGBA', (W, H), (0, 0, 0, 255))

def frame(f):
    t = f / FPS
    src = Image.open(os.path.join(FR_DIR, f"f{f:05d}.jpg")).convert('RGB')
    z = zoom(t) * 1.03; dx, dy = shake(t)
    sw, sh = src.size; ox, oy = dx * sw / W, dy * sh / H
    z = max(z, 1 / max(0.5, 1 - 2 * abs(ox) / sw - 0.002), 1 / max(0.5, 1 - 2 * abs(oy) / sh - 0.002))
    cw, ch = sw / z, sh / z; cx = min(max(sw / 2 + ox, cw / 2), sw - cw / 2); cy = min(max(sh / 2 + oy, ch / 2), sh - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    img = src.resize((W, H), Image.LANCZOS, box=box).convert('RGBA')
    for (c, a) in tints(t):
        if a > 0.003: img = Image.blend(img, Image.new('RGBA', (W, H), c + (255,)), a)
    img.paste(BLACK, (0, 0), VIG)
    confetti(img, t, 34.40, 35.80, 0.7); confetti(img, t, 41.45, 46.0, 1.0)
    webcam_frame(img, t)
    draw_badge(img, t)
    draw_chat(img, t)
    # caption
    for i, c in enumerate(CAPS):
        if c[0] <= t < CAP_END[i]:
            ci = caption_img(i); lt = t - c[0]; gold = len(c) > 2
            s = (0.6 + 0.4 * spring(lt * 1.2, 18, 7)) if gold else (0.85 + 0.15 * ease_out(lt / 0.1))
            if gold and c[1] == 'GG': s *= 1 + 0.03 * math.sin(lt * 6)
            if abs(s - 1) > 0.005: ci = ci.resize((max(1, int(ci.width * s)), max(1, int(ci.height * s))), Image.BILINEAR)
            cy = CAP_Y if not gold else (CAP_Y - 60 if '|' in c[1] else CAP_Y)
            img.alpha_composite(ci, (W // 2 - ci.width // 2, int(cy - ci.height / 2)))
            break
    if t > TL['total'] - 0.6: img = Image.blend(img, Image.new('RGBA', (W, H), (0, 0, 0, 255)), clamp((t - (TL['total'] - 0.6)) / 0.6) * 0.85)
    return img.convert('RGB')

if ONLY:
    os.makedirs(OUT, exist_ok=True)
    for t in ONLY:
        f = min(NF - 1, int(round(t * FPS))); frame(f).save(os.path.join(OUT, f"c{f:05d}.png"))
    sys.exit(0)
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", AUDIO,
                       "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
                       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
for f in range(NF):
    ff.stdin.write(frame(f).tobytes())
    if f % 150 == 0: print("composed", f, flush=True)
ff.stdin.close(); ff.wait(); print("done", OUT)
