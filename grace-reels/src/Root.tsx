import React from 'react';
import {Composition} from 'remotion';
import {StyleTest} from '../episodes/fire-insurance/src/StyleTest';
import {FIRE_INSURANCE_FRAMES, FireInsurance} from '../episodes/fire-insurance/src/FireInsurance';
import {Cover} from '../episodes/fire-insurance/src/Cover';
import {StyleTest89} from '../episodes/angry-at-god/src/StyleTest89';
import {ANGRY_FRAMES, AngryAtGod} from '../episodes/angry-at-god/src/AngryAtGod';
import {Cover as AngryCover} from '../episodes/angry-at-god/src/Cover';
import {StyleTest97} from '../episodes/the-beginning/src/StyleTest97';
import {BEGINNING_FRAMES, TheBeginning} from '../episodes/the-beginning/src/TheBeginning';
import {Cover as BeginningCover} from '../episodes/the-beginning/src/Cover';
import {StyleTest121} from '../episodes/who-made-god/src/StyleTest121';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="FireInsurance" component={FireInsurance} width={1080} height={1920} fps={30} durationInFrames={FIRE_INSURANCE_FRAMES} />
    <Composition id="FireInsuranceCover" component={Cover} width={1080} height={1920} fps={30} durationInFrames={30} />
    <Composition id="StyleTest" component={StyleTest} width={1080} height={1920} fps={30} durationInFrames={60} />
    <Composition id="AngryAtGod" component={AngryAtGod} width={1080} height={1920} fps={30} durationInFrames={ANGRY_FRAMES} />
    <Composition id="AngryAtGodCover" component={AngryCover} width={1080} height={1920} fps={30} durationInFrames={30} />
    <Composition id="TheBeginning" component={TheBeginning} width={1080} height={1920} fps={30} durationInFrames={BEGINNING_FRAMES} />
    <Composition id="TheBeginningCover" component={BeginningCover} width={1080} height={1920} fps={30} durationInFrames={30} />
    <Composition id="StyleTest121" component={StyleTest121} width={1080} height={1920} fps={30} durationInFrames={60} />
    <Composition id="StyleTest97" component={StyleTest97} width={1080} height={1920} fps={30} durationInFrames={60} />
    <Composition id="StyleTest89" component={StyleTest89} width={1080} height={1920} fps={30} durationInFrames={60} />
  </>
);
