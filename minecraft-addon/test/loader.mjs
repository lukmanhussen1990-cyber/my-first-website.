// Node ESM loader hook: route "@minecraft/server" to the local fake.
export async function resolve(specifier, context, next) {
  if (specifier === "@minecraft/server") {
    return { url: new URL("./mock-server.js", import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
