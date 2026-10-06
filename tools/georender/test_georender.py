#!/usr/bin/env python3
"""Tests for georender.  Run:  python3 tools/georender/test_georender.py
(or python3 -m pytest tools/georender).  The vanilla-integration tests are
skipped when the bedrock-samples reference is not present (env
PAS_VANILLA_REF or the default scratchpad path)."""
from __future__ import annotations

import math
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import georender as g  # noqa: E402

REF = os.environ.get(
    "PAS_VANILLA_REF",
    "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/"
    "bedrock-samples-1.21.0.26")
RP = os.path.join(REF, "resource_pack")
HAVE_REF = os.path.isdir(os.path.join(RP, "models", "entity"))


def geo_from(bones, tw=64, th=64, ident="geometry.test"):
    lib = g.GeometryLibrary()
    lib.add_data({"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": ident, "texture_width": tw, "texture_height": th},
        "bones": bones}]})
    return lib.get(ident)


def to_geo(p_rs):
    return np.array([-p_rs[0], p_rs[1], p_rs[2]])


def bone_point(geo, bone, point_geo, pose=None):
    """Where a model-space (geo) point attached to `bone` ends up (geo space)."""
    m = g.bone_matrices(geo, pose)[bone]
    p = m @ np.append(g.geo_to_rs(point_geo), 1.0)
    return to_geo(p[:3])


def pose_with(geo, **rot):
    pose = g.default_pose(geo)
    for k, r in rot.items():
        pose[k].rotation = list(r)
    return pose


