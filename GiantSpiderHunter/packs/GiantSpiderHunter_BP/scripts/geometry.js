// Pure gameplay geometry (no engine imports): leg foot points, strike reach, escape rules,
// view cones and candidate generation. Unit tested in Node.
import { DEG, angleBetween, angleFromForward, clamp, forwardOf, lerp, sub, wrapDeg } from './util.js';

// ------------------------------------------------------------------ leg layout (DESIGN §4)
const LEG_K = [1.08, 1.0, 0.96, 1.04];
const LEG_A = [52, 20, -16, -48];
const HIP_Z = [-26, -12, 2, 14];
const HIP_X = 22;

/**
 * Neutral foot points in model pixels at giant scale 1, foot_i order:
 * 0 l1, 1 l2, 2 l3, 3 l4, 4 r1, 5 r2, 6 r3, 7 r4.
 */
export const NEUTRAL_FEET_PX = (() => {
  const out = [];
  for (const side of [1, -1]) {
    for (let n = 0; n < 4; n++) {
      const r = 170 * LEG_K[n];
      const a = LEG_A[n] * DEG;
      out.push({ x: side * (HIP_X + r * Math.cos(a)), z: HIP_Z[n] - r * Math.sin(a) });
    }
  }
  return out;
})();

/** World offset (blocks) of a model point (gx, gz in px) for scale s and body yaw (degrees). */
export function modelToWorld(gx, gz, s, yawDeg) {
  const t = yawDeg * DEG;
  const c = Math.cos(t);
  const n = Math.sin(t);
  return { x: ((gx * c + gz * n) * s) / 16, z: ((gx * n - gz * c) * s) / 16 };
}

/** World offsets of the eight neutral foot points. */
export function footOffsets(s, yawDeg) {
  return NEUTRAL_FEET_PX.map((p) => modelToWorld(p.x, p.z, s, yawDeg));
}

// ------------------------------------------------------------------ strikes (DESIGN §10)
export const KIND_GROUND = 0;
export const KIND_HIGH = 1;
export const KIND_BITE = 2;

/**
 * Strike kind for a target, or -1 when out of reach.
 * @param {{x,y,z}} spider  spider feet location
 * @param {number} yawDeg   spider body yaw
 * @param {number} s        giant scale
 * @param {{x,y,z}} target  target feet location
 * @param {boolean} elevated target is airborne / more than elevatedHeight above the ground
 * @param {object} cfg      CONFIG
 * @param {number} tol      reach multiplier (1 normally, reachTolerance at impact)
 */
export function strikeKind(spider, yawDeg, s, target, elevated, cfg, tol = 1) {
  const dx = target.x - spider.x;
  const dy = target.y - spider.y;
  const dz = target.z - spider.z;
  const h = Math.sqrt(dx * dx + dz * dz);
  const d3 = Math.sqrt(h * h + dy * dy);
  if (d3 <= cfg.biteRange * tol) return KIND_BITE;
  if (elevated) {
    const cy = spider.y + cfg.bodyCenterHeight * s;
    const ty = target.y + 0.9;
    const dc = Math.sqrt(h * h + (ty - cy) * (ty - cy));
    return dc <= cfg.airReachRadius * s * tol ? KIND_HIGH : -1;
  }
  if (Math.abs(dy) > cfg.verticalReach * s * tol) return -1;
  if (h <= cfg.groundReachRadius * s * tol) return KIND_GROUND;
  if (h <= cfg.frontReachRadius * s * tol && angleFromForward(yawDeg, dx, dz) <= cfg.frontArcDegrees / 2) {
    return KIND_GROUND;
  }
  return -1;
}

/** Elevated test: above the spider's feet level, or high above the ground under the target. */
export function isElevated(spiderY, targetY, heightAboveGround, cfg) {
  return targetY - spiderY > cfg.elevatedHeight || heightAboveGround > cfg.elevatedHeight;
}

/** Horizontal radius within which a target could possibly be struck (for cheap prefiltering). */
export function maxStrikeRadius(s, cfg) {
  return Math.max(cfg.frontReachRadius * s, cfg.airReachRadius * s, cfg.biteRange) * cfg.reachTolerance + 1;
}

/** Knockback parameters for a strike: {h, v}. */
export function knockbackFor(kind, targetGliding, cfg) {
  if (kind === KIND_HIGH) return { h: cfg.knockbackHorizontal * 0.9, v: targetGliding ? -Math.abs(cfg.knockbackVertical) * 1.4 : cfg.knockbackVertical * 0.6 };
  if (kind === KIND_BITE) return { h: cfg.knockbackHorizontal * 0.65, v: cfg.knockbackVertical * 0.8 };
  return { h: cfg.knockbackHorizontal, v: cfg.knockbackVertical };
}

