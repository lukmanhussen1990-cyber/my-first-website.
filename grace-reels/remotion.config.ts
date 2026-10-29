import {Config} from '@remotion/cli/config';

// Remotion cannot download its own browser in this environment, so use the
// pre-installed headless shell.
Config.setBrowserExecutable(
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(4);
Config.setPublicDir('./public');
