// Singapore reel: where everything is. Meters, +Y up.
// The street runs along -Z. Wide shiny sidewalk/plaza on the left (x < 0.6), road x in [0.6, 8.6], sidewalk right.
// YOU stands on the left sidewalk near the origin, facing +Z. Far away in the same world: a public toilet room
// and the airport runway (the receipt rolls all the way there).

export const STREET = {
  walkMinX: -7.0, walkMaxX: 0.6,     // left sidewalk / plaza (shiny tiles)
  roadMinX: 0.6, roadMaxX: 8.6,      // road
  walk2MinX: 8.6, walk2MaxX: 13.0,   // right sidewalk
  minZ: -410, maxZ: 40,              // street length (buildings along it)
  curb: 0.12,                        // sidewalks are 12 cm above the road
};

// people (feet position [x, z], facing rotY: 0 = +Z)
export const SPOTS = {
  you:     { pos: [-2.0, 0.0],  rotY: 0 },
  poop:    { pos: [-1.62, 0.32] },
  officer: { pos: [-1.05, 0.95], rotY: -2.35 },      // stops in front-right of YOU, facing him and the poop
  officerStart: { pos: [0.373, 2.355], rotY: -2.35 },  // 2 m behind his spot along his facing: walks straight at YOU (16.55-17.9)
  man:     { pos: [-0.2, 4.6],  rotY: -2.6 },
  lady:    { pos: [-4.6, 3.6],  rotY: 2.4 },
  kid:     { pos: [-4.0, -2.4], rotY: 1.0 },
  robot:   { pos: [-3.2, 1.6] },
  sign:    { pos: [-5.6, -1.2] },                     // red no-littering sign on a pole
  extras: [ [-3.5, 5.7, 2.9], [-2.2, 6.4, 3.14], [-1.0, 5.6, -2.9], [-6.0, -5.0, 1.2], [0.0, -4.5, -0.5] ], // [x, z, rotY]
};

// far-away sets in the same world
export const TOILET = { x: 300, z: 0 };          // public toilet room (floor at y=0, room interior around this point)
export const AIRPORT = { z: -440, planeX: 6 };   // runway across the end of the street

export const EYE = { you: 1.62, officer: 1.82, man: 1.7, lady: 1.56, kid: 1.05 };

// Video
export const FPS = 30;
export const DURATION = 46.0;
export const W = 1080, H = 1920;
