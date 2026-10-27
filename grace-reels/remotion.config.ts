import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

// No GPU in the cloud container: render WebGL on the CPU through ANGLE + SwiftShader.
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);

// Use the pre-installed headless shell when Remotion can't download its own.
const shell = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
if (fs.existsSync(shell)) {
	Config.setBrowserExecutable(shell);
}
