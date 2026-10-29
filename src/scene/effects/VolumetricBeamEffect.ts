import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Color, Matrix4, Uniform, Vector3, type Camera, type Data3DTexture, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { beamFunctionsGLSL, beamUniformsGLSL } from './beamGLSL';

/**
 * Screen-space analytic volumetric light for a spotlight-shaped beam.
 *
 * Per pixel: reconstruct the view ray from the depth buffer, intersect it with
 * the beam cone analytically, then integrate single scattering only across the
 * covered segment (inverse-square falloff, Henyey–Greenstein phase, out-
 * scattering, drifting 3D haze and the spotlight's own shadow map, so objects
 * cast real shafts of shadow through the haze). Pixels that miss the cone
 * cost a handful of ALU ops.
 *
 * Also adds a depth-tested lens glare when the camera looks into the beam, and
 * sanitises/clamps the HDR buffer so extreme specular highlights can't break bloom.
 * It therefore stays enabled even while the torch is off.
 */
const fragmentShader = /* glsl */ `
${beamUniformsGLSL}
uniform mat4 uCamWorld;
uniform mat4 uProjInv;
uniform vec3 uCamPos;
uniform float uDensity;
uniform float uExtinction;
uniform float uAnisotropy;
uniform highp sampler3D uNoise;
uniform float uNoiseScale;
uniform float uNoiseAmount;
uniform vec3 uWind;
uniform vec3 uLensScreen;
uniform float uGlare;
uniform float uGlareSize;
uniform float uClampMax;

${beamFunctionsGLSL}

/* Ray vs. the forward nappe of the cone, clipped to the axial slab [uLensDist, uLensDist + uBeamLength]. */
bool coneInterval(vec3 ro, vec3 rd, out float t0, out float t1) {
  vec3 co = ro - uApex;
  float dv = dot(rd, uAxis);
  float cov = dot(co, uAxis);
  float c2 = uCosHalf * uCosHalf;
  float A = dv * dv - c2;
  float B = 2.0 * (dv * cov - dot(rd, co) * c2);
  float C = cov * cov - dot(co, co) * c2;
  float h0 = uLensDist;
  float h1 = uLensDist + uBeamLength;

  float s0 = -1e9;
  float s1 = 1e9;
  if (abs(dv) < 1e-6) {
    if (cov < h0 || cov > h1) return false;
  } else {
    float ta = (h0 - cov) / dv;
    float tb = (h1 - cov) / dv;
    s0 = min(ta, tb);
    s1 = max(ta, tb);
  }

  float q0 = -1e9;
  float q1 = 1e9;
  float disc = B * B - 4.0 * A * C;
  if (abs(A) < 1e-7) {
    if (abs(B) < 1e-7) {
      if (C < 0.0) return false;
    } else if (B > 0.0) {
      q0 = -C / B;
    } else {
      q1 = -C / B;
    }
  } else if (A < 0.0) {
    if (disc < 0.0) return false;
    float sq = sqrt(disc);
    float r0 = (-B + sq) / (2.0 * A);
    float r1 = (-B - sq) / (2.0 * A);
    q0 = min(r0, r1);
    q1 = max(r0, r1);
  } else if (disc >= 0.0) {
    float sq = sqrt(disc);
    float r0 = (-B - sq) / (2.0 * A);
    float r1 = (-B + sq) / (2.0 * A);
    if (dv > 0.0) q0 = r1; else q1 = r0;
  }

  t0 = max(max(s0, q0), 0.0);
  t1 = min(s1, q1);
  return t1 > t0;
}

float interleavedNoise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  // Sanitise the HDR scene first: a mirror reflecting the hotspot can exceed the
  // half-float range (→ Inf), and bloom's upsampling would turn that into NaN blocks.
  vec3 base = inputColor.rgb;
  if (any(isnan(base))) base = vec3(0.0);
  base = min(base, vec3(uClampMax));

  vec3 scatter = vec3(0.0);

  if (uIntensity > 0.0) {
    vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 viewPos = uProjInv * ndc;
    viewPos /= viewPos.w;
    vec3 world = (uCamWorld * vec4(viewPos.xyz, 1.0)).xyz;
    vec3 ro = uCamPos;
    vec3 rd = world - ro;
    float tScene = length(rd);
    rd /= tScene;
    if (depth >= 0.999999) tScene = 1e4;

    float t0;
    float t1;
    if (coneInterval(ro, rd, t0, t1)) {
      t1 = min(t1, tScene);
      if (t1 > t0) {
        float dt = (t1 - t0) / float(STEPS);
        float jitter = interleavedNoise(gl_FragCoord.xy);
        float acc = 0.0;
        for (int i = 0; i < STEPS; i++) {
          float t = t0 + (float(i) + jitter) * dt;
          vec3 p = ro + rd * t;
          vec3 lightDir;
          float field = beamField(p, lightDir);
          if (field <= 0.0) continue;
          float haze = 1.0 + uNoiseAmount * (texture(uNoise, p * uNoiseScale + uWind).r * 2.0 - 1.0);
          float transmittance = exp(-uExtinction * t);
          acc += field * haze * transmittance * beamShadow(p) * henyeyGreenstein(dot(lightDir, -rd), uAnisotropy);
        }
        scatter = uBeamColor * (uIntensity * uDensity * acc * dt);
      }
    }
  }

  vec3 glare = vec3(0.0);
  if (uGlare > 0.0) {
    // Soft occlusion test around the lens centre.
    vec2 o = texelSize * 2.5;
    float z = uLensScreen.z - 0.00003;
    float visible = 0.2 * (
      step(z, readDepth(uLensScreen.xy)) +
      step(z, readDepth(uLensScreen.xy + vec2(o.x, 0.0))) +
      step(z, readDepth(uLensScreen.xy - vec2(o.x, 0.0))) +
      step(z, readDepth(uLensScreen.xy + vec2(0.0, o.y))) +
      step(z, readDepth(uLensScreen.xy - vec2(0.0, o.y))));
    if (visible > 0.0) {
      vec2 d = (uv - uLensScreen.xy) * vec2(aspect, 1.0);
      float r = length(d) / uGlareSize;
      float core = exp(-r * r * 14.0);
      float halo = 0.06 / (1.0 + r * r * 2.5);
      float ang = atan(d.y, d.x + 1e-6);
      float streaks = pow(abs(cos(ang * 3.0 + 0.35)), 90.0) * exp(-r * 1.8) * 0.22;
      glare = uBeamColor * (uGlare * visible * (core + halo + streaks));
    }
  }

  vec3 added = scatter + glare;
  if (any(isnan(added)) || any(isinf(added))) added = vec3(0.0);
  outputColor = vec4(min(base + added, vec3(uClampMax)), inputColor.a);
}
`;

