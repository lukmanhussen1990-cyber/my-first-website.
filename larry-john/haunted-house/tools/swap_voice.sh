#!/usr/bin/env bash
# Swap in your own voiceover and rebuild the whole reel (the 3D scenes are not touched: every shot,
# cut, label, subtitle, sound effect and the music re-time themselves to the new word timings).
#
#   haunted-house/tools/swap_voice.sh VOICE_FILE [JOHN_6_FILE JOHN_13_FILE] [--preview]
#
#   VOICE_FILE     your ElevenLabs narration (mp3/wav/m4a...). It is used as-is: not cut, not sped up.
#   JOHN_6_FILE    optional separate "JOHN!" shout for beat 6
#   JOHN_13_FILE   optional separate "JOHN!" shout for beat 13 (gets a long echo down the pit)
#   --preview      build the quick 540x960 copy instead of the final 1080x1920 reel
#
# Example:
#   haunted-house/tools/swap_voice.sh ~/Downloads/haunted_voice.mp3 ~/Downloads/john1.wav ~/Downloads/john2.wav
set -euo pipefail

REEL="$(cd "$(dirname "$0")/.." && pwd)"
SIZE=final
ARGS=()
for a in "$@"; do
  if [ "$a" = "--preview" ]; then SIZE=preview; else ARGS+=("$a"); fi
done
if [ ${#ARGS[@]} -lt 1 ]; then
  sed -n '2,15p' "$0"; exit 1
fi
VOICE="${ARGS[0]}"
[ -f "$VOICE" ] || { echo "voice file not found: $VOICE"; exit 1; }

mkdir -p "$REEL/audio/shouts" "$REEL/out"
EXT="${VOICE##*.}"
cp "$VOICE" "$REEL/audio/voice_user.$EXT"
echo "voice -> audio/voice_user.$EXT"

# separate "JOHN!" shouts (optional): stored as audio/shouts/john_6.wav and john_13.wav
rm -f "$REEL/audio/shouts/john_6.wav" "$REEL/audio/shouts/john_13.wav"
if [ ${#ARGS[@]} -ge 2 ]; then ffmpeg -v error -y -i "${ARGS[1]}" -ac 1 -ar 48000 "$REEL/audio/shouts/john_6.wav"; echo "shout beat 6 -> audio/shouts/john_6.wav"; fi
if [ ${#ARGS[@]} -ge 3 ]; then ffmpeg -v error -y -i "${ARGS[2]}" -ac 1 -ar 48000 "$REEL/audio/shouts/john_13.wav"; echo "shout beat 13 -> audio/shouts/john_13.wav"; fi

cd "$REEL"
# 1) word timings from YOUR audio (speech recognition + forced alignment against script.json)
python3 tools/align_voice.py "audio/voice_user.$EXT" --shouts audio/shouts
# 2) everything else: cues, sound effects, music, mix, 3D frames, subtitles and labels, final MP4
python3 tools/build_reel.py --size "$SIZE"
# 3) deliverables next to the reel
cp "audio/voice_user.$EXT" "out/voice_haunted-house.$EXT"
cp script/script.json out/script_haunted-house.json
cp build/audio/music_only.wav out/music_haunted-house.wav
echo "done. Reel: $REEL/$([ "$SIZE" = final ] && echo out/reel_haunted-house.mp4 || echo build/preview/reel_preview.mp4)"
