"""Join the Birthday render parts into birthday/out/final.mp4.
  part 1  : frames 0-1439 (recovered from the stopped first render's stream: birthday/out/tmp/part1_partial_raw.bin)
  part 1b : frames 1440-1999 (birthday/out/tmp/part1b.mp4)
  part 2  : frames 2000-3294 (birthday/out/tmp/part2.mp4)
then add the soundtrack (voice untouched + code-made music/effects) from birthday/out/tmp/audio.wav.
"""
import os, struct, subprocess, sys

T = 'birthday/out/tmp'
run = lambda *a: subprocess.run(list(a), check=True)

# ---- rebuild a decodable H.264 stream from the stopped render (MP4 'mdat' with length-prefixed NAL units,
#      its header box was never written): add SPS/PPS from an encoder with identical settings
run('ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1080x1920:rate=30', '-frames:v', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
    '-bsf:v', 'h264_mp4toannexb', '-f', 'h264', f'{T}/hdr.h264')
hdr = open(f'{T}/hdr.h264', 'rb').read()
nals = [n.rstrip(b'\x00') for n in hdr.split(b'\x00\x00\x01')[1:]]
sps = next(n for n in nals if n[0] & 0x1f == 7)
pps = next(n for n in nals if n[0] & 0x1f == 8)
b = open(f'{T}/part1_partial_raw.bin', 'rb').read()
out = bytearray(b'\x00\x00\x00\x01' + sps + b'\x00\x00\x00\x01' + pps)
off, frames = 48, 0
while off + 4 <= len(b):
    ln = struct.unpack('>I', b[off:off + 4])[0]
    if ln == 0 or off + 4 + ln > len(b):
        break
    nal = b[off + 4:off + 4 + ln]
    frames += (nal[0] & 0x1f) in (1, 5)
    out += b'\x00\x00\x00\x01' + nal
    off += 4 + ln
open(f'{T}/part1_partial.h264', 'wb').write(out)
print(f'part 1 stream: {frames} coded frames recovered (need 1440)')
assert frames >= 1460

# ---- one clean encode of all 3295 frames
fc = ('[0:v]trim=end_frame=1440,setpts=PTS-STARTPTS[a];'
      '[1:v]setpts=PTS-STARTPTS[b];'
      '[2:v]setpts=PTS-STARTPTS[c];'
      '[a][b][c]concat=n=3:v=1:a=0,fps=30[v]')
run('ffmpeg', '-v', 'error', '-y', '-r', '30', '-i', f'{T}/part1_partial.h264', '-i', f'{T}/part1b.mp4', '-i', f'{T}/part2.mp4',
    '-filter_complex', fc, '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30', f'{T}/video.mp4')
run('ffmpeg', '-v', 'error', '-y', '-i', f'{T}/video.mp4', '-i', f'{T}/audio.wav', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-movflags', '+faststart', 'birthday/out/final.mp4')
run('ffprobe', '-v', 'error', '-count_frames', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_read_frames,duration,sample_rate,channels',
    '-of', 'default=nw=1', 'birthday/out/final.mp4')
print(os.path.getsize('birthday/out/final.mp4') / 1e6, 'MB')
