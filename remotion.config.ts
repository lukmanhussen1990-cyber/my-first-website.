import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

// Use the pre-installed headless Chromium when it exists (no browser download needed).
const localShell =
	'/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
if (fs.existsSync(localShell)) {
	Config.setBrowserExecutable(localShell);
}

// WebGL in headless mode.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setDelayRenderTimeoutInMilliseconds(120000);
