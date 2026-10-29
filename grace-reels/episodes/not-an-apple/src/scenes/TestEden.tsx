import {useCurrentFrame} from 'remotion';
import {Stage, Cam, project} from '../three/Stage';
import {PostFX} from '../three/PostFX';
import {ContactShadow, EdenWorld, FgPlants, SUN_POS, snakeTrack, TRACK_BRANCH} from '../three/Eden';
import {Figure3D} from '../characters/Figure3D';
import {Snake3D} from '../characters/Snake3D';
import {SunGlow} from '../overlays/SunGlow';
import {FPS} from '../lib/time';

export const TestEden: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const cam: Cam = {pos: [0.2, 1.45, 5.3], target: [0.15, 2.05, 0.3], fov: 44};
  const sun = project(cam, SUN_POS);
  return (
    <div style={{width: 1080, height: 1920, background: '#000'}}>
      <Stage cam={cam}>
        <EdenWorld t={t} />
        <Figure3D kind="eve" t={t} position={[-0.75, 0, 0.95]} rotationY={1.05}
          pose={{armR: {sx: 1.35, sz: -0.1, elbow: 0.25}, head: {pitch: -0.2, yaw: 0.35}}} face={{smile: 0.5, brow: 0.3}} />
        <ContactShadow p={[-0.75, 0, 0.95]} />
        <Figure3D kind="adam" t={t} position={[-1.65, 0, 0.35]} rotationY={0.7} face={{smile: 0.35}} seed={3} />
        <ContactShadow p={[-1.65, 0, 0.35]} />
        <Snake3D track={snakeTrack} head={0.97} length={0.6} t={t} waveFrom={TRACK_BRANCH} open={0.2} tongue={1} />
        <FgPlants t={t} items={[{p: [-0.9, 0, 3.6], s: 1.3, flowers: ['#ffffff', '#E2453A', '#ffffff']}, {p: [1.4, 0, 3.9], s: 1.5, flowers: ['#E2453A', '#ffffff']}, {p: [0.4, -0.1, 4.2], s: 1.1}]} />
        <PostFX bloom={1.0} dof={{focus: 4.8, range: 2.2, bokeh: 6}} godRays={{position: SUN_POS, size: 13, color: '#FFF1C8'}} />
      </Stage>
      <SunGlow x={sun.x} y={sun.y} t={t} />
    </div>
  );
};

export const TestFace: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const f = useCurrentFrame();
  const cam: Cam = {pos: [-0.35, 1.5, 1.95], target: [-0.7, 1.45, 0.95], fov: 30};
  const faces = [{smile: 0.7, brow: 0.4}, {smile: 0.1, brow: 0.5, open: 0.3}, {smile: -0.4, brow: 0.2, furrow: 1}];
  return (
    <div style={{width: 1080, height: 1920, background: '#000'}}>
      <Stage cam={cam}>
        <EdenWorld t={t} />
        <Figure3D kind="eve" t={t} position={[-0.75, 0, 0.95]} rotationY={0.45} pose={{head: {pitch: -0.08, yaw: 0.25}}} face={faces[Math.floor(f / 20) % 3]} />
        <PostFX bloom={1.0} dof={{focus: 1.15, range: 0.6, bokeh: 6}} />
      </Stage>
    </div>
  );
};
