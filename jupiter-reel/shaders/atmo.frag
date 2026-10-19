#version 430
// Pass 1 of the atmosphere shots: the cloud volume, at output resolution.
#include "common.glsl"
#include "atmo_common.glsl"

out vec4 fragColor;

void main() {
    vec2 frag = gl_FragCoord.xy + uJitter;
    vec2 ndc = frag / uRes * 2.0 - 1.0;
    float aspect = uRes.x / uRes.y;
    vec3 rd = normalize(uCamRot * vec3(ndc.x * aspect * uTanHalfFov, ndc.y * uTanHalfFov, 1.0));
    float j = ign(gl_FragCoord.xy + vec2(uTime * 37.0, uTime * 17.0) * 3.0);
    vec4 v = marchVolume(uCamPos, rd, 1.0, uMaxDist, 76, j, 0.0);
    fragColor = vec4(v.rgb + v.a * background(rd), v.a);
}
