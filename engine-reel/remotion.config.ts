/**
 * Remotion CLI config (applies to `remotion studio` and `remotion render`).
 * WebGL needs a GL backend in headless Chrome:
 *   - 'angle'   → uses your GPU (default here; fastest on a desktop)
 *   - 'swangle' → pure-CPU SwiftShader (servers / CI without a GPU)
 * Override per run with:  REMOTION_GL=swangle npm run render
 */
import { Config } from '@remotion/cli/config';

type GL = 'angle' | 'swangle' | 'egl' | 'swiftshader' | 'vulkan' | 'angle-egl';
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as GL) || 'angle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);
Config.setEntryPoint('src/index.ts');
