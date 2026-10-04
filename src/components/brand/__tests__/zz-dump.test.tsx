import { writeFileSync } from 'node:fs';

Object.defineProperty(window, 'matchMedia', {
  value: (query: string) => ({ matches: process.env.RM === '1' && query.includes('reduce'), media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
});
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// eslint-disable-next-line import/first
const { BrandSplashOverlay } = require('@/components/brand/BrandSplashOverlay');

const OUT = '/tmp/claude-0/-home-user-my-first-website-/e453a8af-3d99-5d39-8cdc-1330e05cc981/scratchpad/webtest/';

test('overlay lifecycle on web', async () => {
  jest.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const onDone = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<BrandSplashOverlay onDone={onDone} />));
  await act(async () => { jest.advanceTimersByTime(600); });
  const css = Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules).map((r) => r.cssText)).join('\n');
  writeFileSync(`${OUT}overlay-600.html`, `<style>${css}</style>` + el.innerHTML);
  expect(onDone).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1200); });
  writeFileSync(`${OUT}overlay-1800.html`, el.innerHTML);
  for (let i = 0; i < 20 && !onDone.mock.calls.length; i++) {
    await act(async () => { jest.advanceTimersByTime(100); });
  }
  expect(onDone).toHaveBeenCalledTimes(1);
});
