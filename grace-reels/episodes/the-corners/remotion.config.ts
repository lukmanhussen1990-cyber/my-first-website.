import {Config} from '@remotion/cli/config';

// No GPU in the cloud container: software WebGL. Use --gl=angle on a GPU machine.
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER ??
    `${process.cwd()}/tools/chrome-swiftshader.sh`,
);
