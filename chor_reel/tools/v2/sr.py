"""APISR 2x anime super-resolution (ONNX). sr2x(bgr_uint8) -> bgr_uint8 (2x)."""
import numpy as np, cv2, onnxruntime as ort, os
_sess = None


def _get():
    global _sess
    if _sess is None:
        so = ort.SessionOptions(); so.enable_cpu_mem_arena = False
        _sess = ort.InferenceSession(os.path.join(os.path.dirname(__file__), '..', 'models', 'sr', 'apisr2x.onnx'), so, providers=['CPUExecutionProvider'])
    return _sess


def sr2x(bgr):
    h, w = bgr.shape[:2]
    ph, pw = (-h) % 4, (-w) % 4
    img = cv2.copyMakeBorder(bgr, 0, ph, 0, pw, cv2.BORDER_REFLECT)
    x = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32).transpose(2, 0, 1)[None] / 255.0
    y = _get().run(None, {'pixel_values': x})[0][0].transpose(1, 2, 0)
    y = cv2.cvtColor(np.clip(y * 255, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    return y[:h * 2, :w * 2]
