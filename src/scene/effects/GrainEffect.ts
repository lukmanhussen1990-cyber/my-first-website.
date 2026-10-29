import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Fine animated film grain applied in a perceptual (gamma) space, after tone
 * mapping. Besides the filmic texture it dithers the smooth dark gradients of
 * the fog and beam, which would otherwise band in 8-bit output.
 */
const fragmentShader = /* glsl */ `
uniform float uAmount;
uniform float uSeed;

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  vec3 g = pow(c, vec3(1.0 / 2.2));
  float n = grainHash(gl_FragCoord.xy + uSeed * 117.0) + grainHash(gl_FragCoord.xy * 1.37 + uSeed * 59.0) - 1.0;
  // Strongest in the mid-darks where film grain is most visible; never lifts pure black much.
  float weight = mix(0.6, 1.0, smoothstep(0.0, 0.25, g.g)) * (1.0 - 0.6 * smoothstep(0.6, 1.0, g.g));
  g += n * uAmount * weight;
  outputColor = vec4(pow(max(g, 0.0), vec3(2.2)), inputColor.a);
}
`;

export class GrainEffect extends Effect {
  private frame = 0;

  constructor(amount = 0.012) {
    super('GrainEffect', fragmentShader, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uAmount', new Uniform(amount)],
        ['uSeed', new Uniform(0)],
      ]),
    });
  }

  override update() {
    this.frame = (this.frame + 1) % 997;
    (this.uniforms.get('uSeed') as Uniform<number>).value = this.frame;
  }
}