class TestTransforms(unittest.TestCase):
    def setUp(self):
        self.geo = geo_from([
            {"name": "root", "pivot": [0, 10, 0]},
            {"name": "child", "parent": "root", "pivot": [0, 10, -4]},
            {"name": "leaf", "parent": "child", "pivot": [2, 10, -4]},
        ])

    def assertVec(self, a, b, tol=1e-6):
        np.testing.assert_allclose(np.asarray(a, float), np.asarray(b, float), atol=tol)

    def test_identity(self):
        self.assertVec(bone_point(self.geo, "leaf", (3, 4, 5)), (3, 4, 5))

    def test_positive_x_pitches_front_down(self):
        # a point in FRONT of the pivot (-Z) goes DOWN for +x (looking down)
        pose = pose_with(self.geo, root=(90, 0, 0))
        self.assertVec(bone_point(self.geo, "root", (0, 10, -1), pose), (0, 9, 0))
        # a point ABOVE the pivot moves to the front (-Z)
        self.assertVec(bone_point(self.geo, "root", (0, 11, 0), pose), (0, 10, -1))

    def test_positive_y_turns_front_to_entity_right(self):
        # entity's right side is -X in geometry files
        pose = pose_with(self.geo, root=(0, 90, 0))
        self.assertVec(bone_point(self.geo, "root", (0, 10, -1), pose), (-1, 10, 0))

    def test_positive_z_rolls_top_to_entity_left(self):
        pose = pose_with(self.geo, root=(0, 0, 90))
        self.assertVec(bone_point(self.geo, "root", (0, 11, 0), pose), (1, 10, 0))
        # an arm hanging down on the entity's right (-X) swings outward for +z
        pose = pose_with(self.geo, root=(0, 0, 10))
        p = bone_point(self.geo, "root", (-5, 0, 0), pose)
        self.assertLess(p[0], -5 + 1e-9 - 1.0)  # moved further to -X (outward/right)

    def test_rotation_order_x_then_y_then_z(self):
        r = (30, 40, 50)
        m = g.rot_rs(r)
        expected = g._rz(math.radians(50)) @ g._ry(math.radians(-40)) @ g._rx(math.radians(-30))
        self.assertVec(m, expected)
        # equivalently: three bones nested z(outer) <- y <- x(inner)
        geo = geo_from([
            {"name": "z", "pivot": [0, 0, 0]},
            {"name": "y", "parent": "z", "pivot": [0, 0, 0]},
            {"name": "x", "parent": "y", "pivot": [0, 0, 0]},
        ])
        pose = g.default_pose(geo)
        pose["z"].rotation = [0, 0, 50]
        pose["y"].rotation = [0, 40, 0]
        pose["x"].rotation = [30, 0, 0]
        nested = bone_point(geo, "x", (1, 2, 3), pose)
        single = geo_from([{"name": "b", "pivot": [0, 0, 0], "rotation": list(r)}])
        self.assertVec(nested, bone_point(single, "b", (1, 2, 3)))

    def test_hierarchy_rotates_children_about_parent_pivot(self):
        pose = pose_with(self.geo, root=(0, 90, 0))
        # child's pivot (0,10,-4) is 4 in front of root pivot -> ends 4 to the right
        self.assertVec(bone_point(self.geo, "child", (0, 10, -4), pose), (-4, 10, 0))
        # leaf point inherits both
        pose["child"].rotation = [90, 0, 0]
        # leaf pivot (2,10,-4): child +x rotation about (0,10,-4) leaves it (on axis line x)
        p = bone_point(self.geo, "leaf", (2, 10, -4), pose)
        self.assertVec(p, (-4, 10, -2))

    def test_animation_position_is_parent_space_offset(self):
        pose = pose_with(self.geo, root=(0, 90, 0))
        pose["child"].position = [0, 0, -2]   # 2 units toward the front, in root's frame
        p = bone_point(self.geo, "child", (0, 10, -4), pose)
        self.assertVec(p, (-6, 10, 0))

    def test_scale_about_pivot(self):
        pose = g.default_pose(self.geo)
        pose["root"].scale = [2, 2, 2]
        self.assertVec(bone_point(self.geo, "root", (0, 11, 0), pose), (0, 12, 0))

    def test_bind_pose_not_inherited(self):
        geo = geo_from([
            {"name": "body", "pivot": [0, 10, 0], "bind_pose_rotation": [90, 0, 0],
             "cubes": [{"origin": [-1, 10, -1], "size": [2, 4, 2], "uv": [0, 0]}]},
            {"name": "leg", "parent": "body", "pivot": [0, 6, 0],
             "cubes": [{"origin": [-1, 0, -1], "size": [2, 6, 2], "uv": [0, 0]}]},
        ])
        quads = g.build_mesh(geo)
        body = np.concatenate([q.verts for q in quads if q.bone == "body"])
        leg = np.concatenate([q.verts for q in quads if q.bone == "leg"])
        # body cube (y 10..14) rotated +90 about x -> lies toward the front: z -4..0
        self.assertAlmostEqual(body[:, 2].min(), -4.0)
        self.assertAlmostEqual(body[:, 1].max(), 11.0)
        # leg untouched
        self.assertAlmostEqual(leg[:, 1].min(), 0.0)
        self.assertAlmostEqual(leg[:, 1].max(), 6.0)

    def test_cube_rotation_default_pivot_is_centre(self):
        geo = geo_from([{"name": "b", "pivot": [0, 0, 0], "cubes": [
            {"origin": [-3, 4, -3], "size": [6, 8, 6], "rotation": [90, 0, 0], "uv": [0, 0]}]}])
        pts = np.concatenate([q.verts for q in g.build_mesh(geo)])
        lo, hi = pts.min(0), pts.max(0)
        np.testing.assert_allclose(lo, [-3, 5, -4], atol=1e-9)
        np.testing.assert_allclose(hi, [3, 11, 4], atol=1e-9)

    def test_inflate_and_mirror_inheritance(self):
        geo = geo_from([{"name": "b", "inflate": 0.5, "mirror": True, "cubes": [
            {"origin": [0, 0, 0], "size": [2, 2, 2], "uv": [0, 0]},
            {"origin": [0, 0, 0], "size": [2, 2, 2], "uv": [0, 0], "inflate": 0, "mirror": False}]}])
        q = g.build_mesh(geo)
        a = np.concatenate([x.verts for x in q if x.cube_index == 0])
        b = np.concatenate([x.verts for x in q if x.cube_index == 1])
        self.assertAlmostEqual(a[:, 1].max() - a[:, 1].min(), 3.0)
        self.assertAlmostEqual(b[:, 1].max() - b[:, 1].min(), 2.0)


