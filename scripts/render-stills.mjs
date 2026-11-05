// Render many stills with one browser. Usage: node scripts/render-stills.mjs <bundleDir> <jobs.json>
// jobs.json: [{comp, props, frame, out}]. Browser console lines containing FACE_UNDER_CAPTION are reported.
import fs from 'node:fs';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const [bundleDir, jobsFile] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const browserExecutable = fs.existsSync('/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell')
	? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'
	: null;
const chromiumOptions = {gl: 'swangle'};
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const onBrowserLog = (log) => {
	const text = log.text ?? JSON.stringify(log);
	if (/FACE_UNDER_CAPTION|CAPTION_CHECK|Error/.test(text)) console.log('  [browser]', text);
};
for (const job of jobs) {
	const t0 = Date.now();
	const composition = await selectComposition({serveUrl: bundleDir, id: job.comp, inputProps: job.props ?? {}, puppeteerInstance: browser, chromiumOptions, browserExecutable, logLevel: 'error'});
	await renderStill({composition, serveUrl: bundleDir, output: job.out, frame: job.frame ?? 0, inputProps: job.props ?? {}, puppeteerInstance: browser, chromiumOptions, browserExecutable, logLevel: 'error', timeoutInMilliseconds: 120000, onBrowserLog});
	console.log(`${job.out} ${(Date.now() - t0) / 1000}s`);
}
await browser.close({silent: true});
