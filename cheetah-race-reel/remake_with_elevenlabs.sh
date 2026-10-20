#!/usr/bin/env bash
# Re-make all voice lines with ElevenLabs and re-export the reel with the new
# voices and re-timed subtitles. The 3D animation is NOT re-rendered: the
# silent master (work/master/master.mp4) and the music/effects stems are reused.
#
#   ELEVENLABS_API_KEY=sk_... ./remake_with_elevenlabs.sh
#   ./remake_with_elevenlabs.sh --only 08_john        # just one line
#   ./remake_with_elevenlabs.sh --model eleven_v3     # different model
#
# Output: out/cheetah_race_reel_elevenlabs.mp4
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/remake_voices_elevenlabs.py "$@"
