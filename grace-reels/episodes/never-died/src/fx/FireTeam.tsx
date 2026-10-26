// The chariot and horses of fire: the team silhouette (redrawn each frame) through a flame shader,
// with an additive glow halo. Faces the camera like the cut-out characters.
import {useMemo} from 'react';
import * as THREE from 'three';
import {softDot} from '../lib/textures';
import {drawTeam, TEAM_CENTER, TEAM_H, TEAM_SIZE, TEAM_W, TeamPose} from './team';

export const FIRE_GLSL = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
	return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
vec3 fireRamp(float h){
	vec3 c = mix(vec3(0.32,0.03,0.01), vec3(1.5,0.36,0.05), smoothstep(0.08,0.38,h));
	c = mix(c, vec3(2.7,1.25,0.3), smoothstep(0.38,0.68,h));
	c = mix(c, vec3(3.6,2.9,1.7), smoothstep(0.74,1.0,h));
	return c;
}
`;

const makeMaterial = (map: THREE.Texture) =>
	new THREE.ShaderMaterial({
		uniforms: {uSil: {value: map}, uTime: {value: 0}, uI: {value: 1}, uOpacity: {value: 1}, uTexel: {value: new THREE.Vector2(1 / TEAM_W, 1 / TEAM_H)}},
		vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
		fragmentShader: `${FIRE_GLSL}
			uniform sampler2D uSil; uniform float uTime, uI, uOpacity; uniform vec2 uTexel; varying vec2 vUv;
			void main(){
				vec2 uv = vUv;
				// flames rise and trail behind the gallop: sample below and ahead of each pixel
				float heat = 0.;
				for (int i = 0; i < 12; i++) {
					float f = float(i) / 11.;
					float wob = (vn(uv * vec2(9., 5.) + vec2(f * 2.7, -uTime * 2.6)) - 0.5) * 0.06 * f;
					vec2 off = vec2(0.085 * f + wob, -0.24 * f);
					float a = texture2D(uSil, uv + off).r;
					heat = max(heat, a * (1. - f * 0.95));
				}
				vec4 s0 = texture2D(uSil, uv);
				float core = (s0.r * 2. + texture2D(uSil, uv + vec2(uTexel.x * 3., 0.)).r + texture2D(uSil, uv - vec2(uTexel.x * 3., 0.)).r
					+ texture2D(uSil, uv + vec2(0., uTexel.y * 3.)).r + texture2D(uSil, uv - vec2(0., uTexel.y * 3.)).r) / 6.;
				float n = fbm(uv * vec2(15., 8.) + vec2(uTime * 2.2, -uTime * 5.2));
				float h = heat * (0.3 + 1.0 * n);
				h = max(h, core * (0.56 + 0.42 * n));
				float lines = smoothstep(0.5, 0.8, vn(uv * vec2(30., 13.) + vec2(uTime * 7., uTime * 0.5)));
				h -= core * lines * 0.24;
				float g = s0.g > 0.01 ? s0.g : 1.;
				h *= mix(0.74, 1.0, g);
				float alpha = smoothstep(0.1, 0.4, h) * uOpacity;
				vec3 col = fireRamp(clamp(h, 0., 1.)) * uI;
				gl_FragColor = vec4(col * alpha, alpha);
			}`,
		transparent: true,
		premultipliedAlpha: true,
		depthWrite: false,
		side: THREE.DoubleSide, // mirrored when the team faces left
		fog: false,
	});

export type FireTeamProps = {
	pose: TeamPose;
	position: [number, number, number]; // team origin (ground under the team centre)
	facing: number; // +1 right, -1 left
	scale: number;
	yaw: number;
	lean: number;
	intensity: number;
	opacity?: number;
	renderOrder?: number;
	glow?: number;
};

export const FireTeam: React.FC<FireTeamProps> = ({pose, position, facing, scale, yaw, lean, intensity, opacity = 1, renderOrder = 200, glow = 1}) => {
	const res = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = TEAM_W;
		canvas.height = TEAM_H;
		const tex = new THREE.CanvasTexture(canvas);
		tex.colorSpace = THREE.NoColorSpace;
		tex.minFilter = THREE.LinearFilter;
		tex.generateMipmaps = false;
		const mat = makeMaterial(tex);
		const glowMat = new THREE.MeshBasicMaterial({map: softDot(), color: '#ff7a2e', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false});
		return {canvas, ctx: canvas.getContext('2d')!, tex, mat, glowMat};
	}, []);
	drawTeam(res.ctx, pose);
	res.tex.needsUpdate = true;
	res.mat.uniforms.uTime.value = pose.t;
	res.mat.uniforms.uI.value = intensity;
	res.mat.uniforms.uOpacity.value = opacity;
	res.glowMat.opacity = 0.32 * glow * opacity;
	const [w, h] = TEAM_SIZE;
	const visible = opacity > 0.001;
	return (
		<group position={position} rotation-y={yaw} visible={visible}>
			<group rotation-x={-lean}>
				<mesh position={[TEAM_CENTER[0] * facing * scale, TEAM_CENTER[1] * scale, -0.05]} scale={[w * scale * 2.2, h * scale * 2.6, 1]} material={res.glowMat} renderOrder={renderOrder - 1}>
					<planeGeometry args={[1, 1]} />
				</mesh>
				<mesh position={[TEAM_CENTER[0] * facing * scale, TEAM_CENTER[1] * scale, 0]} scale={[w * scale * facing, h * scale, 1]} material={res.mat} renderOrder={renderOrder}>
					<planeGeometry args={[1, 1]} />
				</mesh>
			</group>
		</group>
	);
};
