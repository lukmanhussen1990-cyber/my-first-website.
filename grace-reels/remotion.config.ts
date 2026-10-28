import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

// Lossless frames into the encoder: smooth dark gradients + grain band badly through JPEG.
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
Config.setOverwriteOutput(true);
// No GPU in the cloud box: SwiftShader via ANGLE. Use --gl=angle on a GPU machine.
Config.setChromiumOpenGlRenderer('swangle');

// Reuse a locally installed Chrome Headless Shell if there is one (no download needed).
const localShell =
	'/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
if (fs.existsSync(localShell)) {
	Config.setBrowserExecutable(localShell);
}
