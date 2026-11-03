// Furniture & interior props, all from simple shapes.
import React from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, sphere, torus, plane, glowMat, cone, circle} from '../lib/materials';
import {woodTex, textTex} from '../lib/textures';
import {V3} from '../lib/anim';
import {GlowSprite} from '../world/Nature';

const wood = (c = '#b9824f') => plastic('#ffffff', {map: woodTex(c, [1, 1], 4), rough: 0.6});

export const Bed: React.FC<{position?: V3; rotation?: number; blanket?: string; frame?: string}> = ({position, rotation = 0, blanket = '#5b8cff', frame = '#a5703f'}) => (
	<group position={position} rotation={[0, rotation, 0]}>
		<mesh geometry={rbox(4.2, 1.0, 7.2, 0.12)} material={wood(frame)} position={[0, 0.7, 0]} castShadow receiveShadow />
		<mesh geometry={rbox(4.4, 3.0, 0.4, 0.12)} material={wood(frame)} position={[0, 1.5, -3.6]} castShadow receiveShadow />
		<mesh geometry={rbox(4.4, 1.8, 0.35, 0.12)} material={wood(frame)} position={[0, 0.9, 3.6]} castShadow receiveShadow />
		<mesh geometry={rbox(3.9, 0.7, 6.8, 0.25)} material={plastic('#f5f2ea', {rough: 0.8})} position={[0, 1.45, 0]} castShadow receiveShadow />
		<mesh geometry={rbox(2.6, 0.6, 1.3, 0.28)} material={plastic('#ffffff', {rough: 0.85})} position={[0, 1.95, -2.7]} castShadow receiveShadow />
		<mesh geometry={rbox(4.05, 0.35, 4.6, 0.15)} material={plastic(blanket, {rough: 0.8})} position={[0, 1.88, 1.0]} castShadow receiveShadow />
	</group>
);

export const Armchair: React.FC<{position?: V3; rotation?: number; color?: string}> = ({position, rotation = 0, color = '#c0453b'}) => {
	const m = plastic(color, {rough: 0.75});
	const md = plastic(new THREE.Color(color).multiplyScalar(0.85).getStyle(), {rough: 0.75});
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			<mesh geometry={rbox(3.4, 1.4, 3.0, 0.3)} material={m} position={[0, 0.9, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(3.4, 3.4, 0.9, 0.35)} material={md} position={[0, 2.3, -1.25]} castShadow receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={rbox(0.75, 2.2, 3.0, 0.3)} material={md} position={[sd * 1.7, 1.6, 0]} castShadow receiveShadow />
			))}
			<mesh geometry={rbox(2.4, 0.4, 2.3, 0.18)} material={m} position={[0, 1.75, 0.2]} castShadow receiveShadow />
			{[-1, 1].map((sx) => [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={cyl(0.12, 0.08, 0.3, 8)} material={plastic('#4a2f1c')} position={[sx * 1.4, 0.12, sz * 1.2]} />))}
		</group>
	);
};

export const FloorLamp: React.FC<{position?: V3; on?: boolean; color?: string}> = ({position, on = true, color = '#ffd28a'}) => (
	<group position={position}>
		<mesh geometry={cyl(0.5, 0.6, 0.2, 16)} material={plastic('#3a2f2a')} position={[0, 0.1, 0]} castShadow />
		<mesh geometry={cyl(0.07, 0.07, 5.2, 8)} material={plastic('#3a2f2a')} position={[0, 2.7, 0]} castShadow />
		<mesh geometry={cyl(0.7, 1.1, 1.2, 20, true)} material={on ? glowMat(color, 1.6, {side: THREE.DoubleSide}) : plastic('#f2e3c6', {side: THREE.DoubleSide})} position={[0, 5.5, 0]} />
		{on ? <pointLight position={[0, 5.0, 0]} color={color} intensity={30} distance={18} decay={1.5} /> : null}
		{on ? <GlowSprite position={[0, 5.4, 0]} size={4} color={color} opacity={0.5} /> : null}
	</group>
);

