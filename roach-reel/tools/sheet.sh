#!/bin/bash
# contact sheet of stills: tools/sheet.sh out.png in1.png in2.png ...
out=$1; shift
n=$#
ffmpeg -v error -y $(for f in "$@"; do echo -n "-i $f "; done) -filter_complex "$(for i in $(seq 0 $((n-1))); do echo -n "[$i]scale=360:640[s$i];"; done)$(for i in $(seq 0 $((n-1))); do echo -n "[s$i]"; done)hstack=inputs=$n" "$out"
