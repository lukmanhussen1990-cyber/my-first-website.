import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { LogoMark } from '@/components/brand/LogoMark';

test('dump LogoMark markup', () => {
  const full = renderToStaticMarkup(<LogoMark size={1024} />);
  const glyph = renderToStaticMarkup(<LogoMark size={1024} variant="glyph" />);
  writeFileSync('/tmp/claude-0/-home-user-my-first-website-/e453a8af-3d99-5d39-8cdc-1330e05cc981/scratchpad/webtest/full.html', full);
  writeFileSync('/tmp/claude-0/-home-user-my-first-website-/e453a8af-3d99-5d39-8cdc-1330e05cc981/scratchpad/webtest/glyph.html', glyph);
  expect(full).toContain('<svg');
});
