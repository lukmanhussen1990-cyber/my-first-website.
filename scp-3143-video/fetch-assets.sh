#!/usr/bin/env bash
# Download the fonts (SIL OFL / Apache 2.0) and the Kokoro TTS model used to build the video.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets/fonts assets/models
GF=https://raw.githubusercontent.com/google/fonts/main
get() { [ -f "$2" ] || curl -sSfL -o "$2" "$1"; }
get "$GF/ofl/courierprime/CourierPrime-Regular.ttf" assets/fonts/CourierPrime-Regular.ttf
get "$GF/ofl/courierprime/CourierPrime-Bold.ttf" assets/fonts/CourierPrime-Bold.ttf
get "$GF/ofl/courierprime/CourierPrime-Italic.ttf" assets/fonts/CourierPrime-Italic.ttf
get "$GF/ofl/bebasneue/BebasNeue-Regular.ttf" assets/fonts/BebasNeue-Regular.ttf
get "$GF/ofl/abrilfatface/AbrilFatface-Regular.ttf" assets/fonts/AbrilFatface-Regular.ttf
get "$GF/apache/specialelite/SpecialElite-Regular.ttf" assets/fonts/SpecialElite-Regular.ttf
get "$GF/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf" assets/fonts/PlayfairDisplay-VF.ttf
get "$GF/ofl/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf" assets/fonts/PlayfairDisplay-Italic-VF.ttf
get "$GF/ofl/oswald/Oswald%5Bwght%5D.ttf" assets/fonts/Oswald-VF.ttf
KR=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
get "$KR/kokoro-v1.0.onnx" assets/models/kokoro-v1.0.onnx
get "$KR/voices-v1.0.bin" assets/models/voices-v1.0.bin
echo "assets ready"
