/**
 * Natural Disasters - the list of every disaster in the pack.
 *
 * Adding a new disaster is a two step job: write a module that exports an object
 * with `key`, `name`, `color`, `description`, `warning` and `create()`, then add
 * it to the list below.
 */

import { tornado } from "./tornado.js";
import { earthquake } from "./earthquake.js";
import { meteor } from "./meteor.js";
import { tsunami } from "./tsunami.js";
import { wildfire } from "./wildfire.js";
import { lightningStorm } from "./lightning_storm.js";

export const DISASTERS = {
  [tornado.key]: tornado,
  [earthquake.key]: earthquake,
  [meteor.key]: meteor,
  [tsunami.key]: tsunami,
  [wildfire.key]: wildfire,
  [lightningStorm.key]: lightningStorm
};

/** Stable order used by the wand menu and by random picks. */
export const DISASTER_KEYS = [
  tornado.key,
  earthquake.key,
  meteor.key,
  tsunami.key,
  wildfire.key,
  lightningStorm.key
];
