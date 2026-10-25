import { Config } from "@remotion/cli/config";

// Server without a GPU: SwiftShader through ANGLE. On a machine with a GPU use "angle".
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setAudioCodec("aac");
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);
