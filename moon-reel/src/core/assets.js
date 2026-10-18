import * as THREE from 'three';

export async function loadAssets(renderer) {
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const load = async (name, srgb) => {
    const t = await loader.loadAsync(`/public/tex/${name}`);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  const [earthDay, earthLights, earthClouds, earthWater, earthNormal, moonColor, moonNormal] = await Promise.all([
    load('earth_day.jpg', true),
    load('earth_lights.jpg', false),
    load('earth_clouds.jpg', false),
    load('earth_water.png', false),
    load('earth_normal.jpg', false),
    load('moon_color.jpg', true),
    load('moon_normal.jpg', false),
  ]);

  const fonts = [
    ['montserrat-latin-900-normal.woff2', '900'],
    ['montserrat-latin-800-normal.woff2', '800'],
    ['montserrat-latin-700-normal.woff2', '700'],
  ];
  for (const [file, weight] of fonts) {
    const f = new FontFace('Montserrat', `url(/public/fonts/${file})`, { weight });
    await f.load();
    document.fonts.add(f);
  }

  const events = await (await fetch('/src/events.json')).json();
  return {
    tex: { earthDay, earthLights, earthClouds, earthWater, earthNormal, moonColor, moonNormal },
    timing: events,
  };
}
