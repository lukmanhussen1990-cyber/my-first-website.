/**
 * GLSL shared by the volumetric beam and the dust motes, so both agree exactly
 * on the beam's shape, falloff and shadowing.
 *
 * The volumetric cone has a *virtual apex* behind the lens, positioned so the
 * cone's radius at the lens plane equals the lens aperture. The beam therefore
 * leaves the head as a full-width shaft and diverges at the beam angle, and
 * inverse-square falloff from that apex gives physically consistent near/far
 * behaviour (narrow beams stay bright, floods fade quickly).
 */
export const beamUniformsGLSL = /* glsl */ `
uniform vec3 uApex;
uniform vec3 uAxis;
uniform float uHalfAngle;
uniform float uTanHalf;
uniform float uCosHalf;
uniform float uLensDist;
uniform float uBeamLength;
uniform float uHotspot;
uniform float uSpill;
uniform float uSoftness;
uniform float uRings;
uniform float uIntensity;
uniform vec3 uBeamColor;
uniform mat4 uShadowMatrix;
uniform float uShadowBias;
uniform float uHasShadow;
uniform highp sampler2DShadow uShadowMap;
`;

export const beamFunctionsGLSL = /* glsl */ `
float beamSmooth(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

/* Radial profile, t = θ / halfAngle (matches the spotlight gobo). */
float beamProfile(float t) {
  float h = uHotspot;
  float core = 1.0 - beamSmooth(h * (1.0 - 0.45 * uSoftness), h * (1.0 + 0.6 * uSoftness), t);
  float edge = 1.0 - beamSmooth(0.78 - 0.3 * uSoftness, 1.0, t);
  float c = (t - h * 1.08) / 0.05; // (pow() is undefined for negative bases in GLSL)
  float corona = exp(-c * c) * 0.07 * uRings;
  return max(0.0, core + (1.0 - core) * uSpill * edge + corona * edge);
}

/* Irradiance-like beam strength at a world point (no shadowing). */
float beamField(vec3 p, out vec3 lightDir) {
  vec3 v = p - uApex;
  float h = dot(v, uAxis);
  float dist2 = dot(v, v);
  float dist = sqrt(dist2);
  lightDir = v / max(dist, 1e-5);
  if (h <= uLensDist || h > uLensDist + uBeamLength) return 0.0;
  float radial = sqrt(max(dist2 - h * h, 0.0));
  float t = atan(radial / h) / uHalfAngle;
  if (t >= 1.0) return 0.0;
  // Near the lens the aperture is filled almost evenly; the far-field profile forms with distance.
  float formed = beamSmooth(0.0, 1.6, h - uLensDist);
  float profile = mix(1.0 - beamSmooth(0.82, 1.0, t), beamProfile(t), formed);
  return profile / dist2;
}

float beamShadow(vec3 p) {
  if (uHasShadow < 0.5) return 1.0;
  vec4 sc = uShadowMatrix * vec4(p, 1.0);
  if (sc.w <= 0.0) return 1.0;
  sc.xyz /= sc.w;
  if (sc.x <= 0.0 || sc.x >= 1.0 || sc.y <= 0.0 || sc.y >= 1.0 || sc.z >= 1.0 || sc.z <= 0.0) return 1.0;
  return texture(uShadowMap, vec3(sc.xy, sc.z - uShadowBias));
}

float henyeyGreenstein(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (12.5663706 * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 1e-4), 1.5));
}
`;
