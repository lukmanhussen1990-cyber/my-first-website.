#!/usr/bin/env bash
# Build the whole reel:  script.txt + plan.json  ->  out/final.mp4 (+ out/cover.png)
#
#   ./build.sh            full build
#   ./build.sh 3 7        re-render only scenes 3 and 7, then re-assemble
#
# Needs: python3 (numpy, playwright), ffmpeg. ElevenLabs key in .env as ELEVENLABS_API_KEY
# (only used for narration clips that are missing or whose text changed).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/scenes

step() { printf '\n== %s\n' "$*"; }

step "1/6 narration (ElevenLabs)";   python3 tts.py
step "2/6 characters";               python3 characters.py
step "3/6 scenes";                   python3 make_scenes.py
step "4/6 music + sound effects";    python3 sound.py
step "5/6 record scenes";            python3 render.py "$@"

step "6/6 join + mix"
total=$(python3 -c "import json; print(json.load(open('scenes/timeline.json'))['total'])")
read -r music_db sfx_db lufs < <(python3 -c "import json; a=json.load(open('plan.json'))['audio']; print(a['music_db'], a['sfx_db'], a['loudness'])")

# join scene clips (all made with identical settings, so no re-encode is needed)
: > out/scenes/list.txt
for f in out/scenes/scene*.mp4; do echo "file '$(basename "$f")'" >> out/scenes/list.txt; done
ffmpeg -v error -y -f concat -safe 0 -i out/scenes/list.txt -c copy out/video.mp4

# voice (compressed like a typical voice-over) + music (-18 dB) + sfx, then a peak limiter
ffmpeg -v error -y -i audio/voice.wav -i audio/music.wav -i audio/sfx.wav -filter_complex "
  [0:a]aformat=channel_layouts=stereo,aresample=48000,acompressor=threshold=0.05:ratio=4:attack=2:release=100:makeup=4[v];
  [1:a]volume=${music_db}dB,aresample=48000[m];
  [2:a]volume=${sfx_db}dB,aresample=48000[s];
  [v][m][s]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.5:attack=2:release=60:level=0[a]" \
  -map "[a]" -c:a pcm_s16le out/mix.wav

# loudness-normalise for social media (two-pass loudnorm = exact target), then mux with the video
measured=$(ffmpeg -hide_banner -i out/mix.wav -af "loudnorm=I=${lufs}:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 |
  python3 -c "import sys, json, re; d = json.loads(re.findall(r'\{[^{}]*\}', sys.stdin.read())[-1]); print(
    f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
ffmpeg -v error -y -i out/video.mp4 -i out/mix.wav \
  -af "loudnorm=I=${lufs}:TP=-1.5:LRA=11:${measured}:linear=true,aresample=48000" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t "$total" -movflags +faststart out/final.mp4

# thumbnail: scene 1 at 3 seconds
ffmpeg -v error -y -ss 3 -i out/scenes/scene01.mp4 -frames:v 1 out/cover.png

printf '\nDone: %s (%ss)\n       %s\n' "$PWD/out/final.mp4" "$total" "$PWD/out/cover.png"
