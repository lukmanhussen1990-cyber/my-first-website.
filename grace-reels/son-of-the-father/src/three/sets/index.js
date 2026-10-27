// Set registry: name -> build(ctx). Names match SETS / SHOT_SET in src/lib/director.js.
import { build as court } from './court.js';
import { build as memory } from './memory.js';
import { build as riot } from './riot.js';
import { build as modern } from './modern.js';
import { build as cta } from './cta.js';

export const BUILDERS = { court, memory, riot, modern, cta };
