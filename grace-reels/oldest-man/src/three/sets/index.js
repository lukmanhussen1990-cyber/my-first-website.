// Set registry: name -> build(ctx). Names match SETS / SHOT_SET in src/lib/director.js.
import { build as hill } from './hill.js';
import { build as enoch } from './enoch.js';
import { build as family } from './family.js';
import { build as ark } from './ark.js';
import { build as city } from './city.js';
import { build as cta } from './cta.js';

export const BUILDERS = { hill, enoch, family, ark, city, cta };
