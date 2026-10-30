from PIL import Image, ImageDraw, ImageFont, ImageFilter
import glob
FPS = 24000/1001
frames = [30,70,128, 335,410,490, 770,830,900, 1250,1320,1395, 1800,1850,1903, 1930,1990,2040]
rows = [
 ("A", "Name title", 26, 131),
 ("B", "Paper tree", 326, 496),
 ("C", "Chain + lens", 762, 908),
 ("D", "Papers + charts", 1227, 1401),
 ("E", "Lens montage", 1796, 1925),
 ("F", "End card / logo", 1926, 2045),
]
t = lambda n: (n+1)/FPS   # frame n is shown at (n+1)*1001/24000 s (stream starts at pts 1001)
def ts(sec): return f"{int(sec//60):02d}:{sec%60:05.2f}"
files = sorted(glob.glob("frames/sheet/s_*.png"))
TW, TH = 560, 315; LW = 260; PAD = 18; CAP = 40; HEAD = 110
W = LW + 3*(TW+PAD) + PAD; H = HEAD + len(rows)*(TH+CAP+PAD) + PAD
img = Image.new("RGB", (W, H), (20,19,18))
d = ImageDraw.Draw(img)
F = lambda s, b=True: ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-%s.otf" % ("Bold" if b else "Medium"), s)
d.text((PAD, 26), "Animations to replace (A–F)", font=F(44), fill=(233,220,196))
d.text((PAD+640, 42), "3 sample frames each · times = frame display time · frame ranges are exact cuts", font=F(22, False), fill=(160,150,135))
for r, (L, name, a, b) in enumerate(rows):
    y = HEAD + r*(TH+CAP+PAD)
    d.rounded_rectangle((PAD, y, LW-PAD, y+TH+CAP-6), 14, fill=(42,38,34))
    d.text((PAD+22, y+14), L, font=F(110), fill=(61,220,82))
    d.text((PAD+24, y+150), name, font=F(24), fill=(233,220,196))
    d.text((PAD+24, y+186), f"{ts(t(a))} – {ts(t(b+1))}", font=F(21, False), fill=(200,190,170))
    d.text((PAD+24, y+216), f"frames {a}–{b}", font=F(19, False), fill=(150,140,125))
    d.text((PAD+24, y+242), f"{b-a+1} frames", font=F(19, False), fill=(150,140,125))
    for c in range(3):
        n = frames[r*3+c]
        im = Image.open(files[r*3+c]).convert("RGB").resize((TW, TH), Image.LANCZOS)
        x = LW + c*(TW+PAD)
        img.paste(im, (x, y))
        d.rectangle((x, y, x+TW-1, y+TH-1), outline=(80,74,66))
        d.text((x+4, y+TH+8), f"{L}{c+1}   {ts(t(n))}   (frame {n})", font=F(20, False), fill=(220,210,190))
img.save("/home/user/my-first-website./animations_to_replace.jpg", quality=90)
print(img.size)
