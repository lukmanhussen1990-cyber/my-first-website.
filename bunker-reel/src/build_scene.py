"""Procedural Blender scene for the "secret bunker under the living room" reel.

Run with the bpy module:  python build_scene.py [timeline.json] [out.blend]
Everything (room, ground layers, bunker, animation, lights, camera) is built
from code so the shot can be re-rendered deterministically.
"""
import bpy, bmesh, math, random, json, os, sys
from mathutils import Vector, Euler
from bpy_extras import anim_utils

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith('-')]
TL_PATH = args[0] if len(args) > 0 else os.path.join(HERE, 'timeline.json')
OUT_BLEND = args[1] if len(args) > 1 else os.path.join(HERE, 'bunker.blend')

FPS = 30
random.seed(11)

# ---------------------------------------------------------------- timeline
# Event times in seconds. Overridden by timeline.json (derived from the
# voiceover word timings) so the visuals land on the spoken words.
T = dict(
    rug_off=6.4, rug_off_end=8.0, outline=8.6, outline_end=9.5,
    planks=9.9, planks_end=12.0, ply=12.0, ply_end=12.8,
    crack=13.4, crack_end=15.2, arrows=13.3, chunks=15.6, chunks_end=19.0,
    gravel=20.2, dig1=21.0, clank=22.2, reroute=23.0, reroute_end=24.4,
    dig2=24.4, dig3=26.4, dig_end=27.6,
    rebar=28.2, rebar_end=30.4, pour_floor=30.4, pour_walls=31.0, pour_roof=32.6,
    thud=33.6, vent=33.9, vent_end=35.5,
    lights=36.2, beds=37.0, lights2=37.6, food=38.2, water=38.9, table=39.6,
    radio=40.0, firstaid=40.4, ladder=40.9, hatch_appear=41.6,
    hatch_close=44.3, hatch_slam=45.2, floor_back=45.6, floor_back_end=48.4,
    rug_back=48.9, rug_back_end=50.9,
    pullback=52.0, pullback_end=58.2,
)
if os.path.exists(TL_PATH):
    T.update(json.load(open(TL_PATH)))


def F(t):
    return int(round(t * FPS)) + 1


# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, 1800
scene.render.fps = FPS
prefs = bpy.context.preferences.edit
COL = scene.collection


def set_interp(kind):
    prefs.keyframe_new_interpolation_type = kind


def set_key_interp(idb, data_path, frame, interp):
    """keyframe_new_interpolation_type is ignored in background mode, so set
    the interpolation on the inserted keys directly."""
    ad = idb.animation_data
    cb = anim_utils.animdata_get_channelbag_for_assigned_slot(ad) if ad else None
    if not cb:
        return
    for fc in cb.fcurves:
        if fc.data_path == data_path:
            for kp in fc.keyframe_points:
                if abs(kp.co[0] - frame) < 0.5:
                    kp.interpolation = interp


def key(idb, path, frame, value, index=-1, interp='BEZIER'):
    setattr(idb, path, value)
    idb.keyframe_insert(data_path=path, frame=frame, index=index)
    if interp != 'BEZIER':
        set_key_interp(idb, path, frame, interp)


def key_socket(sock, frame, value, interp='BEZIER'):
    sock.default_value = value
    sock.keyframe_insert('default_value', frame=frame)
    if interp != 'BEZIER':
        set_key_interp(sock.id_data, sock.path_from_id('default_value'), frame, interp)


# ---------------------------------------------------------------- materials
def L(c):
    """Colours below are written as sRGB (picked by eye); Blender wants linear."""
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m, nt, bsdf


