// Ready-made painted sets: each stacks baked layers at depths around the subject layer.
import React from 'react';
import { Layer } from '../core/Camera';
import { Baked, FocusBaked } from '../paint/Baked';
import { Sky, SkyLook } from '../gl/Sky';
import {
  EdenPalette, edenFar, edenMid, edenFruitTree, edenGround, edenForeground, edenHideLeaves, edenGrass,
  RoomTime, roomCity, roomWall, roomBed, GETH_SKY, gethFar, gethMid, gethNear, gethForeground, voidSky,
} from '../paint/sets';

type SetProps = { children?: React.ReactNode; front?: React.ReactNode };

export const EdenSet: React.FC<SetProps & { p: EdenPalette; name: string; fruitTree?: boolean; branchTip?: [number, number]; foreground?: number | false; hideLeaves?: boolean; grass?: number; grassDepth?: number }> = ({
  p, name, fruitTree = true, branchTip, foreground = 0, hideLeaves, grass, grassDepth = 1.06, children, front,
}) => (
  <>
    <Layer depth={0.04}><Sky look={p.sky} /></Layer>
    <Layer depth={0.2}><FocusBaked id={`eden-far-${name}`} paint={edenFar(p)} depth={0.2} res={0.5} /></Layer>
    <Layer depth={0.45}><FocusBaked id={`eden-mid-${name}`} paint={edenMid(p)} depth={0.45} res={0.6} /></Layer>
    {fruitTree && <Layer depth={0.75}><FocusBaked id={`eden-tree-${name}-${branchTip?.join('x')}`} paint={edenFruitTree(p, branchTip)} depth={0.75} res={0.75} /></Layer>}
    <Layer depth={0.85}><FocusBaked id={`eden-ground-${name}`} paint={edenGround(p)} depth={0.85} res={0.75} /></Layer>
    {children}
    {grass !== undefined && <Layer depth={grassDepth}><FocusBaked id={`eden-grass-${name}-${grass}`} paint={edenGrass(p, grass)} depth={grassDepth} res={0.6} /></Layer>}
    {hideLeaves && <Layer depth={1.12}><FocusBaked id={`eden-hide-${name}`} paint={edenHideLeaves(p)} depth={1.12} res={0.75} /></Layer>}
    {foreground !== false && (
      <Layer depth={1.35}><Baked id={`eden-fg-${name}-${foreground}`} paint={edenForeground(p, foreground)} res={0.5} blur={9} /></Layer>
    )}
    {front}
  </>
);

export const RoomSet: React.FC<SetProps & { time: RoomTime }> = ({ time, children, front }) => (
  <>
    <Layer depth={0.35}><FocusBaked id={`room-city-${time}`} paint={roomCity(time)} depth={0.35} res={0.6} /></Layer>
    <Layer depth={0.8}><FocusBaked id={`room-wall-${time}`} paint={roomWall(time)} depth={0.8} res={0.75} /></Layer>
    <Layer depth={1.0}><FocusBaked id={`room-bed-${time}`} paint={roomBed(time)} depth={1.0} res={0.75} /></Layer>
    {children}
    {front}
  </>
);

export const GethSet: React.FC<SetProps & { sky?: SkyLook; foreground?: boolean }> = ({ sky = GETH_SKY, foreground = true, children, front }) => (
  <>
    <Layer depth={0.04}><Sky look={sky} /></Layer>
    <Layer depth={0.2}><FocusBaked id="geth-far" paint={gethFar} depth={0.2} res={0.5} /></Layer>
    <Layer depth={0.5}><FocusBaked id="geth-mid" paint={gethMid} depth={0.5} res={0.6} /></Layer>
    <Layer depth={0.85}><FocusBaked id="geth-near" paint={gethNear} depth={0.85} res={0.75} /></Layer>
    {children}
    {foreground && <Layer depth={1.35}><Baked id="geth-fg" paint={gethForeground} res={0.5} blur={8} /></Layer>}
    {front}
  </>
);

export const VoidSet: React.FC<SetProps & { look?: SkyLook }> = ({ look = voidSky, children, front }) => (
  <>
    <Layer depth={0.04}><Sky look={look} /></Layer>
    {children}
    {front}
  </>
);
