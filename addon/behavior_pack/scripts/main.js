// @ts-check
// Entry point of the behavior pack script module (manifest "entry": "scripts/main.js").
// Each subsystem init subscribes its own events and is idempotent; a failure in
// one subsystem must not stop the others, so every init is wrapped in safe().

import { safe } from "./lib/util.js";
import { initItems } from "./lib/items.js";
import { initKit } from "./lib/kit.js";
import { initTorchlight } from "./torchlight/index.js";
import { initHouse } from "./house/index.js";
import { initOutbreak } from "./outbreak/index.js";

safe(initItems, "init:items")();
safe(initKit, "init:kit")();
safe(initTorchlight, "init:torchlight")();
safe(initHouse, "init:house")();
safe(initOutbreak, "init:outbreak")();