class TestUV(unittest.TestCase):
    """UV layout + face orientation, end to end through the rasteriser."""

    @staticmethod
    def texel_texture(w, h):
        tex = np.zeros((h, w, 4), np.uint8)
        for v in range(h):
            for u in range(w):
                tex[v, u] = (u * 25 + 5, v * 50 + 5, 200, 255)
        return tex

    @staticmethod
    def decode(px):
        r, gch = int(px[0]), int(px[1])
        return (round((r - 5) / 25), round((gch - 5) / 50))

    def render_face(self, geo, tex, view, **flags):
        layer = g.Layer(geo, tex, **flags)
        cam = g.Camera.view(view, ortho=True, margin=0.0)
        img = g.render(layer, cam, size=40, supersample=1, shading=False)
        return np.asarray(img)

    def quadrants(self, arr):
        H, W = arr.shape[:2]
        pick = lambda fx, fy: self.decode(arr[int(fy * H), int(fx * W)])  # noqa: E731
        return {"tl": pick(0.25, 0.25), "tr": pick(0.75, 0.25),
                "bl": pick(0.25, 0.75), "br": pick(0.75, 0.75)}

    def test_box_uv_rects_1x1x1(self):
        r = g.box_uv_rects((1, 1, 1), (0, 0))
        self.assertEqual(r["east"], (0, 1, 1, 2))
        self.assertEqual(r["north"], (1, 1, 2, 2))
        self.assertEqual(r["west"], (2, 1, 3, 2))
        self.assertEqual(r["south"], (3, 1, 4, 2))
        self.assertEqual(r["up"], (2, 1, 1, 0))      # (u0,v0)->(u1,v1): reversed
        self.assertEqual(r["down"], (3, 0, 2, 1))

    def test_box_uv_1x1x1_which_face_where(self):
        tex = self.texel_texture(4, 2)
        geo = geo_from([{"name": "b", "cubes": [{"origin": [-0.5, 0, -0.5], "size": [1, 1, 1], "uv": [0, 0]}]}],
                       tw=4, th=2)
        expect = {"front": (1, 1), "right": (0, 1), "left": (2, 1), "back": (3, 1),
                  "top": (1, 0), "bottom": (2, 0)}
        for view, texel in expect.items():
            arr = self.render_face(geo, tex, view)
            self.assertEqual(self.decode(arr[20, 20]), texel, view)

    def test_box_uv_2x2x2_orientation_in_each_face(self):
        tex = self.texel_texture(8, 4)
        geo = geo_from([{"name": "b", "cubes": [{"origin": [-1, 0, -1], "size": [2, 2, 2], "uv": [0, 0]}]}],
                       tw=8, th=4)
        expect = {
            # front: texture as painted (u right, v down)
            "front": {"tl": (2, 2), "tr": (3, 2), "bl": (2, 3), "br": (3, 3)},
            # entity's right flank: back of the mob on the image left
            "right": {"tl": (0, 2), "tr": (1, 2), "bl": (0, 3), "br": (1, 3)},
            "left": {"tl": (4, 2), "tr": (5, 2), "bl": (4, 3), "br": (5, 3)},
            "back": {"tl": (6, 2), "tr": (7, 2), "bl": (6, 3), "br": (7, 3)},
            # top view: mob's front at the image bottom, its right on the image left
            "top": {"tl": (2, 0), "tr": (3, 0), "bl": (2, 1), "br": (3, 1)},
            # bottom view: mob's front at the image top, its right on the image left
            "bottom": {"tl": (4, 1), "tr": (5, 1), "bl": (4, 0), "br": (5, 0)},
        }
        for view, q in expect.items():
            self.assertEqual(self.quadrants(self.render_face(geo, tex, view)), q, view)

    def test_box_uv_mirror(self):
        tex = self.texel_texture(8, 4)
        geo = geo_from([{"name": "b", "cubes": [{"origin": [-1, 0, -1], "size": [2, 2, 2], "uv": [0, 0],
                                                 "mirror": True}]}], tw=8, th=4)
        self.assertEqual(self.quadrants(self.render_face(geo, tex, "front")),
                         {"tl": (3, 2), "tr": (2, 2), "bl": (3, 3), "br": (2, 3)})
        # mirrored: the entity's RIGHT flank now shows the (flipped) west strip
        self.assertEqual(self.quadrants(self.render_face(geo, tex, "right")),
                         {"tl": (5, 2), "tr": (4, 2), "bl": (5, 3), "br": (4, 3)})

    def test_per_face_uv_and_negative_size(self):
        tex = self.texel_texture(8, 4)
        uv = {"north": {"uv": [0, 0], "uv_size": [2, 2]},
              "east": {"uv": [4, 0], "uv_size": [-2, 2]},      # horizontally flipped
              "up": {"uv": [4, 2], "uv_size": [2, 2]},
              "south": {"uv": [2, 4], "uv_size": [2, -2]}}     # vertically flipped: rows 3 -> 2
        geo = geo_from([{"name": "b", "cubes": [{"origin": [-1, 0, -1], "size": [2, 2, 2], "uv": uv}]}],
                       tw=8, th=4)
        self.assertEqual(self.quadrants(self.render_face(geo, tex, "front")),
                         {"tl": (0, 0), "tr": (1, 0), "bl": (0, 1), "br": (1, 1)})
        self.assertEqual(self.quadrants(self.render_face(geo, tex, "right")),
                         {"tl": (3, 0), "tr": (2, 0), "bl": (3, 1), "br": (2, 1)})
        self.assertEqual(self.quadrants(self.render_face(geo, tex, "back")),
                         {"tl": (2, 3), "tr": (3, 3), "bl": (2, 2), "br": (3, 2)})
        # per-face up with positive size: uv origin = mob's back-right corner
        self.assertEqual(self.quadrants(self.render_face(geo, tex, "top")),
                         {"tl": (4, 2), "tr": (5, 2), "bl": (4, 3), "br": (5, 3)})
        # faces missing from the uv object are not drawn
        arr = self.render_face(geo, tex, "left", two_sided=False)
        self.assertEqual(int(arr[20, 20, 3]), 0)

    def test_box_uv_equals_explicit_per_face(self):
        """box UV == per-face UV with the documented equivalent rects."""
        tex = self.texel_texture(8, 4)
        box = geo_from([{"name": "b", "cubes": [{"origin": [-1, 0, -1], "size": [2, 2, 2], "uv": [0, 0]}]}], 8, 4)
        pf = {"north": {"uv": [2, 2], "uv_size": [2, 2]}, "east": {"uv": [0, 2], "uv_size": [2, 2]},
              "south": {"uv": [6, 2], "uv_size": [2, 2]}, "west": {"uv": [4, 2], "uv_size": [2, 2]},
              "up": {"uv": [2, 0], "uv_size": [2, 2]}, "down": {"uv": [4, 2], "uv_size": [2, -2]}}
        per = geo_from([{"name": "b", "cubes": [{"origin": [-1, 0, -1], "size": [2, 2, 2], "uv": pf}]}], 8, 4)
        for view in ("front", "right", "left", "back", "top", "bottom", "iso"):
            a = self.render_face(box, tex, view)
            b = self.render_face(per, tex, view)
            np.testing.assert_array_equal(a, b, err_msg=view)

    def test_alpha_test_and_emissive(self):
        tex = self.texel_texture(4, 2)
        tex[1, 1, 3] = 10            # the north texel is nearly transparent
        geo = geo_from([{"name": "b", "cubes": [{"origin": [-0.5, 0, -0.5], "size": [1, 1, 1], "uv": [0, 0]}]}], 4, 2)
        arr = self.render_face(geo, tex, "front", two_sided=False)
        self.assertEqual(int(arr[20, 20, 3]), 0)                 # discarded, nothing behind
        arr = self.render_face(geo, tex, "front", two_sided=True)
        self.assertEqual(self.decode(arr[20, 20]), (3, 1))     # inside of the back face shows
        arr = self.render_face(geo, tex, "front", emissive_alpha=True, alpha_test=False)
        self.assertEqual(int(arr[20, 20, 3]), 255)               # emissive: drawn opaque


