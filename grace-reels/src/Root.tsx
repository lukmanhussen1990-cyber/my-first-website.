import React from 'react';
import {Composition} from 'remotion';
import {StyleTest} from '../episodes/fire-insurance/src/StyleTest';
import {FIRE_INSURANCE_FRAMES, FireInsurance} from '../episodes/fire-insurance/src/FireInsurance';
import {Cover} from '../episodes/fire-insurance/src/Cover';
import {StyleTest89} from '../episodes/angry-at-god/src/StyleTest89';
import {ANGRY_FRAMES, AngryAtGod} from '../episodes/angry-at-god/src/AngryAtGod';
import {Cover as AngryCover} from '../episodes/angry-at-god/src/Cover';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="FireInsurance" component={FireInsurance} width={1080} height={1920} fps={30} durationInFrames={FIRE_INSURANCE_FRAMES} />
    <Composition id="FireInsuranceCover" component={Cover} width={1080} height={1920} fps={30} durationInFrames={30} />
    <Composition id="StyleTest" component={StyleTest} width={1080} height={1920} fps={30} durationInFrames={60} />
    <Composition id="AngryAtGod" component={AngryAtGod} width={1080} height={1920} fps={30} durationInFrames={ANGRY_FRAMES} />
    <Composition id="AngryAtGodCover" component={AngryCover} width={1080} height={1920} fps={30} durationInFrames={30} />
    <Composition id="StyleTest89" component={StyleTest89} width={1080} height={1920} fps={30} durationInFrames={60} />
  </>
);
