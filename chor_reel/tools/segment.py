"""Segment a character from a frame. Usage: segment.py model in.png out_alpha.png [x0 y0 x1 y1]"""
import sys, numpy as np, cv2, onnxruntime as ort

def run_isnet(sess, img):
    h, w = img.shape[:2]
    s = 1024
    r = s / max(h, w)
    nh, nw = int(h * r), int(w * r)
    pad = np.zeros((s, s, 3), np.float32)
    pad[(s - nh) // 2:(s - nh) // 2 + nh, (s - nw) // 2:(s - nw) // 2 + nw] = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    x = pad.transpose(2, 0, 1)[None]
    name = sess.get_inputs()[0].name
    out = sess.run(None, {name: x})[0][0, 0]
    out = out[(s - nh) // 2:(s - nh) // 2 + nh, (s - nw) // 2:(s - nw) // 2 + nw]
    return cv2.resize(out, (w, h), interpolation=cv2.INTER_LINEAR)

def run_birefnet(sess, img):
    h, w = img.shape[:2]
    x = cv2.resize(img, (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    name = sess.get_inputs()[0].name
    out = sess.run(None, {name: x})[-1][0, 0]
    out = 1 / (1 + np.exp(-out))
    return cv2.resize(out, (w, h), interpolation=cv2.INTER_LINEAR)

if __name__ == "__main__":
    model, inp, outp = sys.argv[1:4]
    bgr = cv2.imread(inp)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    if len(sys.argv) > 4:
        x0, y0, x1, y1 = map(int, sys.argv[4:8])
        rgb = rgb[y0:y1, x0:x1]
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    a = run_isnet(sess, rgb) if "isnet" in model else run_birefnet(sess, rgb)
    a = np.clip(a, 0, 1)
    cv2.imwrite(outp, (a * 255).astype(np.uint8))
    print("ok", a.shape, float(a.mean()))
