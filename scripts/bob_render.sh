#!/usr/bin/env bash
# Render the Bob video (muted, captions on) in three parts in parallel, join them, mix the code-made
# soundtrack under the untouched voiceover and write bob/out/final.mp4.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p bob/out/tmp
render() { # from to out
	RENDER_VIA_PROXY=1 npx remotion render src/index.ts Bob "$3" --frames="$1-$2" --muted --concurrency=1 --gl=swangle \
		--props='{"captions":true,"voice":false}' --log=error > "$3.log" 2>&1
}
if [ "${SKIP_RENDER:-0}" != "1" ]; then
	render 0 1015 bob/out/tmp/part1.mp4 &
	sleep 90
	render 1016 2031 bob/out/tmp/part2.mp4 &
	sleep 90
	render 2032 3047 bob/out/tmp/part3.mp4 &
	wait
fi
printf "file '%s'\nfile '%s'\nfile '%s'\n" "$PWD/bob/out/tmp/part1.mp4" "$PWD/bob/out/tmp/part2.mp4" "$PWD/bob/out/tmp/part3.mp4" > bob/out/tmp/parts.txt
ffmpeg -v error -y -f concat -safe 0 -i bob/out/tmp/parts.txt -c copy bob/out/tmp/video.mp4
python3 scripts/bob_audio.py public/bob/sfx 101.6 > /dev/null
python3 scripts/bob_mix.py bob/out/tmp/audio.wav
ffmpeg -v error -y -i bob/out/tmp/video.mp4 -i bob/out/tmp/audio.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -ar 44100 -movflags +faststart bob/out/final.mp4
ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,r_frame_rate,nb_read_frames,duration -of default=nw=1 bob/out/final.mp4
ls -la bob/out/final.mp4
