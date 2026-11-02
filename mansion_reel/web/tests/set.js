// set preview: ?test=set   t = view index
const VIEWS = [
  { loc: 'street', pos: [-1.6, 1.5, -4.6], target: [-1.8, 1.0, 0], fov: 50, sc: [-2, 0, -0.5] },
  { loc: 'street', pos: [1.2, 1.7, -6.5], target: [8, 1.6, 0], fov: 50, sc: [6, 0, -0.5] },
  { loc: 'ext', pos: [0, 8, 58], target: [0, 7, 100], fov: 50, sc: [0, 1, 96] },
  { loc: 'ext', pos: [1.5, 2.6, 93.5], target: [0, 3.5, 100], fov: 50, sc: [0, 1.2, 98] },
  { loc: 'in', pos: [0, 2.9, 101.2], target: [0, 2.8, 140], fov: 50, sc: [0, 1.2, 104], interior: true },
  { loc: 'in', pos: [0, 3.2, 183.2], target: [0, 1.9, 190], fov: 55, sc: [0, 1.2, 189], interior: true },
  { loc: 'in', pos: [3.0, 2.5, 112.3], target: [7.6, 1.5, 112], fov: 55, sc: [6, 1.2, 112], interior: true, door: 1 },
  { loc: 'zoo', pos: [599.6, 1.55, -5.8], target: [600.0, 1.6, 2.0], fov: 45, sc: [599.5, 0, 0.5] },
  { loc: 'zoo', pos: [600, 70, -95], target: [606, 60, 160], fov: 55, sc: [600, 0, 0] },
];
export function update(ctx) {
  const v = VIEWS[Math.min(VIEWS.length - 1, Math.floor(ctx.t))];
  const s = ctx.W.set.state;
  s.loc = v.loc; s.interior = !!v.interior; s.shadow = { center: v.sc, radius: 14 };
  if (v.door) s.yourDoor = 1;
  if (v.loc === 'ext') s.frontDoor = 0;
  ctx.cam.set({ pos: v.pos, target: v.target, fov: v.fov });
}
