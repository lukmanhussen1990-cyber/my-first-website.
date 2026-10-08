import onnxruntime as ort, numpy as np, sys
from PIL import Image
model, src, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0]
print("input", inp.name, inp.shape)
def run(img):
    im = img.convert("RGB").resize((1024,1024), Image.Resampling.LANCZOS)
    a = np.array(im).astype(np.float64); a = a/np.max(a)
    mean=(0.485,0.456,0.406)
    x = np.stack([(a[...,c]-mean[c])/1.0 for c in range(3)],0)[None].astype(np.float32)
    out = sess.run(None, {inp.name: x})[0][0,0]
    out = (out-out.min())/(out.max()-out.min())
    m = Image.fromarray((out*255).astype(np.uint8),"L").resize(img.size, Image.Resampling.LANCZOS)
    return np.array(m)
img = Image.open(src).convert("RGB")
W,H = img.size
full = run(img)
Image.fromarray(full).save(outdir+"/mask_full.png")
# crop pass around characters for finer detail
x0,y0,x1,y1 = 265,400,1065,1200
crop = run(img.crop((x0,y0,x1,y1)))
m2 = np.zeros((H,W),np.uint8); m2[y0:y1,x0:x1]=crop
Image.fromarray(m2).save(outdir+"/mask_crop.png")
print("done", full.shape, full.mean(), m2.mean())
