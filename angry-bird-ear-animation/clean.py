from PIL import Image, ImageFilter
import numpy as np

CROP = (4, 6, 598, 409)

im = Image.open('assets/source.jpg').convert('RGB').crop(CROP)
a = np.asarray(im).astype(np.float32)
h, w, _ = a.shape

lum = a.mean(2)
bg = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))).astype(np.float32)

# region containing the painted notes / staff lines (outside the ear cup)
region = np.zeros((h, w), bool)
region[60:255, 0:198] = True

mask = ((lum - bg) > 10) & region          # bright strokes above local background
mask |= ((lum > 205) & region)

# grow the mask a little so soft edges go too
mask_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
mask = np.asarray(mask_img) > 127

Image.fromarray((mask * 255).astype(np.uint8)).save('mask.png')

# ---- inpaint by normalized-convolution pyramid fill ----
keep = (~mask).astype(np.float32)[..., None]
img = a * keep
filled = img.copy()
wsum = keep.copy()

acc = np.zeros_like(a)
accw = np.zeros((h, w, 1), np.float32)
for lvl in range(1, 9):
    f = 2 ** lvl
    sw, sh = max(1, w // f), max(1, h // f)
    ds_i = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((sw, sh), Image.BOX)
    ds_w = Image.fromarray((keep[..., 0] * 255).astype(np.uint8)).resize((sw, sh), Image.BOX)
    up_i = np.asarray(ds_i.resize((w, h), Image.BILINEAR)).astype(np.float32)
    up_w = np.asarray(ds_w.resize((w, h), Image.BILINEAR)).astype(np.float32)[..., None] / 255.0
    weight = 1.0 / f
    acc += up_i * weight
    accw += up_w * weight

fill = acc / np.maximum(accw, 1e-4)
fill = np.asarray(Image.fromarray(np.clip(fill, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)

# add a touch of grain so the patch matches the painterly texture
rng = np.random.default_rng(7)
fill += rng.normal(0, 3.2, fill.shape)

m3 = mask[..., None].astype(np.float32)
m3 = np.asarray(Image.fromarray((m3[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[..., None] / 255.0
out = a * (1 - m3) + fill * m3
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save('clean.png')
print('saved', out.shape)
