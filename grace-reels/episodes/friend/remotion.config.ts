import {Config} from '@remotion/cli/config';

// No GPU in this environment: SwiftShader WebGL. Use --gl=angle on a machine with a GPU.
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setEntryPoint('src/index.ts');
