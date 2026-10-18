"""Batch BiRefNet matting. Usage: batch_segment.py model listfile
listfile lines: in_png out_png x0 y0 x1 y1  (crop box; output alpha is crop-sized)"""
import sys, os, numpy as np, cv2, onnxruntime as ort
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from segment import run_birefnet
so = ort.SessionOptions()
so.enable_cpu_mem_arena = False
so.intra_op_num_threads = 4
sess = ort.InferenceSession(sys.argv[1], sess_options=so, providers=['CPUExecutionProvider'])
for ln in open(sys.argv[2]):
    p = ln.split()
    if not p: continue
    inp, outp = p[0], p[1]
    if os.path.exists(outp): continue
    x0, y0, x1, y1 = map(int, p[2:6])
    img = cv2.imread(inp)[y0:y1, x0:x1]
    a = run_birefnet(sess, cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    cv2.imwrite(outp, (np.clip(a, 0, 1) * 255).astype(np.uint8))
    print('seg', outp, flush=True)
