// Node ESM loader hooks: map the Minecraft modules to mocks and keep a per-"generation" module graph so a world reload can be simulated.
const MOCKS = {
  '@minecraft/server': new URL('./mock_server.js', import.meta.url).href,
  '@minecraft/server-ui': new URL('./mock_ui.js', import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
  if (MOCKS[specifier]) return { url: MOCKS[specifier], shortCircuit: true };
  const r = await nextResolve(specifier, context);
  const m = context.parentURL && /[?&]gen=(\d+)/.exec(context.parentURL);
  if (m && r.url.startsWith('file:') && !r.url.includes('/tools/sim/')) {
    return { ...r, url: r.url.split('?')[0] + '?gen=' + m[1], shortCircuit: true };
  }
  return r;
}
