import { PerformanceMonitor } from '@react-three/drei';
import { useUi } from '../state/ui';
import { CameraRig } from './CameraRig';
import { PostFX } from './effects/PostFX';
import { Dust } from './environment/Dust';
import { Studio, StudioEnvironment } from './environment/Studio';
import { Interaction } from './Interaction';
import { forcedTier, QUALITY, TIERS } from './quality';
import { Torch } from './torch/Torch';

/** Steps the quality tier from measured frame rate (with flip-flop protection). */
function AdaptiveQuality() {
  const step = (dir: 1 | -1) => {
    const ui = useUi.getState();
    const i = TIERS.indexOf(ui.quality);
    const next = TIERS[Math.max(0, Math.min(TIERS.length - 1, i + dir))];
    if (next !== ui.quality) ui.setQuality(next);
  };
  return (
    <PerformanceMonitor
      ms={400}
      iterations={8}
      flipflops={3}
      bounds={(refresh) => (refresh > 90 ? [55, 100] : [42, 60])}
      onDecline={() => step(-1)}
      onIncline={() => step(1)}
      onFallback={() => useUi.getState().setQuality('low')}
    />
  );
}

export function Experience() {
  const tier = useUi((s) => s.quality);
  const q = QUALITY[tier];
  return (
    <>
      <color attach="background" args={['#000000']} />
      <fogExp2 attach="fog" args={['#000000', 0.04]} />
      <StudioEnvironment />
      <Studio />
      <Torch shadowMapSize={q.shadowMapSize} />
      <Dust count={q.dust} />
      <CameraRig />
      <Interaction />
      <PostFX msaa={q.msaa} beamSteps={q.beamSteps} />
      {!forcedTier() && <AdaptiveQuality />}
    </>
  );
}