export const SideTable: React.FC<{position?: V3}> = ({position}) => (
	<group position={position}>
		<mesh geometry={rbox(1.6, 0.18, 1.6, 0.06)} material={wood('#9a6a3e')} position={[0, 2.0, 0]} castShadow receiveShadow />
		<mesh geometry={cyl(0.12, 0.16, 2.0, 8)} material={plastic('#6a4428')} position={[0, 1.0, 0]} castShadow />
		<mesh geometry={cyl(0.6, 0.7, 0.12, 14)} material={plastic('#6a4428')} position={[0, 0.06, 0]} />
	</group>
);

/** curtains that close: k = 0 (open, bunched at the sides) .. 1 (closed) */
export const Curtains: React.FC<{position?: V3; width?: number; height?: number; k?: number; color?: string}> = ({position, width = 6, height = 6, k = 0, color = '#ff9f1c'}) => {
	const m = plastic(color, {rough: 0.85});
	const panelW = 0.9 + (width / 2 - 0.9) * k;
	return (
		<group position={position}>
			<mesh geometry={cyl(0.08, 0.08, width + 1.4, 8)} material={plastic('#6b4226')} position={[0, height / 2 + 0.3, 0.2]} rotation={[0, 0, Math.PI / 2]} castShadow />
			{[-1, 1].map((sd) => (
				<group key={sd} position={[sd * (width / 2 + 0.3 - panelW / 2), 0, 0.3]}>
					{Array.from({length: 4}).map((_, i) => (
						<mesh key={i} geometry={rbox(panelW / 4 + 0.08, height, 0.22, 0.08)} material={m} position={[(i - 1.5) * (panelW / 4), 0, (i % 2) * 0.12]} castShadow receiveShadow />
					))}
				</group>
			))}
		</group>
	);
};

/** a window in a wall: frame, panes, sky/night behind (looks outward along -z) */
export const WallWindow: React.FC<{position?: V3; w?: number; h?: number; night?: boolean; frame?: string}> = ({position, w = 5, h = 5, night = false, frame = '#ffffff'}) => {
	const fm = plastic(frame, {rough: 0.45});
	return (
		<group position={position}>
			<mesh geometry={plane(w, h)} material={night ? glowMat('#1d2f8f', 0.9) : glowMat('#bfe6ff', 1.25)} position={[0, 0, -0.05]} />
			{night ? <mesh geometry={circle(0.6, 24)} material={glowMat('#fff3c4', 2.4)} position={[w * 0.25, h * 0.22, -0.04]} /> : null}
			<mesh geometry={box(w + 0.5, 0.3, 0.4)} material={fm} position={[0, h / 2, 0]} castShadow />
			<mesh geometry={box(w + 0.5, 0.3, 0.6)} material={fm} position={[0, -h / 2, 0.1]} castShadow />
			<mesh geometry={box(0.3, h, 0.4)} material={fm} position={[-w / 2, 0, 0]} castShadow />
			<mesh geometry={box(0.3, h, 0.4)} material={fm} position={[w / 2, 0, 0]} castShadow />
			<mesh geometry={box(0.18, h, 0.2)} material={fm} position={[0, 0, 0]} />
			<mesh geometry={box(w, 0.18, 0.2)} material={fm} position={[0, 0, 0]} />
		</group>
	);
};

export const StudentDesk: React.FC<{position?: V3; rotation?: number; color?: string}> = ({position, rotation = 0, color = '#d9a066'}) => (
	<group position={position} rotation={[0, rotation, 0]}>
		<mesh geometry={rbox(3.0, 0.2, 2.0, 0.06)} material={wood(color)} position={[0, 2.6, 0]} castShadow receiveShadow />
		{[-1, 1].map((sx) =>
			[-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={box(0.14, 2.5, 0.14)} material={plastic('#5b6170', {metal: 0.4, rough: 0.4})} position={[sx * 1.3, 1.25, sz * 0.8]} castShadow />),
		)}
	</group>
);

export const Chair: React.FC<{position?: V3; rotation?: number; color?: string}> = ({position, rotation = 0, color = '#3a86ff'}) => (
	<group position={position} rotation={[0, rotation, 0]}>
		<mesh geometry={rbox(1.6, 0.2, 1.5, 0.06)} material={plastic(color, {rough: 0.5})} position={[0, 1.45, 0]} castShadow receiveShadow />
		<mesh geometry={rbox(1.6, 1.4, 0.18, 0.06)} material={plastic(color, {rough: 0.5})} position={[0, 2.3, -0.7]} castShadow />
		{[-1, 1].map((sx) => [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={box(0.1, 1.45, 0.1)} material={plastic('#5b6170', {metal: 0.4, rough: 0.4})} position={[sx * 0.65, 0.72, sz * 0.6]} />))}
	</group>
);

