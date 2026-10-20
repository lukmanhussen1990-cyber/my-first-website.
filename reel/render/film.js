// The film: builds the world once, then renders any frame on demand.
import * as THREE from 'three';
import { createPost } from './post.js';
import { buildCar } from './car.js';
import { buildEarth } from './earth.js';
import { buildBackyard } from './backyard.js';
import { buildSky } from './sky.js';
import { buildDrill } from './gadgets.js';
import { makeEnvMaps } from './lib/envs.js';
import { LAYOUT } from './layout.js';
import { makeCarTrack, makeCameraTrack, carToWorld, TOURIST_LOCAL, farToWorld } from './director.js';
import { buildBeach } from './beach.js';
import { buildJohn, buildTourist } from './characters.js';
import { makeJohnActing, makeTouristActing } from './acting.js';
import { buildFX } from './fx.js';
import { makeLighting } from './lighting.js';
import { clamp, smoothstep, lerp, easeIn } from './lib/util.js';

const L = LAYOUT;

// Integrate a rate function from t0 to t (for spin angles); deterministic.
function integrate(rate, t0, t, step = 1 / 120) {
  if (t <= t0) return 0;
  let a = 0;
  for (let x = t0; x < t; x += step) a += rate(Math.min(t, x + step / 2)) * Math.min(step, t - x);
  return a;
}

