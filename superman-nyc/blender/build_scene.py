"""Assemble the whole film set into one .blend.

Run:  blender -b --factory-startup -P build_scene.py -- OUT.blend [--no-fx]
"""
import bpy
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import timeline as TL  # noqa: E402
import city  # noqa: E402
import tower  # noqa: E402
import props  # noqa: E402
import vehicles  # noqa: E402
import people  # noqa: E402
import crowd  # noqa: E402
import cameras  # noqa: E402
import superman  # noqa: E402
import cyclist  # noqa: E402


def coll(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def append_superman(path="/opt/work/assets/superman.blend"):
    with bpy.data.libraries.load(path, link=False) as (df, dt):
        dt.collections = [c for c in df.collections if c == "Superman"]
        # the cape mesh is created here (attach_cape), so its material has no user in that collection
        dt.materials = [m for m in df.materials if m == "SM_Cape"]
    for c in dt.collections:
        bpy.context.scene.collection.children.link(c)
    return dt.collections[0]


def render_settings(sc):
    sc.render.engine = 'CYCLES'
    sc.render.fps = TL.FPS
    sc.frame_start, sc.frame_end = 0, TL.N_FRAMES - 1
    c = sc.cycles
    c.device = 'CPU'
    c.samples = 3
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.03
    c.adaptive_min_samples = 4
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.denoising_quality = 'BALANCED'
    c.max_bounces = 4
    c.diffuse_bounces = 1
    c.glossy_bounces = 1
    c.transmission_bounces = 2
    c.transparent_max_bounces = 4
    c.volume_bounces = 0
    c.use_light_tree = False
    c.blur_glossy = 1.0
    c.sample_clamp_indirect = 6.0
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.volume_step_rate = 4.0
    c.volume_max_steps = 96
    sc.render.use_persistent_data = True
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.45
    sc.render.resolution_x, sc.render.resolution_y = 720, 1280
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'None'
    sc.render.film_transparent = False
    vl = sc.view_layers[0]
    vl.use_pass_z = True
    for m in bpy.data.materials:
        m.cycles.emission_sampling = 'NONE'


def main(out, fx=True):
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = "Scene"
    M = city.make_materials()
    city.extra_materials(M)
    vehicles.vehicle_materials(M)
    c_city = coll("City")
    city.build_streets(c_city, M)
    city.build_buildings(c_city, M)
    tw, panels, slabs, mulls = tower.build_tower(c_city, M)
    c_props = coll("Props")
    P = props.build_props(c_props, M)
    import random
    movers = props.movable_props(c_props, M, random.Random(5))
    c_veh = coll("Vehicles")
    V = vehicles.build_traffic(c_veh, M)
    print("set built", round(time.time() - t0, 1), "s", flush=True)
    lib = people.load_library()
    c_crowd = coll("Crowd")
    cyclist.build(lib, coll("Cyclist"))            # before the crowd: posing it is slow in a full scene
    rigs, plans = crowd.build_crowd(lib, c_crowd)
    print("crowd built", round(time.time() - t0, 1), "s", flush=True)
    sm = append_superman()
    superman.attach_cape(collection=sm)
    c_cam = coll("Cameras")
    cams = cameras.build_cameras(c_cam)
    sc.camera = cams["CamPhone"]
    crowd.cull(rigs, plans, cameras.phone_track())
    for o in c_crowd.all_objects:
        if o.type == 'MESH':
            o.cycles.use_deform_motion = False
    city.setup_world(sc)
    if fx:
        import fx as FX
        FX.build_all(sc, M, panels, slabs, mulls, P, movers, V)
    else:
        # intact damage-band panels so the tower looks complete
        mb = city.MB()
        for p in panels:
            F = city.Facade(p["o"], (p["o"][0] + p["d"][0], p["o"][1] + p["d"][1]))
            F.quad(mb, p["u0"], p["u1"], p["z0"], p["z1"], 0.0, "glass_tower",
                   uv=[(p["u0"], p["z0"] - p["zf0"]), (p["u1"], p["z0"] - p["zf0"]),
                       (p["u1"], p["z1"] - p["zf0"]), (p["u0"], p["z1"] - p["zf0"])])
        ob = mb.build("TowerPanelsIntact", c_city, M)
        ob["cell_w"], ob["cell_h"] = 1.5, 4.0
    render_settings(sc)
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=False)
    print("SCENE saved", out, round(time.time() - t0, 1), "s", "objects", len(bpy.data.objects), flush=True)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "/opt/work/scene.blend"
    main(out, fx=("--no-fx" not in argv))