// ------------------------------------------------------------------ escape (DESIGN §10)
/** Contact rule: close, or within losRange with line of sight. */
export function hasContact(distance, lineOfSight, cfg) {
  return distance <= cfg.contactRange || (distance <= cfg.losRange && !!lineOfSight);
}

/**
 * Advance the escape bookkeeping. `st` = {huntStart, lastContact, farSince} in seconds.
 * Returns the escape reason ('distance' | 'contact' | 'maxchase') or null.
 */
export function escapeStep(st, nowSec, distance, contact, cfg) {
  if (contact) st.lastContact = nowSec;
  if (distance >= cfg.escapeDistance) {
    if (st.farSince === null || st.farSince === undefined) st.farSince = nowSec;
  } else {
    st.farSince = null;
  }
  if (cfg.relentless) return null;
  if (st.farSince !== null && st.farSince !== undefined && nowSec - st.farSince >= cfg.escapeDistanceSeconds) return 'distance';
  if (nowSec - st.lastContact >= cfg.breakContactSeconds) return 'contact';
  if (nowSec - st.huntStart >= cfg.maxChaseSeconds) return 'maxchase';
  return null;
}

// ------------------------------------------------------------------ views
/** True when `point` is within `coneDeg` of the view direction from `eye` and within maxDist. */
export function inViewCone(eye, viewDir, point, coneDeg, maxDist = Infinity) {
  const d = sub(point, eye);
  const l = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
  if (l > maxDist) return false;
  if (l < 0.5) return true;
  return angleBetween(viewDir, d) <= coneDeg;
}

/** Body centre of the spider for a given model scale. */
export function bodyCenter(loc, s, cfg) {
  return { x: loc.x, y: loc.y + cfg.bodyCenterHeight * s, z: loc.z };
}

/** Yaw of a view direction vector (Bedrock convention). */
export function viewYaw(viewDir) {
  return Math.atan2(-viewDir.x, viewDir.z) / DEG;
}

// ------------------------------------------------------------------ candidates
/**
 * Candidate column for the auto spawner. The first 75% of the attempts sample the half circle
 * behind the player (outside the view), the rest the full circle.
 */
export function spawnCandidate(rng, center, viewYawDeg, attempt, maxAttempts, cfg) {
  const behind = attempt < Math.ceil(maxAttempts * 0.75);
  const yaw = behind ? viewYawDeg + 90 + rng() * 180 : rng() * 360;
  const d = lerp(cfg.spawnMinDistance, cfg.spawnMaxDistance, rng());
  const f = forwardOf(yaw);
  return { x: Math.floor(center.x + f.x * d), z: Math.floor(center.z + f.z * d), yaw: wrapDeg(yaw), distance: d, behind };
}

/** Candidate column for a stalker relocation: behind the player's view (rear 120 degrees). */
export function relocationCandidate(rng, center, viewYawDeg, cfg) {
  const yaw = viewYawDeg + 180 + (rng() * 2 - 1) * 60;
  const d = lerp(cfg.relocateMinDistance, cfg.relocateMaxDistance, rng());
  const f = forwardOf(yaw);
  return { x: Math.floor(center.x + f.x * d), z: Math.floor(center.z + f.z * d), yaw: wrapDeg(yaw), distance: d };
}

/** Whether a spawner attempt (0-based) still requires forest. */
export function forestRequired(attempt, maxAttempts, preference) {
  return attempt < Math.floor(maxAttempts * clamp(preference, 0, 1));
}

// ------------------------------------------------------------------ chase speed
/**
 * Map a speed multiplier to a status effect: Speed adds 20% per level, Slowness removes 15% per
 * level. Returns {effect: 'speed'|'slowness'|null, amplifier}.
 */
export function speedEffectFor(multiplier) {
  if (multiplier > 1.0001) {
    const level = Math.round((multiplier - 1) / 0.2);
    return level >= 1 ? { effect: 'speed', amplifier: Math.min(level, 10) - 1 } : { effect: null, amplifier: 0 };
  }
  if (multiplier < 0.9999) {
    const level = Math.round((1 - multiplier) / 0.15);
    return level >= 1 ? { effect: 'slowness', amplifier: Math.min(level, 6) - 1 } : { effect: null, amplifier: 0 };
  }
  return { effect: null, amplifier: 0 };
}

/** Seconds between heartbeats for a given distance (faster when closer). */
export function heartbeatInterval(distance) {
  return lerp(0.45, 1.3, clamp((distance - 8) / 40, 0, 1));
}

/** Camera shake intensity for a player at distance d. */
export function shakeIntensityAt(d, cfg) {
  if (cfg.shakeRadius <= 0 || d > cfg.shakeRadius) return 0;
  return Math.max(0.05, cfg.shakeIntensity * (1 - 0.75 * (d / cfg.shakeRadius)));
}
