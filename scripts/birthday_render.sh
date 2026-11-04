#!/usr/bin/env bash
# Render the Birthday video (muted, captions on) in two halves in parallel, join them,
# mix the code-made soundtrack under the untouched voiceover and write birthday/out/final.mp4.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p birthday/out/tmp
SPLIT=${SPLIT:-1999}
LAST=3294
render() { # from to out
	RENDER_VIA_PROXY=1 npx remotion render src/index.ts Birthday "$3" --frames="$1-$2" --muted --concurrency=1 --gl=swangle \
		--props='{"captions":true,"voice":false}' --log=error > "$3.log" 2>&1
}
if [ "${SKIP_RENDER:-0}" != "1" ]; then
	render 0 "$SPLIT" birthday/out/tmp/part1.mp4 &
	P1=$!
	render $((SPLIT + 1)) "$LAST" birthday/out/tmp/part2.mp4 &
	P2=$!
	wait $P1
	wait $P2
fi
printf "file '%s'\nfile '%s'\n" "$PWD/birthday/out/tmp/part1.mp4" "$PWD/birthday/out/tmp/part2.mp4" > birthday/out/tmp/parts.txt
ffmpeg -v error -y -f concat -safe 0 -i birthday/out/tmp/parts.txt -c copy birthday/out/tmp/video.mp4
python3 scripts/birthday_audio.py public/birthday/sfx 109.833 > /dev/null
python3 scripts/birthday_mix.py birthday/out/tmp/audio.wav
ffmpeg -v error -y -i birthday/out/tmp/video.mp4 -i birthday/out/tmp/audio.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -ar 44100 -movflags +faststart birthday/out/final.mp4
ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,r_frame_rate,nb_read_frames,duration,sample_rate,channels -of default=nw=1 birthday/out/final.mp4
ls -la birthday/out/final.mp4
