import numpy as np, os
from PIL import Image
from scipy import ndimage as ndi

SRC='../assets/scp-3143-original.jpg'
OUT=os.environ.get('OUTDIR','layers')
os.makedirs(OUT, exist_ok=True)
im=Image.open(SRC).convert('RGB'); a=np.asarray(im).astype(np.uint8); H,W,_=a.shape
lab=np.load('lab.npy')
S=ndi.generate_binary_structure(2,2)

def m_of(ids):
    m=np.zeros((H,W),bool)
    for i in ids: m|=(lab==i)
    return m
def grow(m,r=5):
    return ndi.binary_fill_holes(ndi.binary_dilation(m,S,iterations=r))

HEAD=[83,541,797,731]
HAND=[3024,2875,2878,2541,2251,2591,2713,2798,2547]
SLEEVE=[4308,4634]
COAT=[1668,4152,4192]

head=grow(m_of(HEAD)); hand=grow(m_of(HAND)); sleeve=grow(m_of(SLEEVE)); coat=grow(m_of(COAT))

dark = a.mean(axis=2) <= 60
def swallow_dark(m, r=16):
    """absorb ink/solid-black areas (hat band, outlines) that hug the region"""
    zone = ndi.binary_dilation(m,S,iterations=r)
    lb,n = ndi.label(dark & zone, S)
    keep = np.unique(lb[ndi.binary_dilation(m,S,iterations=1) & (lb>0)])
    return m | np.isin(lb, keep[keep>0])
head = ndi.binary_fill_holes(swallow_dark(head,16))
hand = ndi.binary_fill_holes(swallow_dark(hand,8))
sleeve = ndi.binary_fill_holes(swallow_dark(sleeve,8))
coat = ndi.binary_fill_holes(swallow_dark(coat,3))
# hand should not steal head pixels beyond the cigarette; keep as is (cig overlaps face)
# extensions that hide seams behind the static front layers
# keep the seam strictly inside the static layer that covers it, so a few px of
# rotation can never push it into the open
head_ext = head | (ndi.binary_dilation(head,S,iterations=26) & ndi.binary_erosion(coat,S,8))
hand_ext = hand | (ndi.binary_dilation(hand,S,iterations=20) & ndi.binary_erosion(sleeve,S,6))

def nn_fill(img, known, target):
    """fill `target` pixels with colour of nearest pixel in `known`"""
    src = known & ~target
    idx = ndi.distance_transform_edt(~src, return_distances=False, return_indices=True)
    out = img.copy()
    out[target] = img[idx[0][target], idx[1][target]]
    return out

# ---- smoke (thin grey curl on white, left of the face)
box=np.zeros((H,W),bool); box[170:415, 90:270]=True
lum=a.mean(axis=2)
smoke = box & (lum<246) & ~ndi.binary_dilation(head|hand|coat|sleeve,S,iterations=2)
smoke = ndi.binary_dilation(smoke,S,iterations=1)

# ---- base plate: head, hand and smoke erased, holes filled from the background.
# dilate before filling so the anti-aliased rim of the linework can't be used as a
# fill colour (that is what smears grey wedges across the sky)
# don't erase anything the static coat/sleeve layers redraw on top — leaving it
# intact means a moving layer can never uncover a hole where the coat should be
erase = ndi.binary_dilation(head_ext | hand_ext, S, iterations=3) | ndi.binary_dilation(smoke,S,iterations=2)
erase &= ~(coat | sleeve)
src = ~(erase | coat | sleeve)
# the flat grey band behind him has a hard horizontal edge at y=476; fill each side
# of it from its own side only, so the band never bleeds up into the white
BAND=476
rows=np.arange(H)[:,None]*np.ones((1,W),int)
plate=a.copy()
for lo,hi in ((0,BAND),(BAND,H)):
    side=(rows>=lo)&(rows<hi)
    t=erase&side
    if t.any(): plate=nn_fill(plate, src&side, t)
sm = np.stack([ndi.uniform_filter(plate[...,c].astype(np.float32),9) for c in range(3)],-1)
inner = ndi.binary_erosion(erase, S, iterations=2)
plate = np.where(inner[...,None], sm.astype(np.uint8), plate)
plate2 = plate

def save(name, mask, img=None, fill_from=None, ext_src=None):
    img = a if img is None else img
    if fill_from is not None:            # hidden seam extension: paint it the colour of
        ext = mask & ~fill_from          # the static layer that covers it, minus its linework
        img = nn_fill(img, ext_src if ext_src is not None else fill_from, ext)
    rgba=np.zeros((H,W,4),np.uint8)
    bleed=ndi.binary_dilation(mask,S,iterations=2)      # keep a 2px colour bleed for
    rgba[...,:3]=np.where(bleed[...,None], img, 0)      # filtering, zero the rest so PNG packs
    alpha=(mask*255).astype(np.uint8)
    alpha=ndi.uniform_filter(alpha.astype(np.float32),2).astype(np.uint8)  # 1px feather
    rgba[...,3]=np.where(mask,255,alpha)
    Image.fromarray(rgba).save(f'{OUT}/{name}.png')
    ys,xs=np.where(mask); print(f'{name:8s} px={mask.sum():7d} bbox=({xs.min()},{ys.min()})-({xs.max()},{ys.max()})')

Image.fromarray(plate2).save(f'{OUT}/plate.png')
# head: fill the cigarette hole with face colour, extension with nearest head colour
head_img = nn_fill(a, head & ~hand, hand & head)
flat = a.mean(axis=2) > 55
save('head', head_ext, head_img, fill_from=head, ext_src=coat & flat)
save('coat', coat)
save('hand', hand_ext, fill_from=hand, ext_src=sleeve & flat)
save('sleeve', sleeve)
save('smoke', smoke)

# skin colour for the eyelid + a couple of reference points
print('skin', a[360,270], 'ink', a[335,300])
