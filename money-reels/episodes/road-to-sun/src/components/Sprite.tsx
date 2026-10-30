import React from 'react';
import {Img} from 'remotion';
import sprites from '../data/sprites.json';
import {img} from '../lib/anim';

type Meta = {w: number; h: number; bbox: number[]};
const META = sprites as Record<string, Meta>;

export type SpriteProps = {
  name: string;
  /** Screen position of the anchor point. */
  x: number;
  y: number;
  /** Displayed height of the figure's bounding box in px. */
  h: number;
  /** Anchor inside the bounding box, as fractions (0.5, 1 = bottom centre). */
  anchor?: [number, number];
  rot?: number;
  sx?: number;
  sy?: number;
  opacity?: number;
  flip?: boolean;
  filter?: string;
  style?: React.CSSProperties;
};

export const spriteMeta = (name: string) => META[name];

export const Sprite: React.FC<SpriteProps> = ({
  name, x, y, h, anchor = [0.5, 1], rot = 0, sx = 1, sy = 1, opacity = 1, flip = false, filter, style,
}) => {
  const m = META[name];
  if (!m || h <= 0 || opacity <= 0) return null;
  const [x0, y0, x1, y1] = m.bbox;
  const s = h / (y1 - y0);
  const ax = (x0 + (x1 - x0) * anchor[0]) * s;
  const ay = (y0 + (y1 - y0) * anchor[1]) * s;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `rotate(${rot}deg) scale(${(flip ? -1 : 1) * sx}, ${sy})`,
        transformOrigin: '0 0',
        opacity,
        filter,
        ...style,
      }}
    >
      <Img
        src={img(name)}
        style={{position: 'absolute', left: -ax, top: -ay, width: m.w * s, height: m.h * s, maxWidth: 'none'}}
      />
    </div>
  );
};
