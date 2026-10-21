#!/usr/bin/env bash
# Re-makes the narrator with ElevenLabs and re-exports the reel with the new
# voice and updated subtitle timing. The 3D picture is NOT re-rendered: it reuses
# output/video_clean.mp4.
#
#   ELEVENLABS_API_KEY=sk_... ./rebuild_with_elevenlabs.sh            # voice from script/voiceover.json
#   ./rebuild_with_elevenlabs.sh --voice <voice_id>                     # pick another voice
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/tts_elevenlabs.py "$@"   # voice/lineNN.wav + exact word timestamps
python3 tools/align_words.py          # uses the ElevenLabs timestamps (no speech recognition needed)
python3 tools/build_audio.py          # places each line on its story beat, music + SFX, ducking, mix
python3 tools/make_subtitles.py       # word-by-word subtitles from the new timing
python3 tools/export_video.py         # burn subtitles + mux AAC -> output/gorilla_pool_reel.mp4
echo "Done: output/gorilla_pool_reel.mp4"
