#version 430
// Bright pass + downsample of the HDR scene for bloom.
uniform sampler2D uSrc;
uniform vec2 uDstRes;
uniform float uThreshold;
out vec4 fragColor;
void main() {
    vec2 uv = gl_FragCoord.xy / uDstRes;
    vec2 o = 0.25 / uDstRes;
    vec3 c = texture(uSrc, uv + vec2(-o.x, -o.y)).rgb + texture(uSrc, uv + vec2(o.x, -o.y)).rgb
           + texture(uSrc, uv + vec2(-o.x, o.y)).rgb + texture(uSrc, uv + vec2(o.x, o.y)).rgb;
    c *= 0.25;
    float l = max(c.r, max(c.g, c.b));
    float k = smoothstep(uThreshold, uThreshold * 2.0 + 0.2, l);
    fragColor = vec4(c * k, 1.0);
}
