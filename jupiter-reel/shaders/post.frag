#version 430
// Final composite at output resolution: lens effects, bloom, tone mapping,
// grading, helmet POV overlay, visor cracks, grain and fades.
#include "common.glsl"

uniform sampler2D uScene;     // internal-resolution HDR, alpha = astronaut coverage
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform sampler2D uCrack;     // r = crack line, g = reveal time, b = glint
uniform vec2  uOutRes;
uniform float uTime;
uniform float uExposure;
uniform float uBloomAmt;
uniform vec2  uZoomC;
uniform float uZoomBlur;
uniform float uShimmer;
uniform float uSqueeze;
uniform float uCA;
uniform float uVignette;
uniform float uGrain;
uniform float uFade;
uniform float uFlash;
uniform vec3  uFlashCol;
uniform float uPOV;
uniform float uCrackAmt;
uniform float uRedAlarm;      // red pulse at the frame edges
uniform vec3  uLift;
uniform vec3  uGamma;
uniform vec3  uGain;
uniform float uSat;
uniform float uContrast;
uniform vec3  uTint;

out vec4 fragColor;

vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return sat3((x * (a * x + b)) / (x * (c * x + d) + e));
}

vec3 sampleCA(vec2 uv) {
    if (uCA <= 0.0) return texture(uScene, uv).rgb;
    vec2 dir = uv - 0.5;
    return vec3(texture(uScene, uv + dir * uCA * 0.01).r,
                texture(uScene, uv).g,
                texture(uScene, uv - dir * uCA * 0.01).b);
}

void main() {
    vec2 uv0 = gl_FragCoord.xy / uOutRes;
    float aspect = uOutRes.x / uOutRes.y;
    vec2 d = uv0 - 0.5;
    vec2 da = d * vec2(aspect, 1.0);
    float r2 = dot(da, da);

    vec2 uv = uv0;
    uv = 0.5 + (uv - 0.5) * (1.0 - uPOV * 0.07 * (0.6 - r2));                  // curved visor glass
    uv = 0.5 + (uv - 0.5) * (1.0 - uSqueeze * 0.05 * (1.0 - 2.0 * r2));         // pressure squeeze
    vec2 sh = vec2(vnoise2(uv * vec2(7.0, 12.0) + vec2(0.0, uTime * 2.1)),
                   vnoise2(uv * vec2(7.0, 12.0) + vec2(5.2, uTime * 1.8))) - 0.5;
    uv += sh * uShimmer * vec2(0.007, 0.01) * (0.45 + 0.9 * (1.0 - uv.y));       // heat shimmer

    vec4 ck = vec4(0.0);
    float crack = 0.0;
    if (uCrackAmt > 0.0) {
        ck = texture(uCrack, uv0);
        crack = ck.r * smoothstep(ck.g, ck.g + 0.025, uCrackAmt);
        uv += crack * vec2(0.004, -0.003);
    }

    vec3 col;
    vec4 center = texture(uScene, uv);
    if (uZoomBlur > 0.0) {
        vec3 acc = vec3(0.0);
        float wsum = 0.0;
        for (int i = 0; i < 14; i++) {
            float s = (float(i) + ign(gl_FragCoord.xy)) / 14.0;
            vec2 suv = uZoomC + (uv - uZoomC) * (1.0 - uZoomBlur * 0.09 * s);
            vec4 tx = texture(uScene, suv);
            float w = 1.0 - tx.a;
            acc += tx.rgb * w;
            wsum += w;
        }
        vec3 bg = wsum > 0.01 ? acc / wsum : center.rgb;
        col = mix(bg, center.rgb, center.a);
    } else {
        col = sampleCA(uv);
    }

    col += uBloomAmt * (texture(uBloom1, uv).rgb * 0.45 + texture(uBloom2, uv).rgb * 0.35 + texture(uBloom3, uv).rgb * 0.3);
    col += uFlash * uFlashCol;

    col = aces(col * uExposure);
    col = pow(col, vec3(1.0 / 2.2));
    col = col * uGain + uLift * (1.0 - col);
    col = pow(max(col, 0.0), 1.0 / uGamma);
    float l = luma(col);
    col = mix(vec3(l), col, uSat);
    col = (col - 0.5) * uContrast + 0.5;
    col *= uTint;

    float vig = smoothstep(1.05, 0.25, length(da * vec2(1.0, 0.82)) * 1.25);
    col *= mix(1.0, vig, uVignette);
    float edge = smoothstep(0.25, 0.75, length(da * vec2(1.25, 0.9)));
    col += vec3(0.55, 0.02, 0.0) * edge * uRedAlarm;

    if (uPOV > 0.0) {
        // looking out through the helmet visor: soft dark rim, faint glass reflections
        vec2 q = da;
        float e = pow(pow(abs(q.x) / 0.37, 4.0) + pow(abs(q.y + 0.015) / 0.5, 4.0), 0.25);
        float frame = smoothstep(0.86, 1.02, e);
        col = mix(col, vec3(0.01, 0.011, 0.014) + col * 0.05, frame * uPOV);
        float rimLight = smoothstep(0.8, 0.9, e) * smoothstep(0.98, 0.9, e);
        col += vec3(0.65, 0.7, 0.8) * rimLight * 0.05 * uPOV;
        float streak = smoothstep(0.022, 0.0, abs(q.x * 0.8 + q.y * 0.6 - 0.3)) * smoothstep(0.5, 0.1, length(q - vec2(0.16, 0.28)));
        streak += 0.6 * smoothstep(0.009, 0.0, abs(q.x * 0.8 + q.y * 0.6 - 0.35)) * smoothstep(0.42, 0.1, length(q - vec2(0.18, 0.3)));
        col += vec3(0.75, 0.85, 1.0) * streak * 0.03 * uPOV;
    }

    if (uCrackAmt > 0.0) {
        float glint = ck.b * smoothstep(ck.g, ck.g + 0.025, uCrackAmt);
        col = mix(col, col * 0.25 + vec3(0.02), crack * 0.7);
        col += vec3(0.95, 0.97, 1.0) * glint * 0.55 + vec3(1.0, 0.6, 0.4) * crack * 0.12;
    }

    col *= uFade;
    float g = hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5;
    float g2 = hash12(gl_FragCoord.xy * 1.37 + fract(uTime * 3.17) * 71.0) - 0.5;
    col += (g + g2) * uGrain * (0.6 + 0.4 * (1.0 - luma(col)));
    col += (g - g2) / 255.0;
    fragColor = vec4(sat3(col), 1.0);
}
