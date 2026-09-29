// Registry of every disaster module (id -> module).
import tornado from './tornado.js';
import tsunami from './tsunami.js';
import volcano from './volcano.js';
import earthquake from './earthquake.js';
import meteor from './meteor.js';
import supercell from './supercell.js';
import hurricane from './hurricane.js';
import wildfire from './wildfire.js';
import blizzard from './blizzard.js';
import sinkhole from './sinkhole.js';

/** @type {Record<string, any>} */
export const DISASTERS = { tornado, tsunami, volcano, earthquake, meteor, supercell, hurricane, wildfire, blizzard, sinkhole };
