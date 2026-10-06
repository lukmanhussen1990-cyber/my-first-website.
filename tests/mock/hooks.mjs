// Node module resolve hook: maps the Bedrock script modules to the mocks.
// Registered by tests/mock/register.mjs (node --import ./tests/mock/register.mjs ...).

const MAP = {
  "@minecraft/server": new URL("./server.mjs", import.meta.url).href,
  "@minecraft/server-ui": new URL("./server-ui.mjs", import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(MAP, specifier)) {
    return { url: MAP[specifier], format: "module", shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
