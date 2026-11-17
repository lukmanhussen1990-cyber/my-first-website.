#!/bin/bash
# usage: mix_audio.sh VO.mp3 AUDIO_DIR  -> AUDIO_DIR/mix.wav
VO=$1; A=$2
ffmpeg -v error -y -i "$VO" -i "$A/music.wav" -i "$A/sfx.wav" -filter_complex "\
[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,volume=2.252,apad=whole_dur=24.85,asplit=2[vo][vosc];\
[1:a]volume=0.32[mus];\
[mus][vosc]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=350:makeup=1[musd];\
[2:a]volume=0.62[sfx];\
[vo][musd][sfx]amix=inputs=3:normalize=0:duration=longest,atrim=0:24.85,\
loudnorm=I=-14:TP=-1.5:LRA=9[out]" -map "[out]" -ar 48000 "$A/mix.wav"
ffmpeg -hide_banner -nostats -i "$A/mix.wav" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
