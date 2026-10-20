// Redirects `import ... from "@minecraft/server"` to the local mock so the
// behavior pack script can run under plain Node for smoke testing.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      const mock = ${JSON.stringify(new URL("./mock-server.mjs", import.meta.url).href)};
      export async function resolve(specifier, context, next) {
        if (specifier === "@minecraft/server") return { url: mock, shortCircuit: true };
        return next(specifier, context);
      }
    `)
);
