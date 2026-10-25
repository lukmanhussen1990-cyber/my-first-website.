import { Composition, Still } from "remotion";
import { Bench } from "./dev/Bench";
import { KeyFrames, KEY_TIMES } from "./dev/KeyFrames";
import { PeopleTest } from "./dev/PeopleTest";
import { LookDev, LOOKS, SceneTest } from "./dev/SceneTest";
import { Cover } from "./episodes/the-mountain/Cover";
import { TheMountain } from "./episodes/the-mountain/TheMountain";
import { TIMELINE } from "./episodes/the-mountain/timing";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="TheMountain" component={TheMountain} durationInFrames={TIMELINE.durationInFrames} fps={30} width={1080} height={1920} />
      <Still id="CoverTheMountain" component={Cover} width={1080} height={1920} />
      <Composition id="KeyFrames" component={KeyFrames} durationInFrames={KEY_TIMES.length} fps={30} width={1080} height={1920} />
      <Composition id="SceneTest" component={SceneTest} durationInFrames={900} fps={30} width={1080} height={1920} defaultProps={{ scene: "S1", offset: 0 }} />
      <Composition id="LookDev" component={LookDev} durationInFrames={LOOKS.length} fps={30} width={1080} height={1920} />
      <Composition id="Bench" component={Bench} durationInFrames={60} fps={30} width={1080} height={1920} />
      <Composition id="PeopleTest" component={PeopleTest} durationInFrames={60} fps={30} width={1080} height={1920} />
    </>
  );
};
