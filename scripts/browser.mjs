// Which browser + WebGL backend Remotion renders with.
// - REMOTION_CHROME / REMOTION_GL override everything. (Not CHROME_PATH: cloud containers preset it to the full
//   Chromium, which crashes when Remotion launches it headless.)
// - Cloud Linux container (no GPU): the pre-installed Playwright headless shell with SwiftShader through ANGLE ("swangle").
// - Windows / macOS with a GPU: system Chrome with "angle" (what the original bridge short used).
// - Otherwise: let Remotion use its own downloaded headless shell.
import fs from "node:fs";

const candidates = [
  process.env.REMOTION_CHROME,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  ...(() => {
    try {
      return fs.readdirSync("/opt/pw-browsers").filter((d) => d.startsWith("chromium_headless_shell-"))
        .map((d) => `/opt/pw-browsers/${d}/chrome-headless-shell-linux64/chrome-headless-shell`);
    } catch { return []; }
  })(),
  process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : null,
  process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : null,
].filter(Boolean);

export const browserExecutable = candidates.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) ?? null;
const gpuLess = process.platform === "linux";
export const chromiumOptions = { gl: process.env.REMOTION_GL || (gpuLess ? "swangle" : "angle") };
