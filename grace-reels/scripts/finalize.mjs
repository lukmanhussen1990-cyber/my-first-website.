// Re-muxes a Remotion render with the master WAV so the file is exactly 5.000 s
// (Remotion pads AAC to whole frames). Video is stream-copied: no quality loss.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

for (const file of process.argv.slice(2)) {
	const tmp = file.replace(/\.mp4$/, '.tmp.mp4');
	execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-i', 'public/audio/thank-you-1k.wav', '-map', '0:v:0', '-map', '1:a:0',
		'-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', '5.0', '-movflags', '+faststart', tmp]);
	fs.renameSync(tmp, file);
	console.log(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames,sample_rate,duration:format=duration', '-of', 'compact', file]).toString());
}