class TestMolang(unittest.TestCase):
    def ev(self, s, **q):
        ctx = g.MolangContext()
        ctx.queries.update(q)
        return g.Molang(s).eval(ctx)

    def test_arithmetic(self):
        self.assertEqual(self.ev("1 + 2 * 3"), 7)
        self.assertEqual(self.ev("(1 + 2) * 3"), 9)
        self.assertEqual(self.ev("-2 * -3"), 6)
        self.assertEqual(self.ev("10 - 4 - 3"), 3)
        self.assertEqual(self.ev("8 / 4 / 2"), 1)
        self.assertEqual(self.ev("1 / 0"), 0)
        self.assertEqual(self.ev("-(3 + 1)"), -4)
        self.assertEqual(self.ev(".5 + 1.5"), 2)

    def test_logic_and_ternary(self):
        self.assertEqual(self.ev("1 < 2 && 3 >= 3"), 1)
        self.assertEqual(self.ev("1 > 2 || 0"), 0)
        self.assertEqual(self.ev("!0"), 1)
        self.assertEqual(self.ev("2 == 2 ? 10 : 20"), 10)
        self.assertEqual(self.ev("0 ? 1 : 0 ? 2 : 3"), 3)       # right associative
        self.assertEqual(self.ev("1 ? 5"), 5)
        self.assertEqual(self.ev("0 ? 5"), 0)
        self.assertEqual(self.ev("1 + 1 == 2"), 1)
        self.assertEqual(self.ev("'abc' == 'abc'"), 1)
        self.assertEqual(self.ev("'abc' != 'abd'"), 1)

    def test_math_degrees(self):
        self.assertAlmostEqual(self.ev("math.sin(90)"), 1)
        self.assertAlmostEqual(self.ev("math.cos(180)"), -1)
        self.assertAlmostEqual(self.ev("Math.Cos(0) * 80"), 80)     # case-insensitive
        self.assertAlmostEqual(self.ev("math.pi"), math.pi)
        self.assertEqual(self.ev("math.abs(-3)"), 3)
        self.assertEqual(self.ev("math.clamp(5, 0, 2)"), 2)
        self.assertEqual(self.ev("math.lerp(0, 10, 0.25)"), 2.5)
        self.assertEqual(self.ev("math.min(3, 4) + math.max(3, 4)"), 7)
        self.assertEqual(self.ev("math.floor(1.7) + math.ceil(1.2) + math.round(2.5)"), 1 + 2 + 3)
        self.assertEqual(self.ev("math.sqrt(16)"), 4)
        self.assertEqual(self.ev("math.mod(7, 3)"), 1)
        self.assertAlmostEqual(self.ev("math.atan2(1, 1)"), 45)

    def test_queries_and_aliases(self):
        self.assertEqual(self.ev("query.anim_time * 2", anim_time=3), 6)
        self.assertEqual(self.ev("q.anim_time + q.life_time", anim_time=1, life_time=2), 3)
        self.assertAlmostEqual(self.ev("math.cos(query.anim_time * 38.17) * 80.0", anim_time=0), 80)
        self.assertEqual(self.ev("q.is_baby ? 0.5 : 1", is_baby=1), 0.5)
        self.assertEqual(self.ev("query.unknown_thing + 2"), 2)        # unknown -> 0
        ctx = g.MolangContext()
        g.Molang("q.nope + v.nope + c.nope").eval(ctx)
        self.assertIn("query.nope", ctx.missing)
        self.assertIn("variable.nope", ctx.missing)

    def test_variables_temps_and_complex(self):
        ctx = g.MolangContext()
        ctx.variables["x"] = 2
        self.assertEqual(g.Molang("v.x * variable.x").eval(ctx), 4)
        self.assertEqual(g.Molang("v.y = 3; t.z = v.y + 1; return t.z * 2;").eval(ctx), 8)
        self.assertEqual(ctx.variables["y"], 3)
        self.assertEqual(g.Molang("v.y = 5;").eval(ctx), 0)            # complex without return -> 0
        self.assertEqual(g.Molang("v.k = 0; loop(4, {v.k = v.k + 1;}); return v.k;").eval(ctx), 4)
        self.assertEqual(g.Molang("v.missing ?? 7").eval(ctx), 7)
        self.assertEqual(g.Molang("90 - this").eval(ctx, this=30), 60)
        self.assertEqual(g.Molang("context.other").eval(ctx), 0)

    def test_frame_context_overrides(self):
        ctx = g.frame_context(2.0, {"modified_distance_moved": "t*4", "q.modified_move_speed": 1})
        self.assertEqual(ctx.queries["modified_distance_moved"], 8)
        self.assertEqual(ctx.queries["modified_move_speed"], 1)
        self.assertEqual(ctx.queries["life_time"], 2)


