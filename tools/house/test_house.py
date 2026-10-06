#!/usr/bin/env python3
"""Unit tests for the Luxury Base generator and its validator.

    python3 -m unittest discover -s tools/house -p 'test_*.py' -v

Tests that need the vanilla reference (mojang-blocks.json) or the PocketMine source
skip with a message when those are missing (PAS_VANILLA_REF / default scratch path).
"""

from __future__ import annotations

import importlib.util
import re
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import blocks as B  # noqa: E402

REF = B.ref_dir()
PMMP = REF.parent / "pmmp-5.16.0"
HAVE_REF = (REF / "metadata" / "vanilladata_modules" / "mojang-blocks.json").exists()
HAVE_PMMP = (PMMP / "src" / "data" / "bedrock" / "block" / "convert" / "BlockStateReader.php").exists()

HAVE_NBTLIB = importlib.util.find_spec("nbtlib") is not None

# pocketmine/math 1.0.0 Facing::CLOCKWISE[Axis::Y] (github.com/pmmp/Math src/Facing.php)
PM_CLOCKWISE_Y = {"north": "east", "east": "south", "south": "west", "west": "north"}


def pm_rotate_y(f, clockwise):
    r = PM_CLOCKWISE_Y[f]
    return r if clockwise else B.OPPOSITE[r]


def php_table(src: str, func: str) -> dict[int, str]:
    """Extract `N => Facing::DIR` pairs of a BlockStateReader method."""
    m = re.search(r"function " + func + r"\(\).*?\]\);", src, re.S)
    assert m, func
    return {int(k): v.lower() for k, v in re.findall(r"(\d+)\s*=>\s*Facing::(\w+)", m.group(0))}


@unittest.skipUnless(HAVE_PMMP, f"PocketMine-MP 5.16.0 source not found at {PMMP}")
class SemanticsFromPocketMine(unittest.TestCase):
    """The orientation tables used by the generator are read back from PocketMine's PHP."""

    @classmethod
    def setUpClass(cls):
        cls.reader = (PMMP / "src/data/bedrock/block/convert/BlockStateReader.php").read_text()
        cls.helper = (PMMP / "src/data/bedrock/block/convert/BlockStateDeserializerHelper.php").read_text()
        cls.serial = (PMMP / "src/data/bedrock/block/convert/BlockObjectToStateSerializer.php").read_text()

    def test_stairs_weirdo_direction(self):
        t = php_table(self.reader, "readWeirdoHorizontalFacing")
        self.assertEqual(t, {v: k for k, v in B.WEIRDO_DIRECTION.items()})
        self.assertIn("->setFacing($in->readWeirdoHorizontalFacing())", self.helper)

    def test_trapdoor_five_minus(self):
        t = php_table(self.reader, "read5MinusHorizontalFacing")
        self.assertEqual(t, {v: k for k, v in B.TRAPDOOR_DIRECTION.items()})
        self.assertIn("->setFacing($in->read5MinusHorizontalFacing())", self.helper)

    def test_legacy_direction_beds_loom(self):
        t = php_table(self.reader, "readLegacyHorizontalFacing")
        self.assertEqual(t, {v: k for k, v in B.LEGACY_DIRECTION.items()})
        # beds and looms are written with writeLegacyHorizontalFacing
        bed = re.search(r"Blocks::BED\(\).*?\}\);", self.serial, re.S).group(0)
        self.assertIn("writeLegacyHorizontalFacing", bed)
        loom = re.search(r"Blocks::LOOM\(\).*?\}\);", self.serial, re.S).group(0)
        self.assertIn("writeLegacyHorizontalFacing", loom)

    def test_door_direction_is_ccw_of_legacy(self):
        self.assertIn("->setFacing(Facing::rotateY($in->readLegacyHorizontalFacing(), false))", self.helper)
        legacy = php_table(self.reader, "readLegacyHorizontalFacing")
        derived = {pm_rotate_y(f, False): d for d, f in legacy.items()}
        self.assertEqual(derived, B.DOOR_DIRECTION)

    def test_facing_direction_barrel(self):
        t = php_table(self.reader, "readFacingDirection")
        self.assertEqual(t, {v: k for k, v in B.FACING_DIRECTION.items()})

    def test_door_and_bed_geometry_sources(self):
        door = (PMMP / "src/block/Door.php").read_text()
        self.assertIn("trim($this->open ? Facing::rotateY($this->facing, !$this->hingeRight) : $this->facing", door)
        self.assertIn("$next = $this->getSide(Facing::rotateY($this->facing, false));", door)
        self.assertIn("$this->hingeRight = true;", door)
        bed = (PMMP / "src/block/Bed.php").read_text()
        self.assertIn("return $this->head ? Facing::opposite($this->facing) : $this->facing;", bed)
        stair = (PMMP / "src/block/Stair.php").read_text()
        self.assertIn("->trim(Facing::opposite($this->facing), 0.5);", stair)
        trap = (PMMP / "src/block/Trapdoor.php").read_text()
        self.assertIn("trim($this->open ? $this->facing : ($this->top ? Facing::DOWN : Facing::UP), 13 / 16)", trap)

    def test_block_version(self):
        data = (PMMP / "src/data/bedrock/block/BlockStateData.php").read_text()
        m = re.search(r"CURRENT_VERSION\s*=\s*\((\d+) << 24\)\s*\|.*?\((\d+) << 16\)\s*\|.*?\((\d+) << 8\)\s*\|.*?\((\d+)\);",
                      data, re.S)
        self.assertIsNotNone(m)
        major, minor, patch, rev = (int(g) for g in m.groups())
        self.assertEqual((major << 24) | (minor << 16) | (patch << 8) | rev, B.BLOCK_VERSION)
        self.assertEqual(B.BLOCK_VERSION, 18153475)