def basic(name, color, rough=0.5, metal=0.0, emit=None, estr=0.0, sheen=0.0,
          transmission=0.0, alpha=1.0, coat=0.0):
    m, nt, b = new_mat(name)
    b.inputs['Base Color'].default_value = (*L(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if sheen:
        b.inputs['Sheen Weight'].default_value = sheen
    if transmission:
        b.inputs['Transmission Weight'].default_value = transmission
    if coat:
        b.inputs['Coat Weight'].default_value = coat
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*L(emit), 1)
        b.inputs['Emission Strength'].default_value = estr
    return m


def coord_node(nt, mode):
    """'world' = world position, 'rest' = object space + rest offset, so pieces
    that move keep their texture and match their neighbours at rest."""
    if mode == 'world':
        g = nt.nodes.new('ShaderNodeNewGeometry')
        return g.outputs['Position']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    at = nt.nodes.new('ShaderNodeAttribute')
    at.attribute_type = 'OBJECT'
    at.attribute_name = 'rest'
    add = nt.nodes.new('ShaderNodeVectorMath')
    add.operation = 'ADD'
    nt.links.new(tc.outputs['Object'], add.inputs[0])
    nt.links.new(at.outputs['Vector'], add.inputs[1])
    return add.outputs['Vector']


def ramp_mix(nt, fac, c1, c2):
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    nt.links.new(fac, mx.inputs['Factor'])
    mx.inputs['A'].default_value = (*L(c1), 1)
    mx.inputs['B'].default_value = (*L(c2), 1)
    return mx.outputs['Result']


def noise(nt, vec, scale, detail=4.0, rough=0.55, dist=0.0):
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    n.inputs['Distortion'].default_value = dist
    nt.links.new(vec, n.inputs['Vector'])
    return n


def bump(nt, b, height, strength, distance=0.02):
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = distance
    nt.links.new(height, bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return bp


def mat_noisy(name, c1, c2, scale, rough=0.8, bstr=0.2, mode='world', detail=4.0,
              metal=0.0):
    m, nt, b = new_mat(name)
    v = coord_node(nt, mode)
    n = noise(nt, v, scale, detail)
    b.inputs['Base Color'].default_value = (*L(c1), 1)
    nt.links.new(ramp_mix(nt, n.outputs['Fac'], c1, c2), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    n2 = noise(nt, v, scale * 6, 3)
    bump(nt, b, n2.outputs['Fac'], bstr)
    return m


def mat_floor():
    m, nt, b = new_mat('floor_wood')
    v = coord_node(nt, 'rest')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(v, sep.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(sep.outputs['Y'], comb.inputs['X'])   # plank length along Y
    nt.links.new(sep.outputs['X'], comb.inputs['Y'])   # rows across X
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset, br.offset_frequency = 0.37, 1
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = 1.45
    br.inputs['Row Height'].default_value = 0.2
    br.inputs['Mortar Size'].default_value = 0.0045
    br.inputs['Mortar Smooth'].default_value = 0.2
    br.inputs['Bias'].default_value = 0.0
    br.inputs['Color1'].default_value = (*L((0.80, 0.60, 0.40)), 1)
    br.inputs['Color2'].default_value = (*L((0.71, 0.51, 0.31)), 1)
    br.inputs['Mortar'].default_value = (*L((0.35, 0.22, 0.13)), 1)
    nt.links.new(comb.outputs[0], br.inputs['Vector'])
    # wood grain stretched along the plank
    sc = nt.nodes.new('ShaderNodeVectorMath')
    sc.operation = 'MULTIPLY'
    sc.inputs[1].default_value = (1.0, 0.06, 1.0)
    nt.links.new(comb.outputs[0], sc.inputs[0])
    gr = noise(nt, sc.outputs[0], 18.0, 6, 0.6, 1.5)
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 0.35
    nt.links.new(br.outputs['Color'], mul.inputs['A'])
    nt.links.new(gr.outputs['Color'], mul.inputs['B'])
    nt.links.new(mul.outputs['Result'], b.inputs['Base Color'])
    inv = nt.nodes.new('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    nt.links.new(br.outputs['Fac'], inv.inputs[1])
    bump(nt, b, inv.outputs[0], 0.5, 0.004)
    b.inputs['Roughness'].default_value = 0.42
    b.inputs['Coat Weight'].default_value = 0.15
    return m


def mat_plywood():
    m, nt, b = new_mat('plywood')
    v = coord_node(nt, 'rest')
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = 'Z'
    w.inputs['Scale'].default_value = 1.0
    w.inputs['Distortion'].default_value = 1.0
    sc = nt.nodes.new('ShaderNodeVectorMath')
    sc.operation = 'MULTIPLY'
    sc.inputs[1].default_value = (1.0, 1.0, 22.0)
    nt.links.new(v, sc.inputs[0])
    nt.links.new(sc.outputs[0], w.inputs['Vector'])
    nt.links.new(ramp_mix(nt, w.outputs['Fac'], (0.85, 0.71, 0.50), (0.75, 0.59, 0.38)),
                 b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.7
    return m


def mat_gravel():
    m, nt, b = new_mat('gravel')
    v = coord_node(nt, 'world')
    vo = nt.nodes.new('ShaderNodeTexVoronoi')
    vo.inputs['Scale'].default_value = 22.0
    nt.links.new(v, vo.inputs['Vector'])
    n = noise(nt, v, 30, 2)
    c = ramp_mix(nt, vo.outputs['Color'], (0.45, 0.43, 0.40), (0.68, 0.65, 0.60))
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    mx.blend_type = 'MULTIPLY'
    mx.inputs['Factor'].default_value = 0.3
    nt.links.new(c, mx.inputs['A'])
    nt.links.new(n.outputs['Color'], mx.inputs['B'])
    nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])
    inv = nt.nodes.new('ShaderNodeMath')
    inv.operation = 'POWER'
    inv.inputs[1].default_value = 0.5
    nt.links.new(vo.outputs['Distance'], inv.inputs[0])
    neg = nt.nodes.new('ShaderNodeMath')
    neg.operation = 'SUBTRACT'
    neg.inputs[0].default_value = 1.0
    nt.links.new(inv.outputs[0], neg.inputs[1])
    bump(nt, b, neg.outputs[0], 0.9, 0.03)
    b.inputs['Roughness'].default_value = 0.75
    return m


def mat_soil(name, c1, c2, c3, scale, bstr):
    m, nt, b = new_mat(name)
    v = coord_node(nt, 'world')
    n = noise(nt, v, scale, 6, 0.6, 0.4)
    vo = nt.nodes.new('ShaderNodeTexVoronoi')
    vo.inputs['Scale'].default_value = scale * 3.2
    nt.links.new(v, vo.inputs['Vector'])
    c = ramp_mix(nt, n.outputs['Fac'], c1, c2)
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    nt.links.new(c, mx.inputs['A'])
    mx.inputs['B'].default_value = (*L(c3), 1)
    gt = nt.nodes.new('ShaderNodeMath')
    gt.operation = 'GREATER_THAN'
    gt.inputs[1].default_value = 0.86
    n3 = noise(nt, v, scale * 2.5, 2)
    nt.links.new(n3.outputs['Fac'], gt.inputs[0])
    nt.links.new(gt.outputs[0], mx.inputs['Factor'])
    crev = nt.nodes.new('ShaderNodeMapRange')
    crev.inputs['From Min'].default_value = 0.25
    crev.inputs['From Max'].default_value = 0.95
    crev.inputs['To Min'].default_value = 1.0
    crev.inputs['To Max'].default_value = 0.45
    nt.links.new(vo.outputs['Distance'], crev.inputs['Value'])
    dk = nt.nodes.new('ShaderNodeMix')
    dk.data_type = 'RGBA'
    dk.blend_type = 'MULTIPLY'
    dk.inputs['Factor'].default_value = 1.0
    nt.links.new(mx.outputs['Result'], dk.inputs['A'])
    nt.links.new(crev.outputs['Result'], dk.inputs['B'])
    nt.links.new(dk.outputs['Result'], b.inputs['Base Color'])
    h = nt.nodes.new('ShaderNodeMath')
    h.operation = 'ADD'
    nt.links.new(vo.outputs['Distance'], h.inputs[0])
    n2 = noise(nt, v, scale * 9, 4)
    nt.links.new(n2.outputs['Fac'], h.inputs[1])
    bump(nt, b, h.outputs[0], bstr, 0.05)
    b.inputs['Roughness'].default_value = 0.95
    return m


def mat_concrete(name, c1, c2, mode='rest'):
    m, nt, b = new_mat(name)
    v = coord_node(nt, mode)
    n = noise(nt, v, 6, 6)
    nt.links.new(ramp_mix(nt, n.outputs['Fac'], c1, c2), b.inputs['Base Color'])
    n2 = noise(nt, v, 60, 3)
    bump(nt, b, n2.outputs['Fac'], 0.25, 0.01)
    b.inputs['Roughness'].default_value = 0.88
    return m


def mat_wall():
    m, nt, b = new_mat('wall_beige')
    v = coord_node(nt, 'world')
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = 'X'
    w.wave_profile = 'SAW'
    w.inputs['Scale'].default_value = 0.0
    sc = nt.nodes.new('ShaderNodeVectorMath')
    sc.operation = 'MULTIPLY'
    sc.inputs[1].default_value = (2.2, 2.2, 0.0)
    nt.links.new(v, sc.inputs[0])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(sc.outputs[0], sep.inputs[0])
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'ADD'
    nt.links.new(sep.outputs['X'], add.inputs[0])
    nt.links.new(sep.outputs['Y'], add.inputs[1])
    fr = nt.nodes.new('ShaderNodeMath')
    fr.operation = 'FRACT'
    nt.links.new(add.outputs[0], fr.inputs[0])
    gt = nt.nodes.new('ShaderNodeMath')
    gt.operation = 'GREATER_THAN'
    gt.inputs[1].default_value = 0.985
    nt.links.new(fr.outputs[0], gt.inputs[0])
    nt.links.new(ramp_mix(nt, gt.outputs[0], (0.85, 0.75, 0.62), (0.74, 0.64, 0.51)),
                 b.inputs['Base Color'])
    bump(nt, b, gt.outputs[0], 0.25, 0.01)
    b.inputs['Roughness'].default_value = 0.85
    return m


def mat_sky():
    m = bpy.data.materials.new('sky')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    g = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(g.outputs['Position'], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.5
    mr.inputs['From Max'].default_value = 3.0
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    c = ramp_mix(nt, mr.outputs['Result'], (0.95, 0.97, 1.0), (0.45, 0.68, 0.95))
    nt.links.new(c, em.inputs['Color'])
    em.inputs['Strength'].default_value = 2.2
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


M = {}
M['wall'] = mat_wall()
M['cut'] = basic('cut_dark', (0.17, 0.17, 0.19), 0.8)
M['ceiling'] = basic('ceiling', (0.60, 0.63, 0.70), 0.9)
M['white'] = basic('trim_white', (0.93, 0.92, 0.89), 0.5)
M['floor'] = mat_floor()
M['ply'] = mat_plywood()
M['concrete'] = mat_concrete('slab_concrete', (0.52, 0.52, 0.53), (0.63, 0.63, 0.63))
M['gravel'] = mat_gravel()
M['soil'] = mat_soil('soil', (0.56, 0.30, 0.14), (0.68, 0.39, 0.19), (0.38, 0.19, 0.08), 3.0, 1.0)
M['clay'] = mat_soil('clay', (0.36, 0.19, 0.12), (0.44, 0.24, 0.15), (0.26, 0.13, 0.07), 2.0, 0.5)
M['rock'] = mat_noisy('rock', (0.46, 0.42, 0.37), (0.60, 0.56, 0.50), 8, 0.7, 0.4)
M['copper'] = basic('copper', (0.92, 0.56, 0.38), 0.3, 1.0)
M['copper_warn'] = basic('copper_warn', (0.92, 0.56, 0.38), 0.3, 1.0, emit=(1.0, 0.15, 0.08), estr=0.0)
M['rug'] = mat_noisy('rug_grey', (0.53, 0.54, 0.56), (0.59, 0.60, 0.62), 40, 1.0, 0.35, 'world', 3)
M['rug'].node_tree.nodes['Principled BSDF'].inputs['Sheen Weight'].default_value = 0.6
M['teal'] = basic('sofa_teal', (0.11, 0.60, 0.60), 0.8, sheen=0.5)
M['yellow'] = basic('cushion_yellow', (0.96, 0.76, 0.20), 0.8, sheen=0.4)
M['pink'] = basic('cushion_pink', (0.95, 0.60, 0.66), 0.8, sheen=0.4)
M['peach'] = basic('paint_peach', (0.96, 0.79, 0.60), 0.7)
M['paint_pink'] = basic('paint_pink', (0.92, 0.54, 0.63), 0.7)
M['paint_white'] = basic('paint_white', (0.94, 0.94, 0.92), 0.7)
M['paint_blue'] = basic('paint_blue', (0.37, 0.71, 0.91), 0.7)
M['black'] = basic('lamp_black', (0.09, 0.09, 0.09), 0.35, 0.6)
M['shade'] = basic('lamp_shade', (1.0, 0.96, 0.88), 0.6, emit=(1.0, 0.82, 0.55), estr=2.5)
M['pot'] = basic('terracotta', (0.75, 0.40, 0.23), 0.7)
M['leaf'] = basic('leaf', (0.18, 0.49, 0.20), 0.55, sheen=0.2)
M['wood_dark'] = mat_noisy('table_wood', (0.54, 0.35, 0.19), (0.61, 0.41, 0.24), 12, 0.45, 0.05, 'rest')
M['book'] = basic('book_blue', (0.24, 0.42, 0.75), 0.6)
M['sky'] = mat_sky()
M['trunk'] = basic('trunk', (0.40, 0.27, 0.17), 0.9)
M['foliage'] = mat_noisy('foliage', (0.22, 0.50, 0.20), (0.32, 0.62, 0.26), 6, 0.8, 0.5)
M['grass'] = mat_noisy('grass', (0.31, 0.60, 0.20), (0.39, 0.69, 0.25), 20, 0.9, 0.6)
M['ext_wall'] = basic('exterior_wall', (0.90, 0.88, 0.83), 0.8)
M['steel'] = basic('steel', (0.56, 0.58, 0.61), 0.35, 0.85)
M['steel_dark'] = basic('steel_dark', (0.29, 0.31, 0.33), 0.45, 0.8)
M['rebar'] = basic('rebar', (0.62, 0.36, 0.22), 0.55, 0.35)
M['vent'] = basic('vent_metal', (0.80, 0.82, 0.84), 0.3, 0.9)
M['mattress'] = basic('mattress', (0.49, 0.54, 0.33), 0.85, sheen=0.3)
M['blanket'] = basic('blanket', (0.69, 0.29, 0.23), 0.85, sheen=0.3)
M['pillow'] = basic('pillow', (0.93, 0.92, 0.88), 0.85, sheen=0.3)
M['can_red'] = basic('can_red', (0.83, 0.23, 0.16), 0.35, 0.3)
M['can_green'] = basic('can_green', (0.25, 0.60, 0.29), 0.35, 0.3)
M['can_yellow'] = basic('can_yellow', (0.91, 0.72, 0.19), 0.35, 0.3)
M['bottle'] = basic('bottle_blue', (0.55, 0.78, 1.0), 0.08, transmission=0.85)
M['cap'] = basic('bottle_cap', (0.18, 0.37, 0.82), 0.4)
M['radio'] = basic('radio_olive', (0.36, 0.40, 0.25), 0.55)
M['firstaid'] = basic('firstaid_red', (0.85, 0.12, 0.12), 0.45)
M['led'] = basic('led_strip', (1.0, 0.9, 0.75), 0.4, emit=(1.0, 0.80, 0.55), estr=0.0)
M['led2'] = basic('led_lamp', (1.0, 0.9, 0.75), 0.4, emit=(1.0, 0.75, 0.45), estr=0.0)
M['arrow'] = basic('arrow_red', (0.9, 0.05, 0.04), 0.4, emit=(1.0, 0.06, 0.04), estr=2.5)
M['glow'] = basic('cut_glow', (1.0, 0.7, 0.3), 0.4, emit=(1.0, 0.55, 0.15), estr=0.0)
M['dust'] = basic('dust', (0.85, 0.80, 0.74), 0.9, emit=(0.9, 0.85, 0.8), estr=0.15, alpha=0.55)
M['ceil_light'] = basic('ceil_light', (1, 1, 1), 0.3, emit=(1.0, 0.86, 0.66), estr=18.0)

# shell concrete: wet (dark, glossy) -> cured (light, matte), keyed by one value node
def mat_shell():
    m, nt, b = new_mat('shell_concrete')
    v = coord_node(nt, 'world')
    n = noise(nt, v, 5, 6)
    dry = ramp_mix(nt, n.outputs['Fac'], (0.62, 0.62, 0.60), (0.70, 0.70, 0.67))
    val = nt.nodes.new('ShaderNodeValue')
    val.name = 'cure'
    val.outputs[0].default_value = 1.0
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    nt.links.new(val.outputs[0], mx.inputs['Factor'])
    mx.inputs['A'].default_value = (*L((0.33, 0.33, 0.35)), 1)
    nt.links.new(dry, mx.inputs['B'])
    nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange')
    rr.inputs['To Min'].default_value = 0.18
    rr.inputs['To Max'].default_value = 0.9
    nt.links.new(val.outputs[0], rr.inputs['Value'])
    nt.links.new(rr.outputs['Result'], b.inputs['Roughness'])
    n2 = noise(nt, v, 50, 3)
    bump(nt, b, n2.outputs['Fac'], 0.2, 0.01)
    return m, val

M['shell'], CURE = mat_shell()
M['shell_cut'] = mat_concrete('shell_cut', (0.55, 0.55, 0.53), (0.62, 0.62, 0.59), 'world')


# ---------------------------------------------------------------- geometry
def link(ob):
    COL.objects.link(ob)
    return ob


def box(name, x0, x1, y0, y1, z0, z1, mat, front=None, pivot=(0.5, 0.5, 0.5),
        bevel=0.0, seg=3, rest=True, top=None):
    ox = x0 + (x1 - x0) * pivot[0]
    oy = y0 + (y1 - y0) * pivot[1]
    oz = z0 + (z1 - z0) * pivot[2]
    vs = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
          (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    vs = [(a - ox, b - oy, c - oz) for a, b, c in vs]
    fs = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (3, 0, 4, 7), (1, 2, 6, 5)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(vs, [], fs)
    me.materials.append(mat)
    if front is not None:
        me.materials.append(front)
        me.polygons[2].material_index = 1
    if top is not None:
        me.materials.append(top)
        me.polygons[1].material_index = len(me.materials) - 1
    me.update()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = (ox, oy, oz)
    ob['rest'] = (ox, oy, oz)
    if bevel:
        bv = ob.modifiers.new('bevel', 'BEVEL')
        bv.width = bevel
        bv.segments = seg
        bv.limit_method = 'NONE'
        bv.harden_normals = True
        me.shade_smooth()
    return ob


def prim(kind, name, loc, mat, smooth=True, **kw):
    if kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(location=loc, **kw)
    elif kind == 'cone':
        bpy.ops.mesh.primitive_cone_add(location=loc, **kw)
    elif kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(location=loc, **kw)
    elif kind == 'ico':
        bpy.ops.mesh.primitive_ico_sphere_add(location=loc, **kw)
    elif kind == 'cube':
        bpy.ops.mesh.primitive_cube_add(location=loc, **kw)
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(location=loc, **kw)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    ob['rest'] = tuple(loc)
    if smooth:
        ob.data.shade_smooth()
    return ob


def pillow(name, loc, size, mat, rot=(0, 0, 0)):
    ob = prim('cube', name, loc, mat, size=1.0)
    ob.scale = size
    ob.rotation_euler = rot
    sd = ob.modifiers.new('sub', 'SUBSURF')
    sd.levels = sd.render_levels = 2
    return ob


def parent(child, par):
    bpy.context.view_layer.update()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()
    return child


def empty(name, loc=(0, 0, 0)):
    e = link(bpy.data.objects.new(name, None))
    e.location = loc
    return e


def group(name, loc, objs):
    e = empty(name, loc)
    for o in objs:
        parent(o, e)
    return e


def pop(ob, t, base=1.0, dur=0.3):
    """Scale 0 -> overshoot -> settle, the 'items popping into place' look."""
    f0 = F(t)
    s = base if isinstance(base, (tuple, list)) else (base, base, base)
    key(ob, 'scale', 1, (0, 0, 0))
    key(ob, 'scale', f0, (0, 0, 0))
    key(ob, 'scale', f0 + 4, tuple(c * 1.18 for c in s))
    key(ob, 'scale', f0 + 7, tuple(c * 0.94 for c in s))
    key(ob, 'scale', f0 + 10, tuple(s))


# ---------------------------------------------------------------- dimensions
CUT_Y = -2.5                       # the cross-section plane (front of everything)
PX0, PX1, PY1 = -2.0, 2.0, 0.5     # pit footprint (x0..x1, CUT_Y..PY1)
Z_WOOD, Z_PLY, Z_CON, Z_GRAV, Z_SOIL, Z_CLAY = 0.0, -0.05, -0.09, -0.34, -0.64, -3.0
Z_BOT = -6.5
Z_PIT = -3.75
ROOM_X, ROOM_Y = 3.5, 2.5
WALL_T, ROOM_H = 0.2, 2.8
PIPE_Z, PIPE_R, PIPE_Y = -1.15, 0.07, CUT_Y + 0.01

# ---------------------------------------------------------------- room
def layer_ring(name, z0, z1, mat, x0=-ROOM_X - WALL_T, x1=ROOM_X + WALL_T, y1=ROOM_Y + WALL_T,
               front=None):
    """A layer of the house floor with the pit footprint left out."""
    parts = [box(name + '_L', x0, PX0, CUT_Y, y1, z0, z1, mat, front),
             box(name + '_R', PX1, x1, CUT_Y, y1, z0, z1, mat, front),
             box(name + '_B', PX0, PX1, PY1, y1, z0, z1, mat, front)]
    return parts


layer_ring('floor', Z_PLY, Z_WOOD, M['floor'])
layer_ring('ply', Z_CON, Z_PLY, M['ply'])
layer_ring('slab', Z_GRAV, Z_CON, M['concrete'])
layer_ring('gravel', Z_SOIL, Z_GRAV, M['gravel'])

# ground (soil + clay) is wider than the house: garden on both sides
GX0, GX1, GY1 = -7.0, 7.5, 6.0
for nm, z0, z1, mat in (('soil', Z_CLAY, Z_SOIL, M['soil']),):
    box(nm + '_L', GX0, PX0, CUT_Y, GY1, z0, z1, mat)
    box(nm + '_R', PX1, GX1, CUT_Y, GY1, z0, z1, mat)
    box(nm + '_B', PX0, PX1, PY1, GY1, z0, z1, mat)
box('clay_L', GX0, PX0, CUT_Y, GY1, Z_BOT, Z_CLAY, M['clay'])
box('clay_R', PX1, GX1, CUT_Y, GY1, Z_BOT, Z_CLAY, M['clay'])
box('clay_B', PX0, PX1, PY1, GY1, Z_BOT, Z_CLAY, M['clay'])
box('clay_under', PX0, PX1, CUT_Y, PY1, Z_BOT, Z_PIT, M['clay'])
# soil up to garden level outside the house
G_TOP = -0.16
box('soil_out_L', GX0, -ROOM_X - WALL_T, CUT_Y, GY1, Z_SOIL, G_TOP, M['soil'])
box('soil_out_R', ROOM_X + WALL_T, GX1, CUT_Y, GY1, Z_SOIL, G_TOP, M['soil'])
box('soil_out_back', -ROOM_X - WALL_T, ROOM_X + WALL_T, ROOM_Y + WALL_T, GY1, Z_SOIL, G_TOP, M['soil'])
box('grass_L', GX0, -ROOM_X - WALL_T, CUT_Y, GY1, G_TOP, G_TOP + 0.05, M['grass'])
box('grass_R', ROOM_X + WALL_T, GX1, CUT_Y, GY1, G_TOP, G_TOP + 0.05, M['grass'])
box('grass_back', -ROOM_X - WALL_T, ROOM_X + WALL_T, ROOM_Y + WALL_T, GY1, G_TOP, G_TOP + 0.05, M['grass'])

# pit fill pieces that get dug out (pivot at their bottom so they shrink downward)
fill_grav = box('fill_gravel', PX0, PX1, CUT_Y, PY1, Z_SOIL, Z_GRAV, M['gravel'], pivot=(0.5, 0.5, 0))
fill_soil = box('fill_soil', PX0, PX1, CUT_Y, PY1, Z_CLAY, Z_SOIL, M['soil'], pivot=(0.5, 0.5, 0))
fill_clay = box('fill_clay', PX0, PX1, CUT_Y, PY1, Z_PIT, Z_CLAY, M['clay'], pivot=(0.5, 0.5, 0))

# small rocks pressed into the cross-section face (kept out of the pit footprint)
for i in range(260):
    while True:
        x = random.uniform(GX0 + 0.2, GX1 - 0.2)
        z = random.uniform(Z_BOT + 0.2, Z_SOIL - 0.1)
        if x < -ROOM_X - WALL_T or x > ROOM_X + WALL_T:
            z = random.uniform(Z_BOT + 0.2, G_TOP - 0.1)
        if not (PX0 - 0.12 < x < PX1 + 0.12 and z > Z_PIT - 0.15):
            if abs(z - PIPE_Z) > 0.12 and not (1.9 < x < 4.6 and -0.95 < z < 0.0):
                break
    r = random.uniform(0.025, 0.07) * (0.7 if z < Z_CLAY else 1.0)
    ob = prim('ico', f'rock{i}', (x, CUT_Y + r * 0.25, z), M['rock'], subdivisions=1, radius=r)
    ob.scale = (random.uniform(0.8, 1.4), random.uniform(0.5, 0.8), random.uniform(0.6, 1.0))
    ob.rotation_euler = (random.random() * 3, random.random() * 3, random.random() * 3)

# walls, ceiling
def wall_back():
    y0, y1 = ROOM_Y, ROOM_Y + WALL_T
    wx0, wx1, wz0, wz1 = -3.1, -2.0, 0.85, 2.3
    box('wall_back_a', -ROOM_X - WALL_T, wx0, y0, y1, 0, ROOM_H, M['wall'])
    box('wall_back_b', wx1, ROOM_X + WALL_T, y0, y1, 0, ROOM_H, M['wall'])
    box('wall_back_c', wx0, wx1, y0, y1, 0, wz0, M['wall'])
    box('wall_back_d', wx0, wx1, y0, y1, wz1, ROOM_H, M['wall'])
    t = 0.06
    box('win_l', wx0, wx0 + t, y0 - 0.03, y1, wz0, wz1, M['white'])
    box('win_r', wx1 - t, wx1, y0 - 0.03, y1, wz0, wz1, M['white'])
    box('win_t', wx0, wx1, y0 - 0.03, y1, wz1 - t, wz1, M['white'])
    box('win_b', wx0 - 0.05, wx1 + 0.05, y0 - 0.12, y1, wz0 - 0.04, wz0 + 0.03, M['white'])
    box('win_m', (wx0 + wx1) / 2 - 0.025, (wx0 + wx1) / 2 + 0.025, y0 + 0.05, y0 + 0.09, wz0, wz1, M['white'])
    box('win_h', wx0, wx1, y0 + 0.05, y0 + 0.09, 1.62, 1.67, M['white'])
    # outside view: sky + trees
    box('sky', -5.5, 0.0, 5.0, 5.05, 0.0, 2.6, M['sky'])
    for i, (tx, ty, s) in enumerate(((-3.3, 3.8, 0.75), (-2.2, 4.4, 0.85), (-4.4, 4.2, 0.8))):
        prim('cyl', f'trunk{i}', (tx, ty, 0.5 * s), M['trunk'], radius=0.07 * s, depth=1.2 * s)
        for k in range(3):
            prim('ico', f'tree{i}_{k}', (tx + random.uniform(-0.25, 0.25) * s, ty, (1.4 + k * 0.35) * s),
                 M['foliage'], subdivisions=2, radius=(0.55 - k * 0.12) * s)


wall_back()
box('wall_left', -ROOM_X - WALL_T, -ROOM_X, CUT_Y, ROOM_Y, 0, ROOM_H, M['wall'], front=M['cut'])
box('wall_right', ROOM_X, ROOM_X + WALL_T, CUT_Y, ROOM_Y, 0, ROOM_H, M['wall'], front=M['cut'])
box('ceiling', -ROOM_X - WALL_T, ROOM_X + WALL_T, CUT_Y, ROOM_Y + WALL_T, ROOM_H, ROOM_H + 0.22,
    M['ceiling'], front=M['cut'], top=M['cut'])
box('crown', -ROOM_X, ROOM_X, ROOM_Y - 0.06, ROOM_Y, ROOM_H - 0.1, ROOM_H, M['white'])
box('base_back', -ROOM_X, ROOM_X, ROOM_Y - 0.03, ROOM_Y, 0, 0.1, M['white'])
box('base_l', -ROOM_X, -ROOM_X + 0.03, CUT_Y, ROOM_Y, 0, 0.1, M['white'])
box('base_r', ROOM_X - 0.03, ROOM_X, CUT_Y, ROOM_Y, 0, 0.1, M['white'])
# exterior cladding on the outer sides of the house
box('ext_l', -ROOM_X - WALL_T - 0.03, -ROOM_X - WALL_T, CUT_Y, ROOM_Y + WALL_T, G_TOP, ROOM_H + 0.22, M['ext_wall'], front=M['cut'])
box('ext_r', ROOM_X + WALL_T, ROOM_X + WALL_T + 0.03, CUT_Y, ROOM_Y + WALL_T, G_TOP, ROOM_H + 0.22, M['ext_wall'], front=M['cut'])

# recessed ceiling lights (visible discs + the spot lights that actually light the room)
CEIL_LIGHTS = [(-2.2, -1.2), (0, -1.2), (2.2, -1.2), (-2.2, 1.2), (0, 1.2), (2.2, 1.2)]
for i, (lx, ly) in enumerate(CEIL_LIGHTS):
    prim('cyl', f'ceil_disc{i}', (lx, ly, ROOM_H - 0.004), M['ceil_light'], radius=0.09, depth=0.01)
    ld = bpy.data.lights.new(f'ceil_spot{i}', 'SPOT')
    ld.energy = 110
    ld.color = (1.0, 0.82, 0.62)
    ld.spot_size = math.radians(150)
    ld.spot_blend = 1.0
    ld.shadow_soft_size = 0.12
    lo = link(bpy.data.objects.new(f'ceil_spot{i}', ld))
    lo.location = (lx, ly, ROOM_H - 0.03)

# sofa
SOFA_Y0, SOFA_Y1 = 1.62, 2.46
sofa = []
sofa.append(box('sofa_base', -1.3, 1.3, SOFA_Y0 + 0.04, SOFA_Y1, 0.12, 0.42, M['teal'], bevel=0.05))
sofa.append(box('sofa_back', -1.3, 1.3, 2.14, SOFA_Y1, 0.40, 0.98, M['teal'], bevel=0.09))
sofa.append(box('sofa_arm_l', -1.3, -1.08, SOFA_Y0, SOFA_Y1, 0.12, 0.72, M['teal'], bevel=0.08))
sofa.append(box('sofa_arm_r', 1.08, 1.3, SOFA_Y0, SOFA_Y1, 0.12, 0.72, M['teal'], bevel=0.08))
for i in range(3):
    x0 = -1.08 + i * 0.72
    sofa.append(box(f'sofa_seat{i}', x0 + 0.01, x0 + 0.71, SOFA_Y0, 2.16, 0.41, 0.56, M['teal'], bevel=0.07))
for i, x in enumerate((-1.2, 1.2)):
    for j, y in enumerate((SOFA_Y0 + 0.1, SOFA_Y1 - 0.1)):
        prim('cyl', f'sofa_leg{i}{j}', (x, y, 0.06), M['wood_dark'], radius=0.03, depth=0.12)
for i, x in enumerate((-0.78, -0.26, 0.26, 0.78)):
    c = box(f'cushion{i}', x - 0.2, x + 0.2, 2.0, 2.13, 0.58, 0.96, M['yellow'] if i % 2 == 0 else M['pink'],
            bevel=0.05, seg=4)
    sd = c.modifiers.new('sub', 'SUBSURF')
    sd.levels = sd.render_levels = 1
    c.rotation_euler = (math.radians(-12), 0, math.radians(random.uniform(-5, 5)))

# paintings
def painting(name, x0, x1, z0, z1, bg, sq):
    y = ROOM_Y
    box(name + '_frame', x0, x1, y - 0.04, y, z0, z1, M['white'], bevel=0.008, seg=2)
    box(name + '_canvas', x0 + 0.05, x1 - 0.05, y - 0.045, y - 0.04, z0 + 0.05, z1 - 0.05, bg)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    w = (x1 - x0) * 0.28
    box(name + '_sq', cx - w, cx + w, y - 0.05, y - 0.045, cz - w * 0.75, cz + w * 0.75, sq)


painting('paint_a', -1.05, -0.08, 1.28, 2.05, M['peach'], M['paint_pink'])
painting('paint_b', 0.08, 1.05, 1.28, 2.05, M['paint_white'], M['paint_blue'])

# floor lamp
LAMP = (1.78, 2.12)
prim('cyl', 'lamp_base', (LAMP[0], LAMP[1], 0.015), M['black'], radius=0.17, depth=0.03)
prim('cyl', 'lamp_pole', (LAMP[0], LAMP[1], 0.78), M['black'], radius=0.014, depth=1.5)
sh = prim('cone', 'lamp_shade', (LAMP[0], LAMP[1], 1.62), M['shade'], radius1=0.24, radius2=0.15,
          depth=0.32, end_fill_type='NOTHING')
sl = bpy.data.lights.new('lamp_light', 'POINT')
sl.energy = 25
sl.color = (1.0, 0.75, 0.45)
sl.shadow_soft_size = 0.1
link(bpy.data.objects.new('lamp_light', sl)).location = (LAMP[0], LAMP[1], 1.6)

# potted plant
PL = (-1.62, 2.15)
pot = prim('cone', 'pot', (PL[0], PL[1], 0.2), M['pot'], radius1=0.14, radius2=0.19, depth=0.4)
prim('cyl', 'pot_soil', (PL[0], PL[1], 0.385), M['soil'], radius=0.17, depth=0.02)
for i in range(16):
    a = i / 16 * math.tau + random.uniform(-0.2, 0.2)
    tilt = random.uniform(0.35, 0.8)
    ln = random.uniform(0.32, 0.5)
    lf = prim('ico', f'leaf{i}', (PL[0] + math.cos(a) * ln * 0.45 * math.sin(tilt), PL[1] + math.sin(a) * ln * 0.45 * math.sin(tilt),
                                   0.42 + ln * 0.5 * math.cos(tilt)), M['leaf'], subdivisions=2, radius=1)
    lf.scale = (0.05, 0.016, ln * 0.5)
    lf.rotation_euler = Euler((0, tilt, a), 'XYZ')

# coffee table (kept off the rug, between rug and sofa)
TB = (0.0, 0.98)
box('table_top', TB[0] - 0.62, TB[0] + 0.62, TB[1] - 0.3, TB[1] + 0.3, 0.38, 0.44, M['wood_dark'], bevel=0.015, seg=2)
for i, (dx, dy) in enumerate(((-0.55, -0.23), (0.55, -0.23), (-0.55, 0.23), (0.55, 0.23))):
    box(f'table_leg{i}', TB[0] + dx - 0.025, TB[0] + dx + 0.025, TB[1] + dy - 0.025, TB[1] + dy + 0.025,
        0, 0.38, M['wood_dark'])
box('book', -0.35, 0.0, 0.85, 1.1, 0.44, 0.48, M['book'], bevel=0.005, seg=1)
prim('cyl', 'mug', (0.32, 1.02, 0.49), M['white'], radius=0.045, depth=0.1)

# window daylight
wl = bpy.data.lights.new('window_light', 'AREA')
wl.shape = 'RECTANGLE'
wl.size, wl.size_y = 1.3, 1.6
wl.energy = 260
wl.color = (0.85, 0.92, 1.0)
wo = link(bpy.data.objects.new('window_light', wl))
wo.location = (-2.55, 3.2, 1.6)
wo.rotation_euler = (math.radians(-80), 0, 0)

# ---------------------------------------------------------------- rug (rolls off and back)
RUG_X0, RUG_X1, RUG_Y0, RUG_Y1, RUG_T = -1.9, 1.9, -2.38, 0.38, 0.016
rug = box('rug', RUG_X0, RUG_X1, RUG_Y0, RUG_Y1, 0.0, RUG_T, M['rug'], pivot=(0, 0.5, 0))
roll = prim('cyl', 'rug_roll', (RUG_X1, (RUG_Y0 + RUG_Y1) / 2, RUG_T), M['rug'], radius=1.0,
            depth=RUG_Y1 - RUG_Y0, vertices=40)
roll.rotation_euler = (math.radians(90), 0, 0)
RUG_LEN = RUG_X1 - RUG_X0
R0 = 0.012
ROLL_PARK = -2.75


def roll_radius(rolled):
    return math.sqrt(R0 * R0 + rolled * RUG_T / math.pi * 1.6)


def rug_state(edge_x, roll_x=None):
    """edge_x: right edge of the flat part. Roll sits on the floor at edge_x."""
    rolled = RUG_X1 - edge_x
    r = roll_radius(rolled)
    rx = edge_x if roll_x is None else roll_x
    return max(1e-4, (edge_x - RUG_X0) / RUG_LEN), r, rx


def key_rug(frame, edge_x, roll_x=None, show_roll=True):
    sx, r, rx = rug_state(edge_x, roll_x)
    key(rug, 'scale', frame, (sx, 1, 1), interp='LINEAR')
    key(roll, 'scale', frame, (r, r, 1) if show_roll else (0, 0, 0), interp='LINEAR')
    key(roll, 'location', frame, (rx, (RUG_Y0 + RUG_Y1) / 2, r + 0.001), interp='LINEAR')
    key(roll, 'rotation_euler', frame, (math.radians(90), (RUG_X1 - rx) / max(r, 0.02) * 0.6, 0), interp='LINEAR')


def ease(u):
    u = min(1, max(0, u))
    return u * u * (3 - 2 * u)


key_rug(1, RUG_X1, show_roll=False)
f0, f1 = F(T['rug_off']), F(T['rug_off_end'])
key_rug(f0 - 1, RUG_X1, show_roll=False)
for f in range(f0, f1 + 1):
    u = ease((f - f0) / (f1 - f0))
    key_rug(f, RUG_X1 - u * RUG_LEN)
# roll tucks itself aside next to the pit
f2 = f1 + 14
for f in range(f1 + 1, f2 + 1):
    u = ease((f - f1) / (f2 - f1))
    key_rug(f, RUG_X0 + 1e-4, roll_x=RUG_X0 + u * (ROLL_PARK - RUG_X0))
# and back again in scene 7
b0, b1 = F(T['rug_back']), F(T['rug_back_end'])
bm = b0 + 12
key_rug(b0, RUG_X0 + 1e-4, roll_x=ROLL_PARK)
for f in range(b0 + 1, bm + 1):
    u = ease((f - b0) / (bm - b0))
    key_rug(f, RUG_X0 + 1e-4, roll_x=ROLL_PARK + u * (RUG_X0 - ROLL_PARK))
for f in range(bm + 1, b1 + 1):
    u = ease((f - bm) / (b1 - bm))
    key_rug(f, RUG_X0 + u * RUG_LEN)
key_rug(b1 + 1, RUG_X1, show_roll=False)

# ---------------------------------------------------------------- floor cut (scene 2)
# glowing outline traced on the floor
glow_parts = []
gw, gh = 0.03, 0.006
segs = [(PX0, CUT_Y, PX1, CUT_Y), (PX1, CUT_Y, PX1, PY1), (PX1, PY1, PX0, PY1), (PX0, PY1, PX0, CUT_Y)]
fo0, fo1 = F(T['outline']), F(T['outline_end'])
for i, (ax, ay, bx, by) in enumerate(segs):
    if ax == bx:
        ob = box(f'glow{i}', ax - gw / 2, ax + gw / 2, min(ay, by), max(ay, by), 0.0, gh, M['glow'],
                 pivot=(0.5, 0 if by > ay else 1, 0))
        axis = 1
    else:
        ob = box(f'glow{i}', min(ax, bx), max(ax, bx), ay - gw / 2, ay + gw / 2, 0.0, gh, M['glow'],
                 pivot=(0 if bx > ax else 1, 0.5, 0))
        axis = 0
    a = fo0 + int(i * (fo1 - fo0) / 4)
    b = fo0 + int((i + 1) * (fo1 - fo0) / 4)
    s0 = [1, 1, 1]; s0[axis] = 0
    s0[axis] = 0.002
    key(ob, 'scale', 1, (0, 0, 0), interp='CONSTANT')
    key(ob, 'scale', a, tuple(s0), interp='LINEAR')
    key(ob, 'scale', b, (1, 1, 1), interp='LINEAR')
    key(ob, 'scale', F(T['ply_end']) + 2, (1, 1, 1))
    key(ob, 'scale', F(T['ply_end']) + 3, (0, 0, 0), interp='CONSTANT')
    glow_parts.append(ob)
gs = M['glow'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
key_socket(gs, 1, 0.0)
key_socket(gs, fo0, 6.0)
key_socket(gs, fo1, 9.0)
key_socket(gs, fo1 + 10, 14.0)
key_socket(gs, F(T['planks']) + 20, 9.0)
key_socket(gs, F(T['ply_end']), 0.0)
gl = bpy.data.lights.new('glow_light', 'AREA')
gl.shape = 'RECTANGLE'
gl.size, gl.size_y = PX1 - PX0, PY1 - CUT_Y
gl.color = (1.0, 0.55, 0.2)
glo = link(bpy.data.objects.new('glow_light', gl))
glo.location = (0, (CUT_Y + PY1) / 2, 0.25)
key(gl, 'energy', 1, 0.0)
key(gl, 'energy', fo0, 0.0)
key(gl, 'energy', fo1 + 10, 60.0)
key(gl, 'energy', F(T['ply_end']), 0.0)

# floorboards + plywood inside the cut (lift out, come back in scene 7)
planks, plys = [], []
NPL = int(round((PX1 - PX0) / 0.2))
for i in range(NPL):
    x0 = PX0 + i * 0.2
    planks.append(box(f'plank{i}', x0, x0 + 0.2, CUT_Y, PY1, Z_PLY, Z_WOOD, M['floor']))
for i in range(2):
    x0 = PX0 + i * 2.0
    plys.append(box(f'ply_sheet{i}', x0, x0 + 2.0, CUT_Y, PY1, Z_CON, Z_PLY, M['ply']))


def fly_out(ob, t0, dur, up=4.5, spin=None, drift=(0, 0)):
    f0 = F(t0)
    f1 = f0 + int(dur * FPS)
    rest = Vector(ob['rest'])
    rot0 = ob.rotation_euler.copy()
    spin = spin or (random.uniform(-0.5, 0.5), random.uniform(-0.4, 0.4), random.uniform(-0.3, 0.3))
    key(ob, 'location', 1, rest)
    key(ob, 'location', f0, rest)
    key(ob, 'rotation_euler', f0, rot0)
    key(ob, 'location', f0 + 6, rest + Vector((0, 0, 0.18)))
    key(ob, 'location', f1, rest + Vector((drift[0], drift[1], up)))
    key(ob, 'rotation_euler', f1, (rot0.x + spin[0], rot0.y + spin[1], rot0.z + spin[2]))
    key(ob, 'scale', f0, (1, 1, 1))
    key(ob, 'scale', f1 - 3, (1, 1, 1))
    key(ob, 'scale', f1, (0, 0, 0))
    return f1


def fly_in(ob, t0, dur, from_off, rot_off=(0, 0, 0)):
    f0 = F(t0)
    f1 = f0 + int(dur * FPS)
    rest = Vector(ob['rest'])
    key(ob, 'scale', f0 - 1, (0, 0, 0), interp='CONSTANT')
    key(ob, 'scale', f0, (1, 1, 1), interp='CONSTANT')
    key(ob, 'location', f0, rest + Vector(from_off))
    key(ob, 'rotation_euler', f0, rot_off)
    key(ob, 'location', f1, rest)
    key(ob, 'rotation_euler', f1, (0, 0, 0))


tp0, tp1 = T['planks'], T['planks_end']
order = list(range(NPL))
for k, i in enumerate(order):
    t = tp0 + k * (tp1 - tp0 - 0.8) / NPL
    fly_out(planks[i], t, 0.85, up=4.0, drift=(random.uniform(-0.6, 0.6), random.uniform(0.0, 1.2)))
for k, p in enumerate(plys):
    fly_out(p, T['ply'] + k * 0.25, 0.8, up=4.0, drift=((-1.2, 1.2)[k], 0.4))
# scene 7: back in, sliding into place
fb0, fb1 = T['floor_back'], T['floor_back_end']
for k, p in enumerate(plys):
    fly_in(p, fb0 + k * 0.2, 0.55, ((-2.2, 2.2)[k], 0, 0.35))
pl0 = fb0 + 0.75
for k in range(NPL):
    t = pl0 + k * (fb1 - pl0 - 0.55) / NPL
    fly_in(planks[k], t, 0.5, (-0.9, 0, 0.12))

# ---------------------------------------------------------------- concrete slab chunks (scene 3)
def fracture_grid(nx, ny, x0, x1, y0, y1, jitter):
    pts = {}
    for i in range(nx + 1):
        for j in range(ny + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            if 0 < i < nx:
                x += random.uniform(-jitter, jitter) * (x1 - x0) / nx
            if 0 < j < ny:
                y += random.uniform(-jitter, jitter) * (y1 - y0) / ny
            pts[i, j] = (x, y)
    cells = []
    for i in range(nx):
        for j in range(ny):
            cells.append([pts[i, j], pts[i + 1, j], pts[i + 1, j + 1], pts[i, j + 1]])
    return cells


def prism(name, poly, z0, z1, mat, front=None):
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    cz = (z0 + z1) / 2
    n = len(poly)
    vs = [(p[0] - cx, p[1] - cy, z0 - cz) for p in poly] + [(p[0] - cx, p[1] - cy, z1 - cz) for p in poly]
    fs = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    for k in range(n):
        a, b = k, (k + 1) % n
        fs.append((a, b, b + n, a + n))
    me = bpy.data.meshes.new(name)
    me.from_pydata(vs, [], fs)
    me.materials.append(mat)
    me.update()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = (cx, cy, cz)
    ob['rest'] = (cx, cy, cz)
    return ob


chunks = []
for k, poly in enumerate(fracture_grid(6, 5, PX0, PX1, CUT_Y, PY1, 0.35)):
    chunks.append(prism(f'chunk{k}', poly, Z_GRAV, Z_CON, M['concrete']))
fc0, fc1 = F(T['crack']), F(T['crack_end'])
random.shuffle(chunks)
for k, ch in enumerate(chunks):
    rest = Vector(ch['rest'])
    key(ch, 'scale', 1, (1, 1, 1))
    key(ch, 'scale', fc0, (1, 1, 1))
    key(ch, 'location', 1, rest)
    key(ch, 'location', fc0, rest)
    # jackhammer shudder + cracks opening (pieces shrink toward their centres)
    for f in range(fc0, fc1, 3):
        u = (f - fc0) / (fc1 - fc0)
        s = 1 - 0.07 * ease(u)
        key(ch, 'scale', f, (s, s, 1), interp='LINEAR')
        key(ch, 'location', f, rest + Vector((random.uniform(-1, 1) * 0.006, random.uniform(-1, 1) * 0.006,
                                              random.uniform(0, 1) * 0.012 * u)), interp='LINEAR')
        key(ch, 'rotation_euler', f, (random.uniform(-1, 1) * 0.02 * u, random.uniform(-1, 1) * 0.02 * u, 0),
            interp='LINEAR')
    key(ch, 'scale', fc1, (0.93, 0.93, 1))
    t_out = T['chunks'] + k * (T['chunks_end'] - T['chunks'] - 0.9) / len(chunks)
    f_out = F(t_out)
    key(ch, 'location', f_out, rest + Vector((0, 0, 0.01)))
    key(ch, 'rotation_euler', f_out, (0, 0, 0))
    key(ch, 'scale', f_out, (0.93, 0.93, 1))
    f_end = f_out + 26
    key(ch, 'location', f_out + 7, rest + Vector((0, 0, 0.35)))
    key(ch, 'location', f_end, rest + Vector((random.uniform(-0.8, 0.8), random.uniform(0, 1.0), 4.2)))
    key(ch, 'rotation_euler', f_end, (random.uniform(-1.5, 1.5), random.uniform(-1.5, 1.5), random.uniform(-1, 1)))
    key(ch, 'scale', f_end - 4, (0.93, 0.93, 1))
    key(ch, 'scale', f_end, (0, 0, 0))

# red arrows pointing down
def arrow(name, loc):
    shaft = prim('cyl', name + '_shaft', (0, 0, 0.22), M['arrow'], radius=0.045, depth=0.32)
    head = prim('cone', name + '_head', (0, 0, 0.0), M['arrow'], radius1=0.0, radius2=0.12, depth=0.16)
    g = group(name, (0, 0, 0), [shaft, head])
    g.location = loc
    return g


fa0 = F(T['arrows'])
fa1 = F(T['chunks_end']) - 6
for i, x in enumerate((-1.1, 0.0, 1.1)):
    a = arrow(f'arrow{i}', (x, -1.2 + (i % 2) * 0.6, 0.45))
    base = Vector(a.location)
    key(a, 'scale', 1, (0, 0, 0))
    key(a, 'scale', fa0 + i * 4, (0, 0, 0))
    key(a, 'scale', fa0 + i * 4 + 6, (1.15, 1.15, 1.15))
    key(a, 'scale', fa0 + i * 4 + 10, (1, 1, 1))
    for f in range(fa0 + i * 4 + 10, fa1, 12):
        key(a, 'location', f, base + Vector((0, 0, 0.12 if ((f - fa0) // 12) % 2 else 0)))
    key(a, 'scale', fa1, (1, 1, 1))
    key(a, 'scale', fa1 + 6, (0, 0, 0))

# floating dust
fd0, fd1 = F(T['crack']) - 4, F(T['dig1']) + 30
for i in range(140):
    p = Vector((random.uniform(PX0 - 0.3, PX1 + 0.3), random.uniform(CUT_Y + 0.05, PY1 + 0.3), random.uniform(-0.1, 0.9)))
    d = prim('ico', f'dust{i}', tuple(p), M['dust'], subdivisions=1, radius=random.uniform(0.006, 0.016))
    st = fd0 + random.randint(0, 120)
    life = random.randint(70, 140)
    en = min(st + life, fd1)
    key(d, 'scale', 1, (0, 0, 0))
    key(d, 'scale', st, (0, 0, 0))
    key(d, 'scale', st + 12, (1, 1, 1))
    key(d, 'scale', en - 12, (1, 1, 1))
    key(d, 'scale', en, (0, 0, 0))
    q = p.copy()
    for f in range(st, en + 1, 15):
        key(d, 'location', f, q)
        q = q + Vector((random.uniform(-0.08, 0.08), random.uniform(-0.05, 0.05), random.uniform(0.0, 0.07)))

# ---------------------------------------------------------------- excavation (scene 4)
def shrink(ob, f0, f1, s0, s1):
    key(ob, 'scale', f0, (1, 1, s0))
    key(ob, 'scale', f1, (1, 1, s1))


fg0 = F(T['gravel'])
key(fill_grav, 'scale', 1, (1, 1, 1))
shrink(fill_grav, fg0, F(T['dig1']), 1, 0)
key(fill_grav, 'scale', F(T['dig1']) + 1, (0, 0, 0), interp='CONSTANT')
soil_h = Z_SOIL - Z_CLAY
z_mid = PIPE_Z - 0.22
key(fill_soil, 'scale', 1, (1, 1, 1))
shrink(fill_soil, F(T['dig1']), F(T['clank']) + 4, 1, (z_mid - Z_CLAY) / soil_h)
key(fill_soil, 'scale', F(T['dig2']), (1, 1, (z_mid - Z_CLAY) / soil_h))
key(fill_soil, 'scale', F(T['dig3']), (1, 1, 0))
key(fill_soil, 'scale', F(T['dig3']) + 1, (0, 0, 0), interp='CONSTANT')
key(fill_clay, 'scale', 1, (1, 1, 1))
key(fill_clay, 'scale', F(T['dig3']), (1, 1, 1))
key(fill_clay, 'scale', F(T['dig_end']), (1, 1, 0))
key(fill_clay, 'scale', F(T['dig_end']) + 1, (0, 0, 0), interp='CONSTANT')


def dig_level(f):
    """Top of the remaining material inside the pit at frame f (for the clods)."""
    def lerp_t(fa, fb, za, zb):
        u = min(1, max(0, (f - fa) / max(1, fb - fa)))
        return za + (zb - za) * u
    if f < F(T['dig1']):
        return lerp_t(fg0, F(T['dig1']), Z_CON, Z_SOIL)
    if f < F(T['dig2']):
        return lerp_t(F(T['dig1']), F(T['clank']) + 4, Z_SOIL, z_mid)
    if f < F(T['dig3']):
        return lerp_t(F(T['dig2']), F(T['dig3']), z_mid, Z_CLAY)
    return lerp_t(F(T['dig3']), F(T['dig_end']), Z_CLAY, Z_PIT)


# dirt clods thrown up out of the hole and falling back
clod_mats = [M['soil'], M['clay'], M['gravel']]
dig_windows = [(fg0, F(T['dig1'])), (F(T['dig1']), F(T['clank'])), (F(T['dig2']), F(T['dig_end']))]
ci = 0
for (wa, wb) in dig_windows:
    n = max(4, (wb - wa) // 3)
    for _ in range(n):
        f_start = random.randint(wa, max(wa, wb - 8))
        z0 = dig_level(f_start)
        mat = M['gravel'] if z0 > Z_SOIL - 0.02 else (M['clay'] if z0 < Z_CLAY else M['soil'])
        p = Vector((random.uniform(PX0 + 0.3, PX1 - 0.3), random.uniform(CUT_Y + 0.4, PY1 - 0.3), z0 + 0.03))
        cl = prim('ico', f'clod{ci}', tuple(p), mat, subdivisions=1, radius=random.uniform(0.03, 0.07))
        ci += 1
        vz = random.uniform(3.0, 5.0) + max(0, -z0) * 1.2
        vx = random.uniform(-1.4, 1.4)
        vy = random.uniform(-0.2, 0.6)
        key(cl, 'scale', 1, (0, 0, 0), interp='CONSTANT')
        key(cl, 'scale', f_start, (1, 1, 1), interp='CONSTANT')
        f = f_start
        q = p.copy()
        t = 0.0
        while True:
            t += 1 / FPS
            q = p + Vector((vx * t, vy * t, vz * t - 4.9 * t * t))
            f += 1
            key(cl, 'location', f, q, interp='LINEAR')
            key(cl, 'rotation_euler', f, (t * 6, t * 4, t * 2), interp='LINEAR')
            if (vz - 9.8 * t) < 0 and q.z < dig_level(f) + 0.02:
                break
            if f - f_start > 70:
                break
        key(cl, 'scale', f, (1, 1, 1), interp='CONSTANT')
        key(cl, 'scale', f + 1, (0, 0, 0), interp='CONSTANT')

# copper water pipe: straight runs + a U section that slides back around the pit
PX_L, PX_R = PX0 - 0.03, PX1 + 0.03
def pipe_seg(name, a, b, mat, r=PIPE_R):
    a, b = Vector(a), Vector(b)
    mid = (a + b) / 2
    d = b - a
    ob = prim('cyl', name, tuple(mid), mat, radius=r, depth=1.0, vertices=24)
    ob.scale = (1, 1, d.length)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


pipe_seg('pipe_left', (GX0, PIPE_Y, PIPE_Z), (PX_L, PIPE_Y, PIPE_Z), M['copper'])
pipe_seg('pipe_right', (PX_R, PIPE_Y, PIPE_Z), (GX1, PIPE_Y, PIPE_Z), M['copper'])
# back segment (spans the pit) + legs along the pit side walls; pivots so the legs stretch
back = prim('cyl', 'pipe_back', (0, PIPE_Y, PIPE_Z), M['copper_warn'], radius=PIPE_R, depth=PX_R - PX_L, vertices=24)
back.rotation_euler = (0, math.radians(90), 0)
legs = []
for i, x in enumerate((PX_L, PX_R)):
    me = bpy.data.meshes.new(f'pipe_leg{i}')
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=PIPE_R, radius2=PIPE_R, depth=1.0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.5))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M['copper'])
    me.shade_smooth()
    leg = link(bpy.data.objects.new(f'pipe_leg{i}', me))
    leg.location = (x, PIPE_Y, PIPE_Z)
    leg.rotation_euler = (math.radians(-90), 0, 0)      # local +Z -> world +Y
    legs.append(leg)
    prim('sphere', f'pipe_elbow_front{i}', (x, PIPE_Y, PIPE_Z), M['copper'], radius=PIPE_R * 1.08, segments=24, ring_count=12)
elbows_back = [prim('sphere', f'pipe_elbow_back{i}', (x, PIPE_Y, PIPE_Z), M['copper'], radius=PIPE_R * 1.08,
                    segments=24, ring_count=12) for i, x in enumerate((PX_L, PX_R))]
BACK_Y = PY1 + 0.03
fr0, fr1 = F(T['reroute']), F(T['reroute_end'])
travel = BACK_Y - PIPE_Y
key(back, 'location', 1, (0, PIPE_Y, PIPE_Z))
key(back, 'location', fr0, (0, PIPE_Y, PIPE_Z))
key(back, 'location', fr1, (0, BACK_Y, PIPE_Z))
for leg in legs:
    key(leg, 'scale', 1, (1, 1, 1e-4))
    key(leg, 'scale', fr0, (1, 1, 1e-4))
    key(leg, 'scale', fr1, (1, 1, travel))
for e, x in zip(elbows_back, (PX_L, PX_R)):
    key(e, 'location', fr0, (x, PIPE_Y, PIPE_Z))
    key(e, 'location', fr1, (x, BACK_Y, PIPE_Z))
ws = M['copper_warn'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
fw0 = F(T['clank']) - 2
key_socket(ws, 1, 0.0)
key_socket(ws, fw0, 0.0)
for k in range(6):
    key_socket(ws, fw0 + 4 + k * 10, 5.0)
    key_socket(ws, fw0 + 9 + k * 10, 1.2)
key_socket(ws, fr1, 3.0)
key_socket(ws, fr1 + 10, 0.0)
wl2 = bpy.data.lights.new('pipe_warn', 'POINT')
wl2.color = (1.0, 0.1, 0.05)
wl2.shadow_soft_size = 0.5
wlo = link(bpy.data.objects.new('pipe_warn', wl2))
wlo.location = (0, PIPE_Y - 0.4, PIPE_Z)
key(wl2, 'energy', 1, 0.0)
key(wl2, 'energy', fw0, 0.0)
key(wl2, 'energy', fw0 + 6, 60.0)
key(wl2, 'energy', fr1, 40.0)
key(wl2, 'energy', fr1 + 10, 0.0)

# ---------------------------------------------------------------- bunker shell (scene 5)
WT = 0.3
IZ0, IZ1 = Z_PIT + 0.4, Z_CON - 0.33          # interior floor / ceiling heights
IX0, IX1, IY1 = PX0 + WT, PX1 - WT, PY1 - WT   # interior extents
HX0, HX1, HY0, HY1 = 1.0, 1.62, -0.55, IY1     # hatch opening
# rebar cage
rebars = []
def bar(name, a, b):
    return pipe_seg(name, a, b, M['rebar'], r=0.014)

rb = 0
mid_w = WT / 2
for x in [PX0 + mid_w, PX1 - mid_w]:
    for y in [CUT_Y + 0.05 + k * 0.38 for k in range(8)]:
        rebars.append(bar(f'rebar{rb}', (x, y, Z_PIT + 0.08), (x, y, Z_CON - 0.06))); rb += 1
    for z in [Z_PIT + 0.15 + k * 0.42 for k in range(9)]:
        rebars.append(bar(f'rebar{rb}', (x, CUT_Y + 0.03, z), (x, PY1 - 0.05, z))); rb += 1
for x in [PX0 + 0.08 + k * 0.38 for k in range(11)]:
    rebars.append(bar(f'rebar{rb}', (x, PY1 - mid_w, Z_PIT + 0.08), (x, PY1 - mid_w, Z_CON - 0.06))); rb += 1
for z in [Z_PIT + 0.15 + k * 0.42 for k in range(9)]:
    rebars.append(bar(f'rebar{rb}', (PX0 + 0.05, PY1 - mid_w, z), (PX1 - 0.05, PY1 - mid_w, z))); rb += 1
for x in [PX0 + 0.08 + k * 0.38 for k in range(11)]:
    rebars.append(bar(f'rebar{rb}', (x, CUT_Y + 0.03, Z_PIT + 0.2), (x, PY1 - 0.05, Z_PIT + 0.2))); rb += 1
for y in [CUT_Y + 0.05 + k * 0.38 for k in range(8)]:
    rebars.append(bar(f'rebar{rb}', (PX0 + 0.05, y, Z_PIT + 0.2), (PX1 - 0.05, y, Z_PIT + 0.2))); rb += 1
frb0, frb1 = F(T['rebar']), F(T['rebar_end'])
rebars.sort(key=lambda o: (o.location.z, o.location.x))
for k, ob in enumerate(rebars):
    f = frb0 + int(k * (frb1 - frb0 - 8) / len(rebars))
    key(ob, 'scale', 1, (0, 0, 0))
    key(ob, 'scale', f, (0, 0, 0))
    key(ob, 'scale', f + 5, (1.6, 1.6, 1.05))
    key(ob, 'scale', f + 8, (1, 1, 1))
    key(ob, 'scale', F(T['pour_roof']) + 30, (1, 1, 1))
    key(ob, 'scale', F(T['pour_roof']) + 31, (0, 0, 0), interp='CONSTANT')

shell = []
sf = box('shell_floor', PX0, PX1, CUT_Y, PY1, Z_PIT, IZ0, M['shell'], front=M['shell_cut'], pivot=(0.5, 0.5, 0))
sw = [box('shell_wall_l', PX0, IX0, CUT_Y, PY1, IZ0, IZ1, M['shell'], front=M['shell_cut'], pivot=(0.5, 0.5, 0)),
      box('shell_wall_r', IX1, PX1, CUT_Y, PY1, IZ0, IZ1, M['shell'], front=M['shell_cut'], pivot=(0.5, 0.5, 0)),
      box('shell_wall_b', IX0, IX1, IY1, PY1, IZ0, IZ1, M['shell'], front=M['shell_cut'], pivot=(0.5, 0.5, 0))]
# roof with the hatch opening, grows from the back toward the cut
roof = [box('roof_a', PX0, PX1, CUT_Y, HY0, IZ1, Z_CON, M['shell'], front=M['shell_cut'], pivot=(0.5, 1, 0.5)),
        box('roof_b', PX0, HX0, HY0, PY1, IZ1, Z_CON, M['shell'], front=M['shell_cut'], pivot=(0.5, 1, 0.5)),
        box('roof_c', HX1, PX1, HY0, PY1, IZ1, Z_CON, M['shell'], front=M['shell_cut'], pivot=(0.5, 1, 0.5)),
        box('roof_d', HX0, HX1, HY1, PY1, IZ1, Z_CON, M['shell'], front=M['shell_cut'], pivot=(0.5, 1, 0.5))]
fp0 = F(T['pour_floor'])
key(sf, 'scale', 1, (0, 0, 0), interp='CONSTANT')
key(sf, 'scale', fp0, (1, 1, 0.02))
key(sf, 'scale', fp0 + 16, (1, 1, 1))
fw0_, fw1_ = F(T['pour_walls']), F(T['pour_roof']) - 3
for w in sw:
    key(w, 'scale', 1, (0, 0, 0), interp='CONSTANT')
    key(w, 'scale', fw0_, (1, 1, 0.02))
    key(w, 'scale', fw1_, (1, 1, 1))
fro0, fro1 = F(T['pour_roof']), F(T['thud'])
for r in roof:
    key(r, 'scale', 1, (0, 0, 0), interp='CONSTANT')
    key(r, 'scale', fro0, (1, 0.02, 1))
    key(r, 'scale', fro1, (1, 1, 1))
roof[0].animation_data.action  # noqa (ensure exists)
key_socket(CURE.outputs[0], 1, 0.0)
key_socket(CURE.outputs[0], fro1, 0.0)
key_socket(CURE.outputs[0], fro1 + 40, 1.0)
# wet sheen on the cut faces is not needed; cut material stays matte

# ventilation pipe: grows from the bunker through the soil up into the garden
vc = bpy.data.curves.new('vent_curve', 'CURVE')
vc.dimensions = '3D'
vc.bevel_depth = 0.075
vc.bevel_resolution = 6
vc.use_fill_caps = True
VZ = Z_SOIL - 0.12
VX = 4.6
pts = [(IX1 - 0.02, VZ), (VX - 0.2, VZ), (VX - 0.06, VZ + 0.04), (VX, VZ + 0.2), (VX, G_TOP + 0.55)]
sp = vc.splines.new('POLY')
sp.points.add(len(pts) - 1)
for p, (x, z) in zip(sp.points, pts):
    p.co = (x, CUT_Y + 0.01, z, 1)
vc.bevel_factor_mapping_end = 'SPLINE'
vent = link(bpy.data.objects.new('vent_pipe', vc))
vent.data.materials.append(M['vent'])
fv0, fv1 = F(T['vent']), F(T['vent_end'])
key(vc, 'bevel_factor_end', 1, 0.0)
key(vc, 'bevel_factor_end', fv0, 0.0)
key(vc, 'bevel_factor_end', fv1, 1.0)
cap = prim('cyl', 'vent_cap', (VX, CUT_Y + 0.01, G_TOP + 0.6), M['vent'], radius=0.16, depth=0.05)
cap2 = prim('cone', 'vent_hood', (VX, CUT_Y + 0.01, G_TOP + 0.68), M['vent'], radius1=0.17, radius2=0.02, depth=0.12)
vcap = group('vent_cap_grp', (VX, CUT_Y + 0.01, G_TOP + 0.6), [cap, cap2])
pop(vcap, T['vent_end'] - 0.1)
grill = box('vent_grille', IX1 - 0.02, IX1, CUT_Y + 0.02, CUT_Y + 0.28, VZ - 0.12, VZ + 0.12, M['steel_dark'])
pop(grill, T['vent'])
# a small bush in the garden next to the vent
for k in range(3):
    prim('ico', f'bush{k}', (5.4 + k * 0.25, CUT_Y + 0.6, G_TOP + 0.25 + 0.05 * k), M['foliage'],
         subdivisions=2, radius=0.32 - 0.05 * k)

# ---------------------------------------------------------------- bunker interior (scene 6)
# lights
led_objs = []
for i, x in enumerate((-0.75, 0.55)):
    led_objs.append(box(f'led{i}', x - 0.04, x + 0.04, CUT_Y + 0.25, IY1 - 0.15, IZ1 - 0.03, IZ1, M['led']))
    pop(led_objs[-1], T['lights'] - 0.35 + i * 0.1)
bl = []
for i, x in enumerate((-0.75, 0.55)):
    ld = bpy.data.lights.new(f'bunker_light{i}', 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = 0.2, 2.4
    ld.color = (1.0, 0.78, 0.52)
    lo = link(bpy.data.objects.new(f'bunker_light{i}', ld))
    lo.location = (x, (CUT_Y + IY1) / 2, IZ1 - 0.05)
    bl.append(ld)
fl0 = F(T['lights'])
les = M['led'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
key_socket(les, 1, 0.0, 'CONSTANT')
for df, v in ((0, 0.0), (1, 10.0), (3, 0.0), (5, 12.0), (7, 3.0), (9, 14.0)):
    key_socket(les, fl0 + df, v, 'CONSTANT')
for ld in bl:
    key(ld, 'energy', 1, 0.0, interp='CONSTANT')
    for df, v in ((0, 0.0), (1, 90.0), (3, 0.0), (5, 110.0), (7, 30.0), (9, 130.0)):
        key(ld, 'energy', fl0 + df, v, interp='CONSTANT')
fill_b = bpy.data.lights.new('bunker_fill', 'POINT')
fill_b.color = (1.0, 0.75, 0.5)
fill_b.shadow_soft_size = 0.6
fbo = link(bpy.data.objects.new('bunker_fill', fill_b))
fbo.location = (0.0, CUT_Y + 0.4, (IZ0 + IZ1) / 2)
key(fill_b, 'energy', 1, 0.0, interp='CONSTANT')
key(fill_b, 'energy', fl0 + 9, 40.0, interp='CONSTANT')

# bunk beds against the back wall
BX0, BX1, BY0, BY1 = IX0 + 0.05, IX0 + 2.0, IY1 - 0.92, IY1 - 0.04
bed_parts = []
for i, (x, y) in enumerate(((BX0, BY0), (BX1, BY0), (BX0, BY1), (BX1, BY1))):
    bed_parts.append(box(f'bed_post{i}', x - 0.03, x + 0.03, y - 0.03, y + 0.03, IZ0, IZ0 + 1.95, M['steel_dark']))
for lv, zb in enumerate((IZ0 + 0.35, IZ0 + 1.35)):
    bed_parts.append(box(f'bed_frame{lv}', BX0, BX1, BY0, BY1, zb - 0.06, zb, M['steel_dark']))
    bed_parts.append(box(f'bed_rail{lv}', BX0, BX1, BY0 - 0.01, BY0 + 0.03, zb, zb + 0.14, M['steel_dark']))
    bed_parts.append(box(f'mattress{lv}', BX0 + 0.04, BX1 - 0.04, BY0 + 0.04, BY1 - 0.04, zb, zb + 0.16, M['mattress'], bevel=0.05))
    bed_parts.append(box(f'blanket{lv}', BX0 + 0.55, BX1 - 0.03, BY0 + 0.02, BY1 - 0.02, zb + 0.15, zb + 0.19, M['blanket'], bevel=0.02))
    bed_parts.append(pillow(f'bed_pillow{lv}', (BX0 + 0.28, (BY0 + BY1) / 2, zb + 0.24), (0.2, 0.3, 0.07), M['pillow']))
# little ladder on the bunk
for k in range(4):
    bed_parts.append(box(f'bed_rung{k}', BX1 - 0.03, BX1 + 0.03, BY0 - 0.03, BY0 + 0.03, 0, 0, M['steel_dark']))
for ob in bed_parts[-4:]:
    COL.objects.unlink(ob)
bed_parts = bed_parts[:-4]
bed = group('bunk_bed', ((BX0 + BX1) / 2, (BY0 + BY1) / 2, IZ0), bed_parts)
pop(bed, T['beds'])

# metal shelf with canned food and water bottles
SX0, SX1 = BX1 + 0.12, BX1 + 0.82
SY0, SY1 = IY1 - 0.4, IY1 - 0.03
shelf_parts = []
for i, (x, y) in enumerate(((SX0, SY0), (SX1, SY0), (SX0, SY1), (SX1, SY1))):
    shelf_parts.append(box(f'shelf_post{i}', x - 0.02, x + 0.02, y - 0.02, y + 0.02, IZ0, IZ0 + 2.0, M['steel']))
SHELF_Z = [IZ0 + 0.15 + k * 0.5 for k in range(4)]
for k, z in enumerate(SHELF_Z):
    shelf_parts.append(box(f'shelf{k}', SX0 - 0.02, SX1 + 0.02, SY0 - 0.02, SY1 + 0.02, z - 0.025, z, M['steel']))
shelf = group('shelf', ((SX0 + SX1) / 2, (SY0 + SY1) / 2, IZ0), shelf_parts)
pop(shelf, T['beds'] + 0.35)

items_food, items_water = [], []
can_mats = [M['can_red'], M['can_green'], M['can_yellow']]
for k in (1, 2):
    z = SHELF_Z[k]
    for j in range(5):
        for row in range(2):
            x = SX0 + 0.08 + j * 0.135
            y = SY0 + 0.1 + row * 0.16
            c = prim('cyl', f'can{k}_{j}_{row}', (x, y, z + 0.065), can_mats[(j + k) % 3], radius=0.05, depth=0.13, vertices=20)
            items_food.append(c)
            if row == 0:
                c2 = prim('cyl', f'can_top{k}_{j}', (x, y, z + 0.195), can_mats[(j + k + 1) % 3], radius=0.05, depth=0.13, vertices=20)
                items_food.append(c2)
for k in (0, 3):
    z = SHELF_Z[k]
    for j in range(5):
        x = SX0 + 0.08 + j * 0.135
        y = (SY0 + SY1) / 2
        b = prim('cyl', f'bottle{k}_{j}', (x, y, z + 0.15), M['bottle'], radius=0.05, depth=0.3, vertices=20)
        cp = prim('cyl', f'bcap{k}_{j}', (0, 0, 0.17), M['cap'], radius=0.022, depth=0.04, vertices=12)
        cp.location = (0, 0, 0.17)
        cp.parent = b
        items_water.append(b)
# water jugs on the floor too
for j in range(3):
    b = prim('cyl', f'jug{j}', (IX1 - 0.25 - j * 0.0, CUT_Y + 0.9 + j * 0.3, IZ0 + 0.22), M['bottle'], radius=0.12, depth=0.44, vertices=24)
    cp = prim('cyl', f'jugcap{j}', (0, 0, 0.25), M['cap'], radius=0.04, depth=0.06, vertices=12)
    cp.location = (0, 0, 0.25)
    cp.parent = b
    items_water.append(b)


def pop_series(objs, t0, t1):
    for k, ob in enumerate(objs):
        pop(ob, t0 + k * (t1 - t0) / max(1, len(objs)))


pop_series(items_food, T['food'], T['food'] + 0.9)
pop_series(items_water, T['water'], T['water'] + 0.75)

# second "lights": a warm lantern on the table + wall lamp
# small table, stool, radio, first aid box
TX, TY = -0.35, CUT_Y + 0.95
tparts = [box('btable_top', TX - 0.4, TX + 0.4, TY - 0.3, TY + 0.3, IZ0 + 0.72, IZ0 + 0.76, M['wood_dark'], bevel=0.01, seg=2)]
for i, (dx, dy) in enumerate(((-0.36, -0.26), (0.36, -0.26), (-0.36, 0.26), (0.36, 0.26))):
    tparts.append(box(f'btable_leg{i}', TX + dx - 0.02, TX + dx + 0.02, TY + dy - 0.02, TY + dy + 0.02, IZ0, IZ0 + 0.72, M['steel_dark']))
btable = group('bunker_table', (TX, TY, IZ0), tparts)
pop(btable, T['table'])
st = [prim('cyl', 'stool_top', (TX + 0.65, TY - 0.05, IZ0 + 0.45), M['steel_dark'], radius=0.17, depth=0.04)]
for k in range(3):
    a = k * math.tau / 3
    st.append(box(f'stool_leg{k}', TX + 0.65 + math.cos(a) * 0.12 - 0.015, TX + 0.65 + math.cos(a) * 0.12 + 0.015,
                  TY - 0.05 + math.sin(a) * 0.12 - 0.015, TY - 0.05 + math.sin(a) * 0.12 + 0.015, IZ0, IZ0 + 0.44, M['steel_dark']))
stool = group('stool', (TX + 0.65, TY - 0.05, IZ0), st)
pop(stool, T['table'] + 0.2)
rz = IZ0 + 0.76
rparts = [box('radio_body', TX - 0.28, TX + 0.02, TY - 0.08, TY + 0.06, rz, rz + 0.18, M['radio'], bevel=0.015, seg=2),
          box('radio_dial', TX - 0.25, TX - 0.13, TY - 0.085, TY - 0.08, rz + 0.04, rz + 0.14, M['black']),
          prim('cyl', 'radio_knob', (TX - 0.05, TY - 0.09, rz + 0.07), M['steel'], radius=0.025, depth=0.03,
               rotation=(math.radians(90), 0, 0)),
          prim('cyl', 'radio_ant', (TX - 0.02, TY + 0.02, rz + 0.36), M['steel'], radius=0.005, depth=0.4)]
radio = group('radio', (TX - 0.13, TY, rz), rparts)
pop(radio, T['radio'])
lan = [prim('cyl', 'lantern_glass', (TX + 0.25, TY + 0.05, rz + 0.1), M['led2'], radius=0.06, depth=0.16),
       prim('cyl', 'lantern_top', (TX + 0.25, TY + 0.05, rz + 0.2), M['steel_dark'], radius=0.065, depth=0.03)]
lantern = group('lantern', (TX + 0.25, TY + 0.05, rz), lan)
pop(lantern, T['lights2'])
l2 = M['led2'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
key_socket(l2, 1, 0.0, 'CONSTANT')
key_socket(l2, F(T['lights2']) + 3, 9.0, 'CONSTANT')
ll = bpy.data.lights.new('lantern_light', 'POINT')
ll.color = (1.0, 0.7, 0.4)
ll.shadow_soft_size = 0.06
llo = link(bpy.data.objects.new('lantern_light', ll))
llo.location = (TX + 0.25, TY + 0.05, rz + 0.1)
key(ll, 'energy', 1, 0.0, interp='CONSTANT')
key(ll, 'energy', F(T['lights2']) + 3, 18.0, interp='CONSTANT')
# first aid box on the back wall above the shelf
FAX = (SX0 + SX1) / 2
fparts = [box('fa_box', FAX - 0.22, FAX + 0.22, IY1 - 0.14, IY1, IZ0 + 2.15, IZ0 + 2.47, M['firstaid'], bevel=0.015, seg=2),
          box('fa_cross_v', FAX - 0.03, FAX + 0.03, IY1 - 0.145, IY1 - 0.14, IZ0 + 2.21, IZ0 + 2.41, M['pillow']),
          box('fa_cross_h', FAX - 0.1, FAX + 0.1, IY1 - 0.145, IY1 - 0.14, IZ0 + 2.28, IZ0 + 2.34, M['pillow'])]
fa = group('first_aid', (FAX, IY1 - 0.07, IZ0 + 2.31), fparts)
pop(fa, T['firstaid'])
# steel ladder up to the hatch
LX0, LX1 = HX0 + 0.1, HX1 - 0.1
LY = IY1 - 0.12
lparts = [box('ladder_rail_l', LX0 - 0.02, LX0 + 0.02, LY - 0.02, LY + 0.02, IZ0, Z_CON + 0.05, M['steel']),
          box('ladder_rail_r', LX1 - 0.02, LX1 + 0.02, LY - 0.02, LY + 0.02, IZ0, Z_CON + 0.05, M['steel'])]
z = IZ0 + 0.3
k = 0
while z < IZ1 - 0.05:
    lparts.append(prim('cyl', f'ladder_rung{k}', ((LX0 + LX1) / 2, LY, z), M['steel'], radius=0.016,
                       depth=LX1 - LX0, rotation=(0, math.radians(90), 0)))
    z += 0.3
    k += 1
ladder = group('ladder', ((LX0 + LX1) / 2, LY, IZ0), lparts)
fld = F(T['ladder'])
key(ladder, 'location', 1, ((LX0 + LX1) / 2, LY, IZ0 - 3.2))
key(ladder, 'location', fld, ((LX0 + LX1) / 2, LY, IZ0 - 3.2))
key(ladder, 'location', fld + 14, ((LX0 + LX1) / 2, LY, IZ0))
key(ladder, 'scale', 1, (0, 0, 0), interp='CONSTANT')
key(ladder, 'scale', fld, (1, 1, 1), interp='CONSTANT')
# a mask hides the ladder while it rises through the floor slab (it starts below the slab)

# hatch: frame + heavy steel door hinged at the back edge
hf = [box('hatch_frame_f', HX0, HX1, HY0, HY0 + 0.05, Z_CON - 0.05, Z_CON + 0.005, M['steel_dark']),
      box('hatch_frame_b', HX0, HX1, HY1 - 0.05, HY1, Z_CON - 0.05, Z_CON + 0.005, M['steel_dark']),
      box('hatch_frame_l', HX0, HX0 + 0.05, HY0, HY1, Z_CON - 0.05, Z_CON + 0.005, M['steel_dark']),
      box('hatch_frame_r', HX1 - 0.05, HX1, HY0, HY1, Z_CON - 0.05, Z_CON + 0.005, M['steel_dark'])]
hframe = group('hatch_frame', ((HX0 + HX1) / 2, (HY0 + HY1) / 2, Z_CON), hf)
door_parts = [box('hatch_door', HX0 + 0.01, HX1 - 0.01, HY0 + 0.01, HY1 - 0.01, Z_CON, Z_CON + 0.04, M['steel'], bevel=0.008, seg=2),
              prim('torus', 'hatch_wheel', ((HX0 + HX1) / 2, (HY0 + HY1) / 2, Z_CON + 0.06), M['steel_dark'],
                   major_radius=0.13, minor_radius=0.014),
              box('hatch_spoke1', (HX0 + HX1) / 2 - 0.13, (HX0 + HX1) / 2 + 0.13, (HY0 + HY1) / 2 - 0.01, (HY0 + HY1) / 2 + 0.01,
                  Z_CON + 0.05, Z_CON + 0.07, M['steel_dark']),
              box('hatch_spoke2', (HX0 + HX1) / 2 - 0.01, (HX0 + HX1) / 2 + 0.01, (HY0 + HY1) / 2 - 0.13, (HY0 + HY1) / 2 + 0.13,
                  Z_CON + 0.05, Z_CON + 0.07, M['steel_dark'])]
door = group('hatch_hinge', ((HX0 + HX1) / 2, HY1 - 0.01, Z_CON + 0.02), door_parts)
fh = F(T['hatch_appear'])
pop(hframe, T['hatch_appear'] - 0.25)
OPEN = math.radians(-105)
key(door, 'rotation_euler', 1, (OPEN, 0, 0))
pop(door, T['hatch_appear'])
key(door, 'rotation_euler', F(T['hatch_close']), (OPEN, 0, 0))
set_interp('BEZIER')
# accelerate into the slam (ease-in only)
fcl0, fcl1 = F(T['hatch_close']), F(T['hatch_slam'])
for f in range(fcl0, fcl1 + 1):
    u = (f - fcl0) / (fcl1 - fcl0)
    a = OPEN * (1 - u * u)
    key(door, 'rotation_euler', f, (a, 0, 0), interp='LINEAR')
key(door, 'rotation_euler', fcl1 + 2, (math.radians(-2.5), 0, 0), interp='LINEAR')
key(door, 'rotation_euler', fcl1 + 4, (0, 0, 0), interp='LINEAR')

# ---------------------------------------------------------------- lighting + world
def area(name, loc, rot, size, size_y, energy, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = size, size_y
    ld.energy = energy
    ld.color = color
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = loc
    ob.rotation_euler = rot
    ob.visible_camera = False
    return ob


def area_at(name, loc, target, size, size_y, energy, color=(1, 1, 1)):
    d = Vector(target) - Vector(loc)
    rot = d.to_track_quat('-Z', 'Y').to_euler()
    return area(name, loc, rot, size, size_y, energy, color)


LIGHT_GAIN = float(os.environ.get('LIGHT_GAIN', '1.0'))
# raking key from the upper left brings out the soil texture on the cut face,
# a broad soft fill keeps the shadows open
area_at('front_key', (-5.0, -9.0, 5.5), (0, -2.5, -1.2), 5, 5, 900 * LIGHT_GAIN, (1.0, 0.95, 0.88))
area_at('front_fill', (2.5, -12, 0.5), (0, -2.5, -1.0), 10, 7, 500 * LIGHT_GAIN, (0.92, 0.95, 1.0))
area('room_fill', (0, -0.5, 2.6), (0, 0, 0), 5.5, 3.5, 90, (1.0, 0.88, 0.72))
area('garden_sun', (6.0, -2.0, 4.0), (math.radians(35), math.radians(40), 0), 3, 3, 400, (1.0, 0.95, 0.85))

world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
wn = world.node_tree
for n in list(wn.nodes):
    if n.type != 'OUTPUT_WORLD':
        wn.nodes.remove(n)
wout = [n for n in wn.nodes if n.type == 'OUTPUT_WORLD'][0]
bg_cam = wn.nodes.new('ShaderNodeBackground')
bg_cam.inputs['Color'].default_value = (*L((0.10, 0.105, 0.12)), 1)
bg_light = wn.nodes.new('ShaderNodeBackground')
bg_light.inputs['Color'].default_value = (0.55, 0.58, 0.65, 1)
bg_light.inputs['Strength'].default_value = 0.25
lp = wn.nodes.new('ShaderNodeLightPath')
mix = wn.nodes.new('ShaderNodeMixShader')
wn.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
wn.links.new(bg_light.outputs[0], mix.inputs[1])
wn.links.new(bg_cam.outputs[0], mix.inputs[2])
wn.links.new(mix.outputs[0], wout.inputs['Surface'])

# ---------------------------------------------------------------- camera
cam_d = bpy.data.cameras.new('cam')
cam_d.lens = 26
cam_d.sensor_fit = 'VERTICAL'
cam_d.sensor_height = 36
cam_d.clip_start = 0.1
cam_d.clip_end = 100
cam = link(bpy.data.objects.new('cam', cam_d))
scene.camera = cam
tgt = empty('cam_target')
tc = cam.constraints.new('TRACK_TO')
tc.target = tgt
tc.track_axis = 'TRACK_NEGATIVE_Z'
tc.up_axis = 'UP_Y'

CAM_KEYS = json.load(open(os.path.join(HERE, 'camera.json')))
for t, loc, look in CAM_KEYS:
    f = F(t)
    key(cam, 'location', f, tuple(loc))
    key(tgt, 'location', f, tuple(look))

# ---------------------------------------------------------------- render settings
r = scene.render
r.engine = 'CYCLES'
r.resolution_x, r.resolution_y = 720, 1280
r.resolution_percentage = 100
r.use_persistent_data = True
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGB'
r.image_settings.compression = 15
r.use_overwrite = False
r.use_placeholder = True
cy = scene.cycles
cy.device = 'CPU'
cy.samples = 8
cy.use_adaptive_sampling = False
cy.adaptive_threshold = 0.04
cy.use_denoising = True
cy.denoiser = 'OPENIMAGEDENOISE'
cy.max_bounces = 6
cy.diffuse_bounces = 3
cy.glossy_bounces = 2
cy.transmission_bounces = 4
cy.transparent_max_bounces = 6
cy.caustics_reflective = False
cy.caustics_refractive = False
cy.blur_glossy = 1.0
cy.use_light_tree = False
scene.view_settings.view_transform = 'AgX'
for look in ('AgX - Punchy', 'Punchy'):
    try:
        scene.view_settings.look = look
        break
    except Exception:
        pass
scene.view_settings.exposure = 0.0

for ob in bpy.data.objects:
    if ob.type == 'LIGHT':
        ob.visible_camera = False
        ob.visible_glossy = ob.data.type != 'AREA'
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print('SAVED', OUT_BLEND, 'objects:', len(bpy.data.objects))