class TestAnimation(unittest.TestCase):
    def setUp(self):
        self.geo = geo_from([{"name": "leg", "pivot": [0, 12, 0], "rotation": [10, 0, 0]},
                             {"name": "arm", "pivot": [5, 22, 0]},
                             {"name": "hand", "parent": "arm", "pivot": [5, 12, 0]}])

    def anim(self, d, name="a"):
        return g.Animation.parse(name, d)

    def test_static_expression_and_this(self):
        a = self.anim({"loop": True, "bones": {"leg": {"rotation": ["90 - this", 0, 0]}}})
        pose = g.compute_pose(self.geo, [g.Play(a)], 0.0)
        self.assertAlmostEqual(pose["leg"].rotation[0], 90)          # "X - this" sets the value

    def test_keyframes_linear_pre_post_and_loop(self):
        a = self.anim({"loop": True, "animation_length": 2.0, "bones": {"leg": {"rotation": {
            "0.0": [0, 0, 0], "1.0": {"pre": [40, 0, 0], "post": [100, 0, 0]}, "2.0": [0, 0, 0]}}}})
        at = lambda t: g.compute_pose(self.geo, [g.Play(a)], t)["leg"].rotation[0] - 10  # noqa: E731
        self.assertAlmostEqual(at(0.5), 20)
        self.assertAlmostEqual(at(0.999999), 40, places=3)
        self.assertAlmostEqual(at(1.0), 100)
        self.assertAlmostEqual(at(1.5), 50)
        self.assertAlmostEqual(at(2.5), 20)        # looped

    def test_catmullrom(self):
        a = self.anim({"bones": {"leg": {"position": {
            "0": {"post": [0, 0, 0], "lerp_mode": "catmullrom"},
            "1": {"post": [0, 10, 0], "lerp_mode": "catmullrom"},
            "2": {"post": [0, 0, 0], "lerp_mode": "catmullrom"}}}}})
        y = g.compute_pose(self.geo, [g.Play(a)], 0.5)["leg"].position[1]
        self.assertGreater(y, 5.0)     # smooth curve overshoots the straight line
        self.assertAlmostEqual(g.compute_pose(self.geo, [g.Play(a)], 1.0)["leg"].position[1], 10)

    def test_additive_and_weights(self):
        a = self.anim({"bones": {"leg": {"rotation": [5, 0, 0], "scale": 2}}}, "a")
        b = self.anim({"bones": {"leg": {"rotation": [7, 1, 0], "scale": [1, 3, 1]}}}, "b")
        pose = g.compute_pose(self.geo, [g.Play(a), g.Play(b, 0.5)], 0.0)
        self.assertEqual(pose["leg"].rotation, [10 + 5 + 3.5, 0.5, 0])
        self.assertEqual(pose["leg"].scale, [2, 2 * 2, 2])
        pose = g.compute_pose(self.geo, [g.Play(a, "q.modified_move_speed")], 0.0,
                              queries={"modified_move_speed": 0})
        self.assertEqual(pose["leg"].rotation[0], 10)

    def test_anim_time_update_and_walk(self):
        walk = self.anim({"anim_time_update": "query.modified_distance_moved", "loop": True,
                          "bones": {"leg": {"rotation": ["math.cos(query.anim_time * 38.17) * 80.0", 0, 0]}}})
        q = {"modified_distance_moved": "t*4"}
        r0 = g.compute_pose(self.geo, [g.Play(walk)], 0.0, q)["leg"].rotation[0]
        r1 = g.compute_pose(self.geo, [g.Play(walk)], 0.5, q)["leg"].rotation[0]
        self.assertAlmostEqual(r0, 10 + 80)
        self.assertAlmostEqual(r1, 10 + 80 * math.cos(math.radians(2 * 38.17)))
        default = self.anim({"anim_time_update": "query.anim_time + query.delta_time",
                             "bones": {"leg": {"position": ["query.anim_time", 0, 0]}}})
        self.assertAlmostEqual(g.compute_pose(self.geo, [g.Play(default)], 1.0)["leg"].position[0], 1.0, places=6)

    def test_position_this_is_joint_offset(self):
        a = self.anim({"bones": {"arm": {"position": ["5 - this", "-2 - this", "-this"]},
                                 "hand": {"position": [0, "-10 - this", 0]}}})
        pose = g.compute_pose(self.geo, [g.Play(a)], 0.0)
        self.assertEqual(pose["arm"].position, [0, 0, 0])     # root: pivot - (0,24,0) = (5,-2,0)
        self.assertEqual(pose["hand"].position, [0, 0, 0])    # child: pivot - parent pivot = (0,-10,0)
        pose = g.compute_pose(self.geo, [g.Play(a)], 0.0, position_this="zero")
        self.assertEqual(pose["arm"].position, [5, -2, 0])

    def test_override_previous(self):
        a = self.anim({"bones": {"leg": {"rotation": [30, 0, 0]}}})
        b = self.anim({"override_previous_animation": True, "bones": {"leg": {"rotation": [1, 0, 0]}}})
        self.assertEqual(g.compute_pose(self.geo, [g.Play(a), g.Play(b)])["leg"].rotation[0], 11)