export async function createFilm({ renderer, W, H, params }) {
  const TL = await (await fetch('/timeline.json')).json();
  const E = TL.events;
  // Word timings (for John's mouth), made absolute with the voice slot start.
  let words = {};
  try {
    const wj = await (await fetch('/build/words.json')).json();
    for (const [id, line] of Object.entries(wj.lines)) {
      const st = TL.voice[id]?.start ?? 0;
      words[id] = line.words.map((w) => ({ ...w, start: w.start + st, end: w.end + st }));
    }
  } catch (e) { words = {}; }
  const scene = new THREE.Scene();
  const envs = makeEnvMaps(renderer);
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 3000);
  const post = createPost(renderer, scene, camera, W, H);

  const sky = buildSky(scene);
  const earth = buildEarth(scene);
  const yard = buildBackyard(scene);
  const car = buildCar();
  const carRig = new THREE.Group();
  carRig.add(car.root);
  scene.add(carRig);
  const beach = buildBeach(scene);
  const john = buildJohn();
  john.root.position.set(-0.3, 0.47, -0.38);
  car.root.add(john.root);
  const tourist = buildTourist();
  tourist.root.position.copy(TOURIST_LOCAL);
  tourist.root.rotation.y = -0.32;
  beach.local.add(tourist.root);
  beach.local.add(tourist.splat);
  const fallingScoop = new THREE.Mesh(tourist.scoop.geometry, tourist.scoopMat);
  fallingScoop.castShadow = true; fallingScoop.visible = false; beach.local.add(fallingScoop);
  const johnAct = makeJohnActing(TL, words);
  const touristAct = makeTouristActing(TL);
  const drill = buildDrill();
  drill.group.position.set(2.2, 0.6, 0);
  car.root.add(drill.group);
  // The drill always reflects a bright studio so it reads as polished chrome.
  drill.group.traverse((o) => { if (o.isMesh) { o.material.envMap = envs.chrome; o.material.envMapIntensity = 1.0; } });

  // Lights.
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.0002; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  scene.add(key); scene.add(key.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
  scene.add(hemi);
  const lavaLight = new THREE.PointLight(0xff6a20, 0, 14, 1.6);
  scene.add(lavaLight);
  const rimLight = new THREE.DirectionalLight(0xffc690, 0); // low sunrise sun behind the beach
  scene.add(rimLight); scene.add(rimLight.target);
  const FAR_SUN = farToWorld(new THREE.Vector3(-0.18, 0.09, -0.98)).sub(farToWorld(new THREE.Vector3(0, 0, 0))).normalize();
  // Where the scoop leaves the cone (computed once from the pose at that moment).
  let scoopStart = null;
  const scoopStartAt = () => {
    if (scoopStart) return scoopStart;
    tourist.pose(touristAct(E.scoop_fall));
    beach.holder.updateMatrixWorld(true);
    const w = new THREE.Vector3(); tourist.scoop.getWorldPosition(w);
    scoopStart = beach.local.worldToLocal(w.clone());
    return scoopStart;
  };

  const carAt = makeCarTrack(TL);
  const fx = buildFX({ scene, car, carAt, TL, earth, post, beach });
  // the foil reflects a neutral studio so it reads as silver even in the lava glow
  fx.shieldMat.envMap = envs.chrome;
  const camAt = makeCameraTrack(TL);
  const lightAt = makeLighting(TL);

  const spinRate = (t) => {
    if (t < E.spin_start || t > E.spin_end + 0.4) return 0;
    return 38 * smoothstep(E.spin_start, E.spin_start + 0.3, t) * (1 - smoothstep(E.spin_end - 0.2, E.spin_end + 0.3, t));
  };
  const drillRate = (t) => {
    if (t < E.drill_spinup) return 0;
    const base = 26 * smoothstep(E.drill_spinup, E.drill_go, t);
    const stop = 1 - smoothstep(E.drill_stop - 0.6, E.drill_stop, t);
    return base * stop * (t > 35.6 && t < 37.6 ? 1.8 : 1);
  };

  return (frame) => {
    const t = params.get('t') ? +params.get('t') : frame / TL.fps;
    const st = carAt(t);
    carRig.position.copy(st.pos);
    carRig.quaternion.copy(st.quat);
    car.setWheelSpin(st.wheelAngle + integrate(spinRate, E.spin_start, Math.min(t, E.drill_go)));
    drill.group.visible = st.drillScale > 0.001;
    drill.group.scale.setScalar(Math.max(0.001, st.drillScale));
    drill.spin.rotation.x = -integrate(drillRate, E.drill_spinup, t, 1 / 60);

    // Earth: hole in the lawn, the pit, drilled tunnel.
    const holeOpen = t >= E.hole_open;
    yard.uniforms.uHoleR.value = holeOpen ? L.TUNNEL_R : 0;
    earth.uniforms.uHole.value = holeOpen ? 1 : 0;
    earth.uniforms.uTipS.value = t >= E.drill_snap ? Math.max(L.PIT_DEPTH + L.DRILL_LEN, st.s) : 0;
    earth.uniforms.uDrillLen.value = t >= E.drill_snap ? L.DRILL_LEN : 0;
    earth.uniforms.uTime.value = t;
    earth.bottom.visible = holeOpen && t < E.drill_snap + 0.3;
    // Turf plug drops into the pit and crumbles.
    const tu = clamp((t - E.hole_open) / (E.hole_done - E.hole_open));
    yard.turf.visible = holeOpen && tu < 1;
    yard.turf.position.set(0.1 * tu, -0.175 - (L.PIT_DEPTH - 0.4) * easeIn(tu), L.TUNNEL_Z);
    yard.turf.rotation.set(0.5 * tu, 0, 0.9 * tu);
    yard.turf.scale.setScalar(1 - 0.5 * tu);

    // Door swings up after landing.
    car.setDoorOpen(smoothstep(E.door_open, E.door_open + 0.6, t) * (1 + 0.06 * Math.sin(clamp((t - E.door_open - 0.6) * 6) * Math.PI)));
    // Characters.
    john.pose(johnAct(t));
    const tp = touristAct(t);
    tourist.pose(tp);
    if (t >= E.scoop_fall) {
      const s0 = scoopStartAt();
      tourist.pose(tp);
      tourist.scoop.visible = false;
      const u = clamp((t - E.scoop_fall) / (E.plop - E.scoop_fall));
      fallingScoop.visible = u < 1;
      fallingScoop.position.set(s0.x + 0.18 * u, lerp(s0.y, 0.07, u * u), s0.z + 0.1 * u);
      fallingScoop.rotation.set(u * 2.5, 0, u * 1.5);
      tourist.splat.visible = u >= 1;
      tourist.splat.position.set(s0.x + 0.18, 0.0, s0.z + 0.1);
      const sq = clamp((t - E.plop) / 0.25);
      tourist.splat.scale.set(1 + 0.25 * sq, 0.35 * (1 - 0.3 * sq) + 0.05 * Math.sin(sq * 9) * (1 - sq), 1 + 0.25 * sq);
    } else { tourist.scoop.visible = true; fallingScoop.visible = false; tourist.splat.visible = false; }
    // Beach sand: swells, then the car bursts out leaving a crater.
    beach.uniforms.uBulge.value = smoothstep(E.sand_bulge, E.burst, t) * (1 - smoothstep(E.burst, E.burst + 0.15, t));
    beach.uniforms.uCrater.value = t >= E.burst ? 1 : 0;
    yard.group.visible = t < 16;
    beach.holder.visible = t > 43;

    // Camera.
    const centre = carToWorld(st, new THREE.Vector3(0, 0.6, 0));
    const cam = camAt(t, centre, st.quat);
    camera.position.copy(cam.pos);
    camera.up.copy(cam.up);
    camera.lookAt(cam.target);
    camera.fov = cam.fov; camera.updateProjectionMatrix();
    // close-ups: calm the window reflections so John reads clearly
    const close = 1 - smoothstep(3.0, 6.0, cam.fh);
    car.mats.sideGlass.envMapIntensity = lerp(0.7, 0.28, close);
    car.mats.glass.envMapIntensity = lerp(1.4, 0.6, close);
    if (params.get('cam')) {
      const c = params.get('cam').split(',').map(Number);
      camera.position.set(c[0], c[1], c[2]); camera.up.set(0, 1, 0); camera.lookAt(c[3], c[4], c[5]);
    }

    // Lighting.
    const lt = lightAt(t);
    key.color.setRGB(lt.cr, lt.cg, lt.cb); key.intensity = lt.i;
    hemi.color.setRGB(lt.hsr, lt.hsg, lt.hsb); hemi.groundColor.setRGB(lt.hgr, lt.hgg, lt.hgb); hemi.intensity = lt.hi;
    const shadowSize = clamp(cam.fh * 0.75, 6, 24);
    const sc = t < 6 ? new THREE.Vector3(-1, 1, -6) : cam.target.clone();
    key.target.position.copy(sc);
    key.position.copy(sc).addScaledVector(lt.dir, 40);
    Object.assign(key.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: 90 });
    if (t < 6) Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22 });
    key.shadow.camera.updateProjectionMatrix();
    lavaLight.intensity = lt.lava * 9;
    lavaLight.position.copy(centre).add(new THREE.Vector3(2.2, 0, 4.5));
    scene.environment = envs[lt.env];
    earth.uniforms.uHeatBoost.value = clamp(lt.haze);
    post.bloom.threshold = lt.bloomT;
    post.grade.uniforms.uExposure.value = lt.exp;
    post.grade.uniforms.uSaturation.value = lt.sat;
    post.haze.uniforms.uTime.value = t;
    post.haze.uniforms.uStrength.value = lt.haze;
    post.haze.uniforms.uRegion.value.set(cam.hz, 0, 1.15, 0);
    post.grade.uniforms.uTime.value = t;

    // Sky: sunset above the backyard, sunrise above the beach.
    const far = t > E.flash;
    sky.uniforms.uMode.value = far ? 1 : 0;
    sky.uniforms.uUp.value.set(0, far ? -1 : 1, 0);
    sky.uniforms.uRight.value.set(far ? -1 : 1, 0, 0);
    sky.uniforms.uSunDir.value.copy(far ? FAR_SUN : new THREE.Vector3(-0.8, 0.2, 0.55).normalize());
    sky.uniforms.uTime.value = t;
    sky.update(camera);
    fx(t, st, camera, tourist.splat.visible ? tourist.splat.position : null);
    beach.waterUniforms.uTime.value = t;
    beach.waterUniforms.uCam.value.copy(camera.position);
    beach.waterUniforms.uSun.value.copy(FAR_SUN);
    const beachK = smoothstep(45.0, 46.2, t);
    rimLight.intensity = 2.2 * beachK;
    rimLight.target.position.copy(cam.target);
    rimLight.position.copy(cam.target).addScaledVector(FAR_SUN, 30);
    post.render();
  };
}
