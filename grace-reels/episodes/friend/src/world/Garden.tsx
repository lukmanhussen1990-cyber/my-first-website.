// The olive garden at night (and at dawn), built from the GPT layers: sky with the big moon, far hills
// with the city, the olive grove, and the near frame of trunks and rocks, as flat planes at different
// depths. Code adds haze between the layers, moonlight glow, torches and embers.
import {Flame} from '../fx/Flame';
import {ParticleSpec, Particles} from '../fx/Particles';
import {hash} from '../lib/random';
import type {SpriteLook} from '../render/spriteMaterial';
import {Haze, Layer, Pool} from './Layer';

// Torch heads (where the flame sits) in sprite pixels, y down from the top of the image.
export const TORCH_HEAD: Record<string, [number, number]> = {
	'crowd/torch1': [298, 26],
	'crowd/torch2': [310, 24],
	'props/torch_a': [113, 30],
	'props/torch_b': [96, 26],
};

export type GardenLook = {
	sky?: SpriteLook;
	far?: SpriteLook;
	mid?: SpriteLook;
	near?: SpriteLook;
	haze?: number; // 0..1 amount of blue night mist
	hazeColor?: string;
	dawn?: number; // 0..1 warm light rising behind the trees (S13)
};

export type GardenPlacement = {
	sky: {x: number; y: number; z: number; width: number; sprite?: string};
	far?: {x: number; y: number; z: number; width: number};
	mid?: {x: number; y: number; z: number; width: number; flip?: boolean};
	near?: {x: number; y: number; z: number; width: number};
};

export const GardenLayers: React.FC<{place: GardenPlacement; look?: GardenLook}> = ({place, look = {}}) => {
	const {sky, far, mid, near} = place;
	const haze = look.haze ?? 0.5;
	const hc = look.hazeColor ?? '#22304f';
	const dawn = look.dawn ?? 0;
	return (
		<>
			<Layer sprite={sky.sprite ?? 'bg/garden_sky_b'} position={[sky.x, sky.y, sky.z]} width={sky.width} anchor="center" look={look.sky} renderOrder={-950} />
			{dawn > 0 && (
				<>
					{/* the warm light rising behind the hills: a broad glow low in the sky */}
					<Pool position={[sky.x - sky.width * 0.05, sky.y - sky.width * 0.42, sky.z + 1]} size={[sky.width * 1.6, sky.width * 0.9]} color="#ffc27a" intensity={0.85 * dawn} additive falloff={1.4} renderOrder={-940} />
					<Pool position={[sky.x - sky.width * 0.05, sky.y - sky.width * 0.5, sky.z + 1.5]} size={[sky.width * 0.7, sky.width * 0.35]} color="#fff0c8" intensity={0.9 * dawn} additive falloff={2.0} renderOrder={-939} />
				</>
			)}
			{far && <Layer sprite="bg/garden_far" position={[far.x, far.y, far.z]} width={far.width} anchor="bottom" look={look.far} renderOrder={-850} />}
			{far && haze > 0 && <Haze position={[far.x, far.y + far.width * 0.12, far.z + 2]} size={[far.width * 1.4, far.width * 0.35]} color={hc} bottom={0.55 * haze} top={0} renderOrder={-840} />}
			{mid && <Layer sprite="bg/garden_mid" position={[mid.x, mid.y, mid.z]} width={mid.width} anchor="bottom" flipX={mid.flip} look={look.mid} renderOrder={-750} />}
			{mid && haze > 0 && <Haze position={[mid.x, mid.y + mid.width * 0.08, mid.z + 1]} size={[mid.width * 1.5, mid.width * 0.22]} color={hc} bottom={0.35 * haze} top={0} renderOrder={-740} />}
			{near && <Layer sprite="bg/garden_near" position={[near.x, near.y, near.z]} width={near.width} anchor="bottom" look={look.near} renderOrder={700} />}
		</>
	);
};

// A torch held by someone: the flame on the torch head plus its glow. `px` is the sprite pixel of the
// torch head, converted with the sprite's world placement (scale s = metres per pixel, facing ±1).
export const TorchFlame: React.FC<{
	foot: [number, number, number]; // world position of the sprite's foot point
	footPx: [number, number]; // the sprite's foot pixel
	headPx: [number, number];
	s: number;
	facing?: number;
	t: number;
	seed: number;
	height?: number;
	intensity?: number;
	order?: number;
}> = ({foot, footPx, headPx, s, facing = 1, t, seed, height = 0.42, intensity = 1, order = 520}) => {
	const x = foot[0] + (headPx[0] - footPx[0]) * s * facing;
	const y = foot[1] + (footPx[1] - headPx[1]) * s;
	return <Flame position={[x, y, foot[2] + 0.01]} height={height} t={t} seed={seed} intensity={intensity} glow={3.2} renderOrder={order} />;
};

// Embers rising from torches and drifting through the air (birth times spread over [t0, t1]).
export const emberSpecs = (n: number, t0: number, t1: number, box: {x: [number, number]; y: [number, number]; z: [number, number]}, seed: number, rise = 0.5): ParticleSpec[] =>
	Array.from({length: n}, (_, i) => ({
		birth: t0 + (i / n) * (t1 - t0) + hash(seed, i, 9) * ((t1 - t0) / n),
		pos: [
			box.x[0] + hash(seed, i, 1) * (box.x[1] - box.x[0]),
			box.y[0] + hash(seed, i, 2) * (box.y[1] - box.y[0]),
			box.z[0] + hash(seed, i, 3) * (box.z[1] - box.z[0]),
		] as [number, number, number],
		vel: [(hash(seed, i, 4) - 0.35) * 0.35, rise * (0.4 + hash(seed, i, 5) * 0.8), (hash(seed, i, 6) - 0.5) * 0.2] as [number, number, number],
		life: 1.6 + hash(seed, i, 7) * 2.2,
		size: 0.5 + hash(seed, i, 8) ** 2 * 1.6,
		seed: hash(seed, i, 10),
	}));

export const Embers: React.FC<{specs: ParticleSpec[]; t: number; px?: number; opacity?: number; renderOrder?: number}> = ({specs, t, px = 9, opacity = 1, renderOrder = 900}) => (
	<Particles specs={specs} t={t} gravity={0.25} drag={0.4} colors={['#fff2c0', '#ff9a3c', '#a8300c']} opacity={opacity} px={px} swirl={0.22} renderOrder={renderOrder} />
);