class TestLoader(unittest.TestCase):
    def test_legacy_inheritance_and_comments(self):
        text = """{
          // comment
          "format_version": "1.8.0",
          "geometry.base": {"texturewidth": 64, "textureheight": 32, "bones": [
            {"name": "body", "pivot": [0, 1, 0], "bind_pose_rotation": [90, 0, 0],
             "cubes": [{"origin": [0, 0, 0], "size": [1, 1, 1], "uv": [0, 0]}]},
            {"name": "hat", "neverRender": true, "cubes": [{"origin": [0, 0, 0], "size": [1, 1, 1]}]},
          ]},
          "geometry.child:geometry.base": {"bones": [
            {"name": "BODY", "cubes": [{"origin": [0, 0, 0], "size": [2, 2, 2], "uv": [0, 8], "inflate": 1}]},
            {"name": "hat", "reset": true, "neverRender": false, "cubes": [{"origin": [5, 5, 5], "size": [1, 1, 1]}]},
            {"name": "extra", "parent": "body"}
          ]}
        }"""
        warnings = []
        data = g.load_json(text, is_text=True, warnings=warnings)
        self.assertTrue(warnings)
        lib = g.GeometryLibrary()
        lib.add_data(data)
        child = lib.get("geometry.child")
        self.assertEqual((child.texture_width, child.texture_height), (64, 32))
        body = child.bone("body")
        self.assertEqual(len(body.cubes), 2)                      # appended, not replaced
        self.assertEqual(body.bind_pose_rotation, (90, 0, 0))     # inherited field
        hat = child.bone("hat")
        self.assertEqual(len(hat.cubes), 1)                       # reset dropped parent cubes
        self.assertFalse(hat.never_render)
        self.assertIsNotNone(child.bone("extra"))
        base = lib.get("geometry.base")
        self.assertTrue(base.bone("hat").never_render)
        self.assertEqual(len([q for q in g.build_mesh(base) if q.bone == "hat"]), 0)

    def test_default_texture_size(self):
        lib = g.GeometryLibrary()
        lib.add_data({"format_version": "1.8.0", "geometry.x": {"bones": []}})
        self.assertEqual((lib.get().texture_width, lib.get().texture_height), (64, 64))


