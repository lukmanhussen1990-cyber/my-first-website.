#version 430
// Separable 9-tap gaussian; also used as a plain downsample when uDir = 0.
uniform sampler2D uSrc;
uniform vec2 uDstRes;
uniform vec2 uDir;
out vec4 fragColor;
void main() {
    vec2 uv = gl_FragCoord.xy / uDstRes;
    if (uDir.x == 0.0 && uDir.y == 0.0) { fragColor = texture(uSrc, uv); return; }
    vec2 d = uDir / uDstRes;
    vec3 c = texture(uSrc, uv).rgb * 0.2270270270;
    c += (texture(uSrc, uv + d * 1.3846153846).rgb + texture(uSrc, uv - d * 1.3846153846).rgb) * 0.3162162162;
    c += (texture(uSrc, uv + d * 3.2307692308).rgb + texture(uSrc, uv - d * 3.2307692308).rgb) * 0.0702702703;
    fragColor = vec4(c, 1.0);
}
