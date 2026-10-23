#!/usr/bin/env bash
# Install the tools and download the offline Hindi voice used for the voiceover.
set -euo pipefail
cd "$(dirname "$0")"
pip install piper-tts onnx pillow numpy
mkdir -p models build
voice=vits-piper-hi_IN-pratham-medium
if [ ! -d "models/$voice" ]; then
  curl -sSfL "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$voice.tar.bz2" | tar xj -C models
fi