@unittest.skipUnless(HAVE_REF, f"bedrock-samples reference not found at {REF}")
class TestVanilla(unittest.TestCase):
    def test_all_vanilla_geometries_build(self):
        lib = g.GeometryLibrary()
        lib.add_dir(os.path.join(RP, "models"))
        self.assertGreater(len(lib.ids()), 150)
        for gid in lib.ids():
            g.build_mesh(lib.get(gid))

    def test_all_vanilla_animations_parse(self):
        lib = g.load_animations(os.path.join(RP, "animations"))
        self.assertGreater(len(lib.anims), 400)
        self.assertEqual([w for w in lib.warnings if "leniently" not in w], [])

    def test_cow_layout(self):
        lib = g.load_geometries(os.path.join(RP, "models", "entity", "cow.geo.json"))
        geo = lib.get("geometry.cow.v1.8")
        quads = g.build_mesh(geo)
        to_g = lambda q: np.c_[-q.verts[:, 0], q.verts[:, 1:]]  # noqa: E731
        body = np.concatenate([to_g(q) for q in quads if q.bone == "body"])
        head = np.concatenate([to_g(q) for q in quads if q.bone == "head"])
        legs = np.concatenate([to_g(q) for q in quads if q.bone.startswith("leg")])
        self.assertLess(head[:, 2].max(), body[:, 2].min() + 1e-6 + 2)   # head in front (-Z)
        self.assertGreaterEqual(body[:, 1].min(), 11 - 1e-6)            # body above the legs
        self.assertAlmostEqual(legs[:, 1].min(), 0)
        # udder (2nd body cube) hangs under the REAR of the body
        udder = np.concatenate([to_g(q) for q in quads if q.bone == "body" and q.cube_index == 1])
        self.assertGreater(udder[:, 2].min(), 0)
        self.assertLess(udder[:, 1].max(), 12 + 1e-6)

    def test_spider_default_leg_pose(self):
        rp = g.ResourcePack([RP])
        layers, plays, variables, notes = g.entity_layers(rp, "minecraft:spider")
        geo = layers[0].geometry
        pose = g.compute_pose(geo, plays, 0.0, variables=variables)
        leg0 = geo.bone("leg0")      # rear leg on the entity's RIGHT (-X)
        tip = bone_point(geo, "leg0", (leg0.cubes[0].origin[0], 9, leg0.pivot[2]), pose)
        self.assertLess(tip[0], -4)          # still on the right side
        self.assertGreater(tip[2], leg0.pivot[2])   # points backward
        self.assertLess(tip[1], 9)           # and down

    def test_cow_front_view_shows_face(self):
        lib = g.load_geometries(os.path.join(RP, "models", "entity", "cow.geo.json"))
        tex = g.load_texture(os.path.join(RP, "textures", "entity", "cow", "cow"))
        layer = g.Layer(lib.get("geometry.cow.v1.8"), tex)
        info = {}
        img = np.asarray(g.render(layer, g.Camera.view("front", ortho=True), size=128, supersample=1,
                                  shading=False, info=info))
        # the head's north face (uv 6..14 x 6..14) must be what we see in the head area
        face = tex[6:14, 6:14, :3].reshape(-1, 3)
        ys, xs = np.nonzero(img[..., 3])
        top = ys.min()
        head_px = img[top + 12:top + 30, 50:78, :3].reshape(-1, 3)
        hits = np.mean([any((np.abs(face.astype(int) - p).sum(1) == 0)) for p in head_px])
        self.assertGreater(hits, 0.9)


if __name__ == "__main__":
    unittest.main(verbosity=2)
