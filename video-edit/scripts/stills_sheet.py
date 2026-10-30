from PIL import Image, ImageDraw, ImageFont
FPS = 24000 / 1001
R = "renders/"
rows = [
 ("A", "Name title", 22, [(R + "A_stills/0020.png", 20, "name rises from behind the line"), (R + "A_stills/0059.png", 59, "title typed, green caret"), (R + "A_stills/0099.png", 99, "exit back into the line")]),
 ("B", "Paper tree", 326, [(R + "B_stills/0046.png", 46, "'financial model' -> bar chart"), (R + "B_stills/0117.png", 117, "'contract' -> page blooms"), (R + "B_stills/0151.png", 151, "'cross-references' wave")]),
 ("C", "Code lens", 762, [(R + "C_stills/0035.png", 35, "'code review' scan + green dots"), (R + "C_stills/0062.png", 62, "'performance' 412 -> 38 ms"), (R + "C_stills/0134.png", 134, "'entire code base' network")]),
 ("D", "Documents", 1227, [(R + "D_stills/0038.png", 38, "'spreadsheet' card flips in"), (R + "D_stills/0105.png", 105, "'numbers and sources'"), (R + "D_stills/0168.png", 168, "'check them' grid")]),
 ("E", "Infinite zoom", 1796, [(R + "E_stills/0014.png", 14, "contours -> circuit"), (R + "E_stills/0058.png", 58, "fern -> ice crystal"), (R + "E_stills/0103.png", 103, "moon; lens shrinks onto it")]),
 ("F", "Moon match-cut", 1926, [(R + "F_trans_full/0001.png", 1, "dissolve starts at the moon"), (R + "F_trans_full/0004.png", 4, "sky opens outwards"), (R + "F_trans_full/0007.png", 7, "untouched logo footage")]),
]
TW, TH, LW, PAD, CAP, HEAD = 800, 450, 250, 16, 44, 100
Wd = LW + 3 * (TW + PAD) + PAD; Hd = HEAD + len(rows) * (TH + CAP + PAD) + PAD
img = Image.new("RGB", (Wd, Hd), (20, 19, 18)); d = ImageDraw.Draw(img)
F = lambda s, b=True: ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-%s.otf" % ("Bold" if b else "Medium"), s)
def ts(x): return f"{int(x // 60):02d}:{x % 60:05.2f}"
d.text((PAD, 26), "New animations: 3 full-quality stills each", font=F(44), fill=(233, 220, 196))
for r, (L, name, f0, items) in enumerate(rows):
    y = HEAD + r * (TH + CAP + PAD)
    d.rounded_rectangle((PAD, y, LW - PAD, y + TH + CAP - 6), 14, fill=(42, 38, 34))
    d.text((PAD + 22, y + 14), L, font=F(110), fill=(61, 220, 82))
    d.text((PAD + 24, y + 150), name, font=F(26), fill=(233, 220, 196))
    for c, (path, i, cap) in enumerate(items):
        im = Image.open(path).convert("RGB").resize((TW, TH), Image.LANCZOS)
        x = LW + c * (TW + PAD); img.paste(im, (x, y))
        n = f0 + i
        d.text((x + 4, y + TH + 8), f"{L}{c + 1}  {ts((n + 1) / FPS)}  (frame {n})  {cap}", font=F(21, False), fill=(220, 210, 190))
img.save("previews/new_animations_stills.jpg", quality=88)
print(img.size)
