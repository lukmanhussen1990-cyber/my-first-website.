"""Hooded character: 30 s seamless loop. Every motion has integer cycles per 30 s."""
import numpy as np, cv2, sys, os, subprocess, time
from PIL import Image
from multiprocessing import Pool
P = sys.argv[1]; MODE = sys.argv[2]
T, FPS = 30.0, 30
N = int(round(T * FPS)); D2R = np.pi / 180
def W(k): return 2 * np.pi * k / T
def sm(z): z = np.clip(z, 0, 1); return z * z * (3 - 2 * z)
L = np.load(P + "/work/layers.npz"); M = np.load(P + "/work/masks.npz")
CLEAN = L["clean"].astype(np.float32)
H, Wd = CLEAN.shape[:2]
Y, X = np.mgrid[0:H, 0:Wd].astype(np.float32)
A = L["alpha"].astype(np.float32)
CHAR4 = np.dstack([L["rgb"] * A[..., None], A * 255.0]).astype(np.float32)
w_head, w_str, w_rim, w_cord = [M[k].astype(np.float32) for k in ("w_head", "w_strands", "w_rim", "w_cord")]
TAPER = (sm(X / 60) * sm((Wd - 1 - X) / 40) * sm(Y / 50) * sm((H - 1 - Y) / 60)).astype(np.float32)
UP = sm((H - Y) / 320).astype(np.float32)
ROCK = sm((H - Y) / 700).astype(np.float32)
def osc_parts(phi): return np.cos(phi).astype(np.float32), np.sin(phi).astype(np.float32)
def osc(wt, C, Sn): return np.float32(np.sin(wt)) * C + np.float32(1 - np.cos(wt)) * Sn
def rot_back(theta, px, py):
    c, s_ = np.cos(theta), np.sin(theta); dx, dy = X - px, Y - py
    return np.float32(c - 1) * dx + np.float32(s_) * dy, -np.float32(s_) * dx + np.float32(c - 1) * dy
s1 = osc_parts(2 * np.pi * (X / 180 + Y / 260)); s2 = osc_parts(2 * np.pi * (X / 140 - Y / 300) + 1.3)
s3 = osc_parts(2 * np.pi * (X / 220 + Y / 160) + 2.1)
r1 = osc_parts(2 * np.pi * (Y / 240) + 0.4); r2 = osc_parts(2 * np.pi * (X / 260 + Y / 200) + 2.5)
def gust(t):  # smooth wind pulses, 4 per loop
    g = (1 - np.cos(W(4) * t - 0.8)) / 2
    return g * g
def char_map(t):
    G = gust(t)
    br = (1 - np.cos(W(6) * t)) / 2                                         # breathing, 5 s
    bx = -6.0 * np.float32(np.sin(W(3) * t)) * ROCK                          # gentle rock, 10 s
    by = 5.0 * np.float32(br) * UP                                           # chest/shoulders rise
    hx, hy = rot_back(D2R * (1.3 * np.sin(W(2) * t) + 0.5 * np.sin(W(5) * t + 0.7)), 650, 960)   # head tilt
    bx += w_head * hx; by += w_head * hy
    by -= w_head * np.float32(2.5 * (1 - np.cos(W(4) * t)) / 2)               # slight nod
    a6, a7, a10, a11 = W(6) * t, W(7) * t, W(10) * t, W(11) * t
    fx = 0.5 * osc(a6, *s1) + 0.3 * osc(a10, *s2) - np.float32(0.9 * G)       # hair strands in the wind
    fy = 0.9 * osc(a7, *s3) + 0.3 * osc(a11, *s1)
    bx -= 7.0 * w_str * fx; by -= 7.0 * w_str * fy
    bx -= 2.5 * w_rim * (osc(W(8) * t, *r1) - np.float32(0.6 * G)); by -= 1.5 * w_rim * osc(a6, *r2)   # hood edge
    cx_, cy_ = rot_back(D2R * 3.0 * np.sin(W(6) * t + 0.5), 622, 968)        # drawstring swings
    bx += w_cord * cx_; by += w_cord * cy_
    return X + bx * TAPER, Y + by * TAPER