export const Chalkboard: React.FC<{position?: V3; tex: THREE.Texture; w?: number; h?: number}> = ({position, tex, w = 14, h = 6}) => (
	<group position={position}>
		<mesh geometry={rbox(w + 0.6, h + 0.6, 0.3, 0.08)} material={wood('#9a6a3e')} castShadow receiveShadow />
		<mesh geometry={plane(w, h)} material={plastic('#ffffff', {map: tex, rough: 0.9})} position={[0, 0, 0.17]} />
		<mesh geometry={rbox(w * 0.9, 0.18, 0.5, 0.05)} material={wood('#9a6a3e')} position={[0, -h / 2 - 0.25, 0.3]} castShadow />
		<mesh geometry={rbox(0.5, 0.12, 0.12, 0.04)} material={plastic('#ffffff')} position={[w * 0.3, -h / 2 - 0.1, 0.35]} />
	</group>
);

export const TeacherDesk: React.FC<{position?: V3; rotation?: number}> = ({position, rotation = 0}) => (
	<group position={position} rotation={[0, rotation, 0]}>
		<mesh geometry={rbox(5.4, 0.3, 2.6, 0.08)} material={wood('#8a5a34')} position={[0, 2.8, 0]} castShadow receiveShadow />
		<mesh geometry={rbox(5.2, 2.6, 0.2, 0.06)} material={wood('#7a4a2a')} position={[0, 1.4, 1.15]} castShadow receiveShadow />
		{[-1, 1].map((sd) => (
			<mesh key={sd} geometry={rbox(0.25, 2.65, 2.4, 0.06)} material={wood('#7a4a2a')} position={[sd * 2.55, 1.35, 0]} castShadow receiveShadow />
		))}
		<mesh geometry={sphere(0.35, 14, 10)} material={plastic('#e63946', {rough: 0.3})} position={[1.6, 3.3, 0.2]} castShadow />
		<mesh geometry={cyl(0.05, 0.05, 0.25, 6)} material={plastic('#5a3a1e')} position={[1.6, 3.7, 0.2]} />
		<mesh geometry={rbox(1.4, 0.35, 1.0, 0.04)} material={plastic('#4a8cff')} position={[-1.3, 3.15, 0]} rotation={[0, 0.3, 0]} castShadow />
	</group>
);

export const Sink: React.FC<{position?: V3}> = ({position}) => (
	<group position={position}>
		<mesh geometry={cyl(0.35, 0.45, 2.6, 16)} material={plastic('#f4f6f8', {rough: 0.25})} position={[0, 1.3, 0]} castShadow receiveShadow />
		<mesh geometry={rbox(2.4, 0.6, 1.8, 0.25)} material={plastic('#f4f6f8', {rough: 0.2})} position={[0, 2.85, 0]} castShadow receiveShadow />
		<mesh geometry={rbox(1.8, 0.2, 1.2, 0.15)} material={plastic('#cfe3ef', {rough: 0.1})} position={[0, 3.08, 0.05]} />
		<mesh geometry={cyl(0.08, 0.08, 0.7, 10)} material={plastic('#c9d1d9', {metal: 0.9, rough: 0.2})} position={[0, 3.45, -0.65]} />
		<mesh geometry={rbox(0.14, 0.14, 0.6, 0.05)} material={plastic('#c9d1d9', {metal: 0.9, rough: 0.2})} position={[0, 3.75, -0.4]} />
	</group>
);

export const Mirror: React.FC<{position?: V3; w?: number; h?: number}> = ({position, w = 2.4, h = 3}) => (
	<group position={position}>
		<mesh geometry={rbox(w + 0.3, h + 0.3, 0.15, 0.12)} material={plastic('#ffd23f', {rough: 0.4})} castShadow />
		<mesh geometry={plane(w, h)} material={plastic('#dff3ff', {metal: 0.9, rough: 0.05, envInt: 2})} position={[0, 0, 0.09]} />
	</group>
);

