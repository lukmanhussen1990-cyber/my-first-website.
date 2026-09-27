// Node module hooks: route the Minecraft script modules to the local mocks and
// load the add-on scripts (plain .js files) as ES modules.
const map = {
  "@minecraft/server": new URL("./mock/server.js", import.meta.url).href,
  "@minecraft/server-ui": new URL("./mock/server-ui.js", import.meta.url).href,
};
export async function resolve(specifier, context, next) {
  if (map[specifier]) return { url: map[specifier], shortCircuit: true };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.includes("/packs/AncientRuins_BP/scripts/") && url.endsWith(".js")) {
    return next(url, { ...context, format: "module" });
  }
  return next(url, context);
}
