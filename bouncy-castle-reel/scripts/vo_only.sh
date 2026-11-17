#!/bin/bash
# usage: vo_only.sh VO.mp3 OUT.wav   -> the creator's voiceover only (no music / SFX),
# padded with 0.5 s of silence and loudness-normalised (speed and pitch untouched)
ffmpeg -v error -y -i "$1" -af "aresample=48000,pan=stereo|c0=c0|c1=c0,apad=whole_dur=24.85,atrim=0:24.85,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 "$2"
