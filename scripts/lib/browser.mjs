// Headless Chromium launcher with WebGL. Tries ANGLE (GPU) first, then falls
// back to SwiftShader (CPU) so rendering works on machines without a GPU.
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const CANDIDATE_BROWSERS = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);

const GL_MODES = {
  angle: ['--use-gl=angle', '--use-angle=default', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  swiftshader: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};

function executablePath() {
  for (const p of CANDIDATE_BROWSERS) if (fs.existsSync(p)) return p;
  return undefined; // let puppeteer use its own download if present
}

async function probe(browser) {
  const page = await browser.newPage();
  const info = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      floatRT: !!gl.getExtension('EXT_color_buffer_float'),
    };
  });
  await page.close();
  return info;
}

// Launch Chromium and return { browser, mode, gl } with a working WebGL2 context.
export async function launchWebGLBrowser({ width = 1080, height = 1920, prefer = process.env.GL_MODE } = {}) {
  const order = prefer ? [prefer, ...Object.keys(GL_MODES).filter((m) => m !== prefer)] : ['angle', 'swiftshader'];
  let lastErr;
  for (const mode of order) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath(),
        protocolTimeout: 0,
        args: [
          ...GL_MODES[mode],
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--hide-scrollbars',
          '--mute-audio',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          `--window-size=${width},${height}`,
        ],
        defaultViewport: { width, height, deviceScaleFactor: 1 },
      });
      const gl = await probe(browser);
      // ANGLE without a GPU silently lands on SwiftShader; accept it but report it.
      if (gl) return { browser, mode, gl };
      lastErr = new Error(`WebGL2 unavailable in mode ${mode}`);
      await browser.close();
    } catch (err) {
      lastErr = err;
      if (browser) await browser.close().catch(() => {});
    }
  }
  throw lastErr;
}
