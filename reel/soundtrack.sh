#!/usr/bin/env bash
# Puts the "Luka Chuppi" song (Rang De Basanti) under the rendered reel.
#   ./soundtrack.sh <song.mp3> [video.mp4] [output.mp4]
# The song itself is not kept in this repo; pass your own copy.
#
# Edit (song time -> reel time), both parts start on a beat (103 BPM, beat 0.58 s):
#   A  27.24-64.98 s -> 0.00-37.74  intro, then Maa's mukhda:
#        33.6 Luka chuppi bahut hui | 38.0 saamne aa jaa naa | 42.8 kahaan kahaan dhoondha tujhe,
#        thak gayi hai ab teri maa | 51.6 aaja saanjh hui, mujhe teri fikar | 57.0 dhundhla gayi dekh meri nazar
#   B 188.76-207.2 s -> 36.94-55.38 (0.8 s crossfade): 189.3 chanda tu hai kahaan, mere chanda tu hai kahaan |
#        197.4 Luka chuppi bahut hui, saamne aa jaa naa
# Scene lengths in scenes.js (SCENES) follow these lyric lines.
set -euo pipefail
song="$1"
video="${2:-out/maa-ki-lori.mp4}"
out="${3:-out/maa-ki-lori-with-song.mp4}"
ffmpeg -v error -y -i "$video" -i "$song" -filter_complex "
  [1:a]atrim=27.24:64.98,asetpts=PTS-STARTPTS,afade=t=in:d=0.8[a];
  [1:a]atrim=188.76:207.2,asetpts=PTS-STARTPTS,volume=0.72[b];
  [a][b]acrossfade=d=0.8:c1=tri:c2=tri,afade=t=out:st=54.2:d=1.15,loudnorm=I=-14:TP=-1.5:LRA=11[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$out"
echo "wrote $out"
