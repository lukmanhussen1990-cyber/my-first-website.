import { createSpaceWorld } from './common.js';
import { hookShots } from './hook.js';
import { spaceShots } from './space2.js';
import { cityShot } from './city.js';
import { tideGaugeShot } from './tideGauge.js';
import { wildlifeShot } from './wildlife.js';

// Shot list in timeline order; each shot covers [t0, t1) and renders any time inside it.
export async function buildShots(ctx) {
  const world = createSpaceWorld(ctx);
  const sp = spaceShots(ctx, world);
  const [hook, gone] = hookShots(ctx, world).map(sp.hide);
  return [
    hook,
    gone,
    cityShot(ctx, world.sky),
    sp.tidesSpace,
    tideGaugeShot(ctx),
    wildlifeShot(ctx, world.sky),
    sp.rotation,
    sp.orbit,
    sp.finale,
  ];
}