@unittest.skipUnless(HAVE_REF, f"vanilla reference not found at {REF}")
class BlockStates(unittest.TestCase):
    def test_make_rejects_incomplete_or_wrong_states(self):
        with self.assertRaises(ValueError):
            B.make("dark_oak_door", direction=1)
        with self.assertRaises(TypeError):
            B.make("lantern", hanging=1)
        with self.assertRaises(ValueError):
            B.make("cauldron", cauldron_liquid="water", fill_level=7)
        with self.assertRaises(KeyError):
            B.make("smooth_quartz")  # not a 1.21.0 block id (it is quartz_block chisel_type=smooth)

    def test_semantic_helpers(self):
        self.assertEqual(B.door("north", False, False).as_dict()["direction"], 3)
        self.assertEqual(B.bed("east", True).as_dict()["direction"], 3)
        self.assertEqual(B.stairs("dark_oak_stairs", "north").as_dict()["weirdo_direction"], 3)
        self.assertEqual(B.trapdoor("west", True).as_dict()["direction"], 1)
        self.assertEqual(B.slab("smooth_quartz_slab").name, "minecraft:stone_block_slab4")


@unittest.skipUnless(HAVE_REF and HAVE_NBTLIB, "needs the vanilla reference and nbtlib")
class Structure(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import blueprint
        cls.bp = blueprint
        cls.canvas = blueprint.build()
        cls.tmp = tempfile.TemporaryDirectory()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def write(self, canvas, name):
        import nbt_le
        path = Path(self.tmp.name) / name
        path.write_bytes(nbt_le.dumps(self.bp.to_nbt(canvas)))
        return path

    def validate(self, path):
        import validate_structure as V
        canonical = REF.parent / "bedrockdata-1.21.0" / "canonical_block_states.nbt"
        return V.validate(path, self.bp.META_PATH, REF, canonical if canonical.exists() else None)

    def test_nbt_roundtrip_types_with_nbtlib(self):
        import nbtlib
        path = self.write(self.canvas, "a.mcstructure")
        f = nbtlib.load(str(path), byteorder="little")
        self.assertIsInstance(f["format_version"], nbtlib.Int)
        self.assertEqual([int(v) for v in f["size"]], [self.bp.X, self.bp.Y, self.bp.Z])
        pal = f["structure"]["palette"]["default"]["block_palette"]
        door = next(e for e in pal if str(e["name"]) == "minecraft:dark_oak_door")
        self.assertIsInstance(door["states"]["open_bit"], nbtlib.Byte)
        self.assertIsInstance(door["states"]["direction"], nbtlib.Int)
        self.assertIsInstance(door["version"], nbtlib.Int)
        q = next(e for e in pal if str(e["name"]) == "minecraft:quartz_block")
        self.assertIsInstance(q["states"]["chisel_type"], nbtlib.String)

    def test_flat_index_order_zyx(self):
        import nbtlib
        path = self.write(self.canvas, "b.mcstructure")
        f = nbtlib.load(str(path), byteorder="little")
        layer = [int(v) for v in f["structure"]["block_indices"][0]]
        pal = f["structure"]["palette"]["default"]["block_palette"]
        Y, Z = self.bp.Y, self.bp.Z
        for (x, y, z), blk in list(self.canvas.cells.items())[::97]:
            e = pal[layer[(x * Y + y) * Z + z]]  # z fastest, then y, then x
            self.assertEqual(str(e["name"]), blk.name, (x, y, z))

    def test_generated_house_passes(self):
        path = self.write(self.canvas, "c.mcstructure")
        R = self.validate(path)
        self.assertEqual(R.errors, [])
        self.assertGreaterEqual(R.info["min_light_reachable"], 8)
        self.assertGreaterEqual(R.info["interior_doors"] + R.info["balcony_doors"], 3)

    def mutated(self, fn):
        import copy
        c = copy.deepcopy(self.canvas)
        fn(c)
        return self.validate(self.write(c, "m.mcstructure"))

    def test_validator_catches_broken_bed(self):
        foot = next(p for p, b in self.canvas.cells.items() if b.short == "bed" and not b.state("head_piece_bit"))
        R = self.mutated(lambda c: c.set(*foot, B.bed("north", False), c.entities.get(foot)))
        self.assertTrue(any("bed" in e for e in R.errors), R.errors)

    def test_validator_catches_door_without_upper_half(self):
        p = (8, 2, 11)
        R = self.mutated(lambda c: c.set(*p, B.AIR))
        self.assertTrue(any("door" in e for e in R.errors), R.errors)

    def test_validator_catches_same_hinges(self):
        R = self.mutated(lambda c: c.door_pair(9, 1, 11, "north", hinge_right=False))
        self.assertTrue(any("hinges not mirrored" in e for e in R.errors), R.errors)

    def test_validator_catches_floating_lantern(self):
        def f(c):
            c.set(3, 4, 3, B.lantern(False))  # a standing lantern in mid air
        R = self.mutated(f)
        self.assertTrue(any("lantern" in e for e in R.errors), R.errors)

    def test_validator_catches_darkness(self):
        def f(c):
            for p, b in list(c.cells.items()):
                if b.short in ("lantern", "sea_lantern", "glowstone"):
                    c.set(*p, B.simple("dark_oak_planks") if b.short != "lantern" else B.AIR)
        R = self.mutated(f)
        self.assertTrue(any("darker than 8" in e for e in R.errors), R.errors)

    def test_validator_catches_blocked_stairs(self):
        R = self.mutated(lambda c: c.set(8, 5, 5, B.quartz("smooth")) or c.set(9, 5, 5, B.quartz("smooth")))
        self.assertTrue(any("upper floor not reached" in e or "not reached" in e for e in R.errors), R.errors)

    def test_validator_catches_missing_chest_nbt(self):
        p = next(p for p, b in self.canvas.cells.items() if b.short == "chest")
        R = self.mutated(lambda c: c.entities.pop(p))
        self.assertTrue(any("no block_entity_data" in e for e in R.errors), R.errors)


if __name__ == "__main__":
    unittest.main()
