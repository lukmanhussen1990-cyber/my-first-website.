import { Config } from '@remotion/cli/config';

// Each episode keeps its render assets in episodes/<slug>/public.
Config.setPublicDir(process.env.EPISODE_PUBLIC ?? './episodes/adam-silent/public');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setChromiumOpenGlRenderer('swangle');
Config.setBrowserExecutable('/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
