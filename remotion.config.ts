import path from 'node:path';
import {Config} from '@remotion/cli/config';

// Software WebGL so headless rendering works on machines without a GPU.
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(18);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments where the internet is only reachable through $HTTPS_PROXY:
// route the headless browser through it so Google Fonts can load.
if (process.env.RENDER_VIA_PROXY) {
	Config.setBrowserExecutable(path.resolve('scripts/chrome-proxy-wrapper.sh'));
}
