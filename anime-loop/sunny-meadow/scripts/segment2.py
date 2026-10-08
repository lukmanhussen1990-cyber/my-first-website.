import onnxruntime as ort, numpy as np, sys
from PIL import Image
model, src, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
x0, y0, x1, y1 = map(int, sys.argv[4:8])
sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"]); inp = sess.get_inputs()[0]
def run(img):
    im = img.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    a = np.array(im).astype(np.float64); a = a / np.max(a)
    mean = (0.485, 0.456, 0.406)
    x = np.stack([(a[..., c] - mean[c]) for c in range(3)], 0)[None].astype(np.float32)
    out = sess.run(None, {inp.name: x})[0][0, 0]; out = (out - out.min()) / (out.max() - out.min())
    return np.array(Image.fromarray((out * 255).astype(np.uint8), "L").resize(img.size, Image.Resampling.LANCZOS))
img = Image.open(src).convert("RGB"); W, H = img.size
m = np.zeros((H, W), np.uint8); m[y0:y1, x0:x1] = run(img.crop((x0, y0, x1, y1)))
Image.fromarray(m).save(outdir + "/mask_crop.png"); print("ok", m.mean())
