// Usage: node --import ./tests/mock/register.mjs --test tests/
// Makes `import ... from "@minecraft/server"` / "@minecraft/server-ui" load the mocks
// in tests/mock/ (the real modules only exist inside Minecraft).
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