export const Towel: React.FC<{position?: V3; color?: string}> = ({position, color = '#ff8fab'}) => (
	<group position={position}>
		<mesh geometry={cyl(0.06, 0.06, 2.2, 8)} material={plastic('#c9d1d9', {metal: 0.9, rough: 0.2})} rotation={[0, 0, Math.PI / 2]} />
		<mesh geometry={rbox(1.6, 2.2, 0.2, 0.08)} material={plastic(color, {rough: 0.9})} position={[0, -1.05, 0.08]} castShadow />
		<mesh geometry={box(1.62, 0.2, 0.22)} material={plastic('#ffffff', {rough: 0.9})} position={[0, -1.7, 0.08]} />
	</group>
);

export const Backpack: React.FC<{position?: V3; rotation?: V3; open?: number; color?: string; scale?: number}> = ({position, rotation, open = 1, color = '#ff6b35', scale = 1}) => {
	const m = plastic(color, {rough: 0.6});
	const md = plastic(new THREE.Color(color).multiplyScalar(0.8).getStyle(), {rough: 0.6});
	return (
		<group position={position} rotation={rotation} scale={scale}>
			<mesh geometry={rbox(2.0, 2.2, 1.2, 0.35)} material={m} position={[0, 1.1, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(1.4, 0.9, 0.3, 0.2)} material={md} position={[0, 0.7, 0.62]} castShadow />
			<mesh geometry={rbox(1.5, 0.5, 0.1, 0.1)} material={plastic('#2d3142')} position={[0, 1.15, 0.72]} />
			{/* flap */}
			<group position={[0, 2.15, -0.55]} rotation={[-open * 2.1, 0, 0]}>
				<mesh geometry={rbox(2.0, 0.25, 1.2, 0.12)} material={md} position={[0, 0, 0.55]} castShadow />
			</group>
			<mesh geometry={plane(1.6, 0.9)} material={plastic('#2a1a14')} position={[0, 2.21, 0]} rotation={[-Math.PI / 2, 0, 0]} />
			<mesh geometry={torus(0.3, 0.06, 6, 16, Math.PI)} material={md} position={[0, 2.2, -0.2]} />
		</group>
	);
};

export const ChipBag: React.FC<{position?: V3; rotation?: V3}> = ({position, rotation}) => (
	<group position={position} rotation={rotation}>
		<mesh geometry={rbox(0.9, 1.2, 0.35, 0.15)} material={plastic('#ffd23f', {rough: 0.3, metal: 0.3})} castShadow />
		<mesh geometry={circle(0.28, 20)} material={plastic('#e63946')} position={[0, 0.1, 0.19]} />
		<mesh geometry={box(0.92, 0.1, 0.2)} material={plastic('#e63946')} position={[0, 0.58, 0]} />
	</group>
);

/** shop counter with a cash register */
export const Counter: React.FC<{position?: V3; w?: number}> = ({position, w = 8}) => (
	<group position={position}>
		<mesh geometry={rbox(w, 3.2, 2.2, 0.1)} material={wood('#a8743f')} position={[0, 1.6, 0]} castShadow receiveShadow />
		<mesh geometry={rbox(w + 0.4, 0.3, 2.6, 0.08)} material={plastic('#2a9d8f', {rough: 0.4})} position={[0, 3.3, 0]} castShadow receiveShadow />
		<mesh geometry={rbox(1.6, 1.0, 1.2, 0.1)} material={plastic('#3d405b', {rough: 0.4})} position={[w / 2 - 1.4, 3.95, -0.1]} castShadow />
		<mesh geometry={rbox(1.2, 0.5, 0.1, 0.05)} material={glowMat('#7cff6b', 1.2)} position={[w / 2 - 1.4, 4.2, 0.52]} />
	</group>
);

export const Shelf: React.FC<{position?: V3; w?: number; levels?: number; rotation?: number}> = ({position, w = 8, levels = 3, rotation = 0}) => (
	<group position={position} rotation={[0, rotation, 0]}>
		{Array.from({length: levels}).map((_, i) => (
			<mesh key={i} geometry={rbox(w, 0.25, 2.2, 0.06)} material={wood('#c08a52')} position={[0, 0.2 + i * 3.4, 0]} castShadow receiveShadow />
		))}
		{[-1, 1].map((sd) => (
			<mesh key={sd} geometry={rbox(0.25, levels * 3.4, 2.2, 0.06)} material={wood('#a8743f')} position={[sd * (w / 2), (levels * 3.4) / 2, 0]} castShadow />
		))}
	</group>
);

/** a hanging sign with text (texture) */
export const Sign: React.FC<{position?: V3; rotation?: V3; text: string; w?: number; h?: number; bg?: string; fg?: string; glow?: boolean}> = ({position, rotation, text, w = 8, h = 2, bg = '#ff4d6d', fg = '#ffffff', glow = false}) => {
	const tex = textTex(`sign-${text}-${bg}-${fg}`, 1024, Math.round((1024 * h) / w), bg, [{text, size: Math.round(((1024 * h) / w) * 0.62), color: fg, y: Math.round((1024 * h) / w / 2) + 4, weight: 900}], {radius: 40, border: '#ffffff', borderW: 18});
	return (
		<group position={position} rotation={rotation}>
			<mesh geometry={rbox(w + 0.2, h + 0.2, 0.25, 0.1)} material={plastic('#ffffff', {rough: 0.5})} castShadow />
			<mesh geometry={plane(w, h)} material={glow ? new THREE.MeshBasicMaterial({map: tex, toneMapped: false, color: new THREE.Color(1.35, 1.35, 1.35)}) : plastic('#ffffff', {map: tex, rough: 0.5})} position={[0, 0, 0.14]} />
		</group>
	);
};

export const Rug: React.FC<{position?: V3; r?: number; color?: string}> = ({position, r = 4, color = '#5aa9e6'}) => (
	<group position={position}>
		<mesh geometry={cyl(r, r, 0.08, 40)} material={plastic(color, {rough: 0.95})} receiveShadow />
		<mesh geometry={torus(r * 0.75, 0.08, 6, 40)} material={plastic('#ffffff', {rough: 0.95})} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} />
	</group>
);