export interface VolumetricBeamOptions {
  steps?: number;
  noise: Data3DTexture;
}

export class VolumetricBeamEffect extends Effect {
  private camera: Camera | null = null;
  private elapsed = 0;
  private readonly wind = new Vector3(0.018, 0.006, -0.012);

  constructor({ steps = 32, noise }: VolumetricBeamOptions) {
    super('VolumetricBeamEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.SRC,
      defines: new Map([['STEPS', String(Math.round(steps))]]),
      uniforms: new Map<string, Uniform>([
        ['uApex', new Uniform(new Vector3())],
        ['uAxis', new Uniform(new Vector3(0, 0, -1))],
        ['uHalfAngle', new Uniform(0.25)],
        ['uTanHalf', new Uniform(Math.tan(0.25))],
        ['uCosHalf', new Uniform(Math.cos(0.25))],
        ['uLensDist', new Uniform(0.5)],
        ['uBeamLength', new Uniform(36)],
        ['uHotspot', new Uniform(0.5)],
        ['uSpill', new Uniform(0.16)],
        ['uSoftness', new Uniform(0.4)],
        ['uRings', new Uniform(0.5)],
        ['uIntensity', new Uniform(0)],
        ['uBeamColor', new Uniform(new Color(1, 1, 1))],
        ['uShadowMatrix', new Uniform(new Matrix4())],
        ['uShadowBias', new Uniform(0.0006)],
        ['uHasShadow', new Uniform(0)],
        ['uShadowMap', new Uniform(null)], // set every frame by syncBeamUniforms()
        ['uCamWorld', new Uniform(new Matrix4())],
        ['uProjInv', new Uniform(new Matrix4())],
        ['uCamPos', new Uniform(new Vector3())],
        ['uDensity', new Uniform(0.0085)],
        ['uExtinction', new Uniform(0.02)],
        ['uAnisotropy', new Uniform(0.42)],
        ['uNoise', new Uniform(noise)],
        ['uNoiseScale', new Uniform(0.32)],
        ['uNoiseAmount', new Uniform(0.55)],
        ['uWind', new Uniform(new Vector3())],
        ['uLensScreen', new Uniform(new Vector3(0.5, 0.5, 1))],
        ['uGlare', new Uniform(0)],
        ['uGlareSize', new Uniform(0.12)],
        ['uClampMax', new Uniform(256)],
      ]),
    });
  }

  override set mainCamera(camera: Camera) {
    this.camera = camera;
  }

  /** Typed uniform accessor. */
  u<T = unknown>(name: string): Uniform<T> {
    return this.uniforms.get(name) as Uniform<T>;
  }

  setSteps(steps: number) {
    const value = String(Math.max(4, Math.round(steps)));
    if (this.defines.get('STEPS') === value) return;
    this.defines.set('STEPS', value);
    this.setChanged();
  }

  setShadow(map: Texture | null, matrix: Matrix4 | null, bias: number) {
    this.u<Texture | null>('uShadowMap').value = map;
    this.u<number>('uHasShadow').value = map ? 1 : 0;
    if (matrix) this.u<Matrix4>('uShadowMatrix').value.copy(matrix);
    this.u<number>('uShadowBias').value = bias;
  }

  override update(_renderer: WebGLRenderer, _inputBuffer: WebGLRenderTarget, deltaTime = 0) {
    const camera = this.camera;
    if (!camera) return;
    this.elapsed += deltaTime;
    this.u<Matrix4>('uCamWorld').value.copy(camera.matrixWorld);
    this.u<Matrix4>('uProjInv').value.copy(camera.projectionMatrixInverse);
    this.u<Vector3>('uCamPos').value.setFromMatrixPosition(camera.matrixWorld);
    this.u<Vector3>('uWind').value.copy(this.wind).multiplyScalar(this.elapsed);
  }
}
