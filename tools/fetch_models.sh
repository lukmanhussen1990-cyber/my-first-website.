#!/usr/bin/env bash
# Downloads the Kokoro-82M ONNX voice model (Apache-2.0) and exposes its phoneme
# durations as a graph output so tools/tts.py can time every word.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models
base=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
[ -f models/kokoro-v1.0.onnx ] || curl -fL -o models/kokoro-v1.0.onnx $base/kokoro-v1.0.onnx
[ -f models/voices-v1.0.bin ] || curl -fL -o models/voices-v1.0.bin $base/voices-v1.0.bin
.venv/bin/python - <<'PY'
import onnx
from onnx import helper, TensorProto
m = onnx.load('models/kokoro-v1.0.onnx')
m.graph.node.append(helper.make_node('Identity', ['/encoder/Cast_output_0'], ['duration'], name='expose_duration'))
m.graph.output.append(helper.make_tensor_value_info('duration', TensorProto.INT64, None))
onnx.save(m, 'models/kokoro-timed.onnx')
print('models/kokoro-timed.onnx ready')
PY
