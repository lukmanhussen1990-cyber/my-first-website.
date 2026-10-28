# Two-pass EBU R128 loudness normalisation with ffmpeg (linear, no pumping).
#   python3 audio/loudnorm.py in.wav out.wav [-14]
import json, subprocess, sys

src, dst = sys.argv[1], sys.argv[2]
target = sys.argv[3] if len(sys.argv) > 3 else "-14"
spec = f"loudnorm=I={target}:TP=-1.5:LRA=11"
p = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", spec + ":print_format=json", "-f", "null", "-"],
                   capture_output=True, text=True, check=True)
m = json.loads(p.stderr[p.stderr.rindex("{"):p.stderr.rindex("}") + 1])
second = (f"{spec}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", second, "-ar", "48000", "-c:a", "pcm_s16le", dst], check=True)
print(f"loudness {m['input_i']} LUFS -> {target} LUFS, wrote {dst}")
