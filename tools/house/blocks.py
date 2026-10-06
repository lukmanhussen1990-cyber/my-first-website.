"""Block-state helpers for the Luxury Base generator.

Every helper returns a :class:`Block` whose ``states`` dict holds the FULL set of
block properties that ``mojang-blocks.json`` (bedrock-samples v1.21.0.26-preview)
lists for that block, with Python types that map 1:1 onto NBT tag types:

    bool -> TAG_Byte, int -> TAG_Int, str -> TAG_String

Orientation semantics (derived from PocketMine-MP 5.16.0, see docs/HOUSE.md):

* "facing" below always means a PocketMine ``Facing`` (north/south/west/east).
* doors      ``direction``        : facing->int {east:0, south:1, west:2, north:3}
                                   (BlockStateDeserializerHelper::decodeDoor =
                                   Facing::rotateY(readLegacyHorizontalFacing(), ccw)).
                                   facing = direction the placing player looked;
                                   the closed panel lies on the side OPPOSITE to
                                   facing (Door::recalculateCollisionBoxes trims the
                                   facing face by 0.8175).  door_hinge_bit = hinge on
                                   the right-hand side of a viewer looking along
                                   facing (Door::place sets hingeRight when the
                                   left neighbour is a door -> mirrored double doors).
* beds       ``direction``        : legacy {south:0, west:1, north:2, east:3};
                                   head = foot + facing (Bed::getOtherHalfSide).
* stairs     ``weirdo_direction`` : {east:0, west:1, south:2, north:3}; facing = the
                                   side of the tall half = direction you walk UP
                                   (Stair::recalculateCollisionBoxes).
* trapdoors  ``direction``        : "5 minus" {east:0, west:1, south:2, north:3};
                                   open panel lies against the face OPPOSITE to
                                   facing (Trapdoor::recalculateCollisionBoxes);
                                   upside_down_bit = closed panel in the top half.
* fence gate / loom ``direction`` : legacy {south:0, west:1, north:2, east:3}.
* chest/furnace/smoker/blast_furnace/stonecutter_block/lectern
             ``minecraft:cardinal_direction`` : facing name = the side the front
                                   faces (FacesOppositePlacingPlayerTrait).
* barrel     ``facing_direction`` : {down:0, up:1, north:2, south:3, west:4, east:5}
                                   = side the lid faces (AnyFacingTrait).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

DEFAULT_REF = (
    "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/"
    "scratchpad/ref/bedrock-samples-1.21.0.26"
)

#: Block palette version for 1.21.0 (= 1.21.0.3, PocketMine BlockStateData::CURRENT_VERSION).
BLOCK_VERSION = (1 << 24) | (21 << 16) | (0 << 8) | 3  # 18153475

FACINGS = ("north", "south", "west", "east")
OFFSET = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}
OPPOSITE = {"north": "south", "south": "north", "west": "east", "east": "west"}
# PocketMine Facing::rotateY(f, clockwise=true): N->E->S->W->N (seen from above)
CW = {"north": "east", "east": "south", "south": "west", "west": "north"}
CCW = {v: k for k, v in CW.items()}

DOOR_DIRECTION = {"east": 0, "south": 1, "west": 2, "north": 3}
LEGACY_DIRECTION = {"south": 0, "west": 1, "north": 2, "east": 3}  # beds, fence gates, loom
WEIRDO_DIRECTION = {"east": 0, "west": 1, "south": 2, "north": 3}  # stairs
TRAPDOOR_DIRECTION = {"east": 0, "west": 1, "south": 2, "north": 3}  # "5 minus" mapping
FACING_DIRECTION = {"down": 0, "up": 1, "north": 2, "south": 3, "west": 4, "east": 5}

DYE = {  # PocketMine DyeColorIdMap (bed colour byte)
    "white": 0, "orange": 1, "magenta": 2, "light_blue": 3, "yellow": 4, "lime": 5,
    "pink": 6, "gray": 7, "light_gray": 8, "cyan": 9, "purple": 10, "blue": 11,
    "brown": 12, "green": 13, "red": 14, "black": 15,
}


def ref_dir() -> Path:
    return Path(os.environ.get("PAS_VANILLA_REF", DEFAULT_REF))


@lru_cache(maxsize=1)
def vanilla_blocks() -> dict[str, dict[str, tuple[str, list]]]:
    """name -> {property: (type, [allowed values])} from mojang-blocks.json."""
    path = ref_dir() / "metadata" / "vanilladata_modules" / "mojang-blocks.json"
    data = json.loads(path.read_text())
    props = {p["name"]: (p["type"], [v["value"] for v in p["values"]]) for p in data["block_properties"]}
    out: dict[str, dict[str, tuple[str, list]]] = {}
    for item in data["data_items"]:
        out[item["name"]] = {p["name"]: props[p["name"]] for p in item.get("properties", [])}
    return out


@dataclass(frozen=True)
class Block:
    name: str
    states: tuple = ()  # sorted tuple of (key, value)

    @property
    def short(self) -> str:
        return self.name.split(":", 1)[1]

    def state(self, key):
        return dict(self.states)[key]

    def as_dict(self) -> dict:
        return dict(self.states)


@dataclass
class BlockEntity:
    """block_entity_data compound (python values typed via nbt_le.Tag wrappers)."""
    data: dict = field(default_factory=dict)


def make(name: str, **states) -> Block:
    """Create a block with an exactly-complete, validated state set."""
    if ":" not in name:
        name = "minecraft:" + name
    states = {k.replace("__", ":"): v for k, v in states.items()}
    spec = vanilla_blocks().get(name)
    if spec is None:
        raise KeyError(f"unknown block {name} for 1.21.0.26")
    missing = set(spec) - set(states)
    extra = set(states) - set(spec)
    if missing or extra:
        raise ValueError(f"{name}: missing states {sorted(missing)} extra {sorted(extra)}")
    for key, value in states.items():
        typ, allowed = spec[key]
        pytype = {"bool": bool, "int": int, "string": str}[typ]
        if type(value) is not pytype:
            raise TypeError(f"{name}.{key}: expected {typ}, got {type(value).__name__}")
        if value not in allowed:
            raise ValueError(f"{name}.{key}={value!r} not in {allowed}")
    return Block(name, tuple(sorted(states.items())))


# ---------------------------------------------------------------- simple blocks
def simple(name: str) -> Block:
    return make(name)


AIR = make("air")


def quartz(kind: str = "smooth", axis: str = "y") -> Block:
    """kind: default (plain block), smooth, lines (pillar), chiseled."""
    return make("quartz_block", chisel_type=kind, pillar_axis=axis)


def log(name: str = "dark_oak_log", axis: str = "y") -> Block:
    return make(name, pillar_axis=axis)


def slab(name: str, top: bool = False) -> Block:
    if name == "smooth_quartz_slab":
        return make("stone_block_slab4", stone_slab_type_4="smooth_quartz",
                    minecraft__vertical_half="top" if top else "bottom")
    return make(name, minecraft__vertical_half="top" if top else "bottom")


def stairs(name: str, up: str, upside_down: bool = False) -> Block:
    """``up`` = horizontal direction a player walks to ascend (tall half side)."""
    return make(name, weirdo_direction=WEIRDO_DIRECTION[up], upside_down_bit=upside_down)


def door(facing: str, hinge_right: bool, upper: bool, name: str = "dark_oak_door", open_: bool = False) -> Block:
    return make(name, direction=DOOR_DIRECTION[facing], door_hinge_bit=hinge_right,
                open_bit=open_, upper_block_bit=upper)


def trapdoor(facing: str, open_: bool, top: bool = False, name: str = "dark_oak_trapdoor") -> Block:
    return make(name, direction=TRAPDOOR_DIRECTION[facing], open_bit=open_, upside_down_bit=top)


def bed(facing: str, head: bool) -> Block:
    return make("bed", direction=LEGACY_DIRECTION[facing], head_piece_bit=head, occupied_bit=False)


def cardinal(name: str, facing: str) -> Block:
    return make(name, minecraft__cardinal_direction=facing)


def anvil(facing: str) -> Block:
    return make("anvil", damage="undamaged", minecraft__cardinal_direction=facing)


def loom(facing: str) -> Block:
    return make("loom", direction=LEGACY_DIRECTION[facing])


def barrel(facing: str) -> Block:
    return make("barrel", facing_direction=FACING_DIRECTION[facing], open_bit=False)


def lantern(hanging: bool) -> Block:
    return make("lantern", hanging=hanging)


def cauldron_water() -> Block:
    return make("cauldron", cauldron_liquid="water", fill_level=6)


def flower_pot() -> Block:
    return make("flower_pot", update_bit=False)


def leaves(name: str = "azalea_leaves") -> Block:
    return make(name, persistent_bit=True, update_bit=False)


def fence_gate(facing: str, open_: bool = False, name: str = "dark_oak_fence_gate") -> Block:
    return make(name, direction=LEGACY_DIRECTION[facing], in_wall_bit=False, open_bit=open_)


def block_ref(block: Block) -> dict:
    """{name, states, version} compound as python dict (used for item Block / PlantBlock tags)."""
    return {"name": block.name, "states": block.as_dict(), "version": BLOCK_VERSION}