# ---- background: slow parallax drift, light sweep, floating motes ----
prng = np.random.default_rng(4)
MOTES = []
for zone, n in (((-40, 470, 0, 520), 9), ((1120, 1270, 0, 1150), 6)):
    x0, x1, y0, y1 = zone
    for _ in range(n):
        MOTES.append(dict(x=prng.uniform(x0, x1), y0=prng.uniform(y0, y1), ylo=y0 - 30, yh=(y1 - y0) + 60,
                          wraps=int(prng.integers(1, 3)), r=prng.uniform(1.6, 4.5), a=prng.uniform(0.25, 0.6),
                          ax=prng.uniform(6, 22), kx=int(prng.integers(2, 5)), px=prng.uniform(0, 2 * np.pi)))
FRONT = [dict(x=prng.uniform(20, 330), y0=prng.uniform(1000, 1250), r=prng.uniform(16, 30), a=prng.uniform(0.07, 0.12),
              ax=prng.uniform(20, 40), kx=int(prng.integers(1, 3)), px=prng.uniform(0, 2 * np.pi), ky=int(prng.integers(1, 3))) for _ in range(3)]
MOTE_COL = np.array([175, 195, 255], np.float32)
def blob(img, x, y, r, a, col, soft=1.0):
    R = int(np.ceil(r * 3 + 2)); xi, yi = int(x), int(y)
    x0_, x1_ = max(0, xi - R), min(Wd, xi + R + 1); y0_, y1_ = max(0, yi - R), min(H, yi + R + 1)
    if x0_ >= x1_ or y0_ >= y1_: return
    yy, xx = np.mgrid[y0_:y1_, x0_:x1_].astype(np.float32)
    d2 = ((xx - x) ** 2 + (yy - y) ** 2) / (r * r)
    al = (a * np.exp(-0.5 * d2 / soft))[..., None]
    reg = img[y0_:y1_, x0_:x1_]; reg[:] = reg * (1 - al) + col * al
def background(t):
    dx, dy = 10.0 * np.sin(W(1) * t), 4.0 * np.sin(W(2) * t + 1.0)
    bg = cv2.remap(CLEAN, X - np.float32(dx), Y - np.float32(dy), cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101)
    xc = -250 + 1750 * ((t / 15.0) % 1.0)                                      # soft light passing, every 15 s
    bg *= (1 + 0.16 * np.exp(-((X - xc) / 90) ** 2))[..., None]
    for m in MOTES:                                                             # dust motes rising slowly
        fr = ((m["y0"] - m["ylo"] - m["wraps"] * m["yh"] * t / T) % m["yh"]) / m["yh"]
        y = m["ylo"] + fr * m["yh"]
        x = m["x"] + m["ax"] * np.sin(2 * np.pi * m["kx"] * t / T + m["px"])
        fade = sm(fr / 0.15) * sm((1 - fr) / 0.15)                              # fade in/out at the wrap, no popping
        if fade > 0.001: blob(bg, x, y, m["r"], m["a"] * fade, MOTE_COL)
    return bg
def render(t):
    out = background(t)
    mx, my = char_map(t)
    ch = cv2.remap(CHAR4, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    a_ = np.clip(ch[..., 3:] / 255.0, 0, 1)
    out = out * (1 - a_) + np.clip(ch[..., :3], 0, None)
    for f in FRONT:                                                             # soft out-of-focus specks in front, bottom-left
        blob(out, f["x"] + f["ax"] * np.sin(2 * np.pi * f["kx"] * t / T + f["px"]),
             f["y0"] + 25 * np.sin(2 * np.pi * f["ky"] * t / T + f["px"] * 1.7), f["r"], f["a"], MOTE_COL, soft=1.6)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)
def work(i): return render(i / FPS).tobytes()
if __name__ == "__main__":
    if MODE == "test":
        os.makedirs(P + "/test", exist_ok=True)
        for t in [float(x) for x in sys.argv[3].split(",")]:
            t0 = time.time(); Image.fromarray(render(t)).save(P + f"/test/f_{t:06.2f}.png"); print(f"t={t:6.2f} {time.time()-t0:.2f}s")
    elif MODE == "full":
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
               "-s", f"{Wd}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "ffv1", "-level", "3", "-pix_fmt", "gbrp", sys.argv[3]]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE); t0 = time.time()
        with Pool(4) as pool:
            for i, buf in enumerate(pool.imap(work, range(N), chunksize=4)):
                p.stdin.write(buf)
                if i % 150 == 0: print(f"frame {i}/{N} {time.time()-t0:.0f}s", flush=True)
        p.stdin.close(); p.wait(); print("done", time.time() - t0)