export const PottedPlant: React.FC<{position?: V3}> = ({position}) => (
	<group position={position}>
		<mesh geometry={cyl(0.6, 0.45, 1.2, 14)} material={plastic('#e07a5f', {rough: 0.6})} position={[0, 0.6, 0]} castShadow />
		<mesh geometry={sphere(1.0, 14, 10)} material={plastic('#43aa5a', {rough: 0.8})} position={[0, 1.9, 0]} castShadow />
		<mesh geometry={cone(0.5, 1.4, 8)} material={plastic('#2f9a4a', {rough: 0.8})} position={[0.5, 2.2, 0.2]} rotation={[0, 0, -0.4]} castShadow />
	</group>
);

export const Bookshelf: React.FC<{position?: V3; rotation?: number}> = ({position, rotation = 0}) => {
	const cols = ['#e63946', '#2a6fdb', '#ffb703', '#2a9d8f', '#8338ec', '#ff6b35'];
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			<mesh geometry={rbox(4.2, 7.2, 1.4, 0.08)} material={wood('#8a5a34')} position={[0, 3.6, 0]} castShadow receiveShadow />
			{[1.4, 3.6, 5.8].map((y, r) =>
				Array.from({length: 7}).map((_, i) => (
					<mesh key={`${r}-${i}`} geometry={rbox(0.42, 1.5 + ((i * 7 + r) % 3) * 0.15, 1.0, 0.04)} material={plastic(cols[(i + r * 2) % cols.length], {rough: 0.6})} position={[-1.6 + i * 0.52, y + 0.75, 0.3]} castShadow />
				)),
			)}
		</group>
	);
};

export const WallFrame: React.FC<{position?: V3; w?: number; h?: number; color?: string; art?: string}> = ({position, w = 2.2, h = 1.7, color = '#ffd23f', art = '#7fd3ff'}) => (
	<group position={position}>
		<mesh geometry={rbox(w, h, 0.15, 0.05)} material={plastic(color, {rough: 0.4})} castShadow />
		<mesh geometry={plane(w - 0.4, h - 0.4)} material={plastic(art, {rough: 0.7})} position={[0, 0, 0.08]} />
		<mesh geometry={circle(0.3, 16)} material={plastic('#ffe14a')} position={[w * 0.18, h * 0.12, 0.09]} />
	</group>
);
