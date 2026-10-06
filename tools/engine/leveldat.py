"""Enable experiments in a Bedrock level.dat (1.21.0.26 layout).

BDS has no server.properties switch for experiments.  The world's level.dat
holds them in the compound `experiments`:

    experiments: {
        data_driven_vanilla_blocks_and_items: 1b   (written by BDS 1.21.0.26 itself)
        experiments_ever_used: 1b                  (sticky "this world used experiments")
        saved_with_toggled_experiments: 1b         (an experiment toggle was changed)
        gametest: 1b                               ("Beta APIs" toggle)
    }

The key names were taken from the strings of the 1.21.0.26 bedrock_server
binary (`experiments`, `experiments_ever_used`, `saved_with_toggled_experiments`,
`gametest`, next to the error "Plugin [%s] - requesting dependency on beta APIs
[%s], but the Beta APIs experiment is not enabled.").  The harness proves the
toggle is active by importing @minecraft/server-gametest from the test pack:
without it the server prints that error and the test pack never registers.

level.dat on disk = Int32 LE storage version + Int32 LE payload length + LE NBT.
"""
from __future__ import annotations

from pathlib import Path

import nbt

BETA_APIS_KEY = "gametest"


def enable_experiments(level_dat: Path, keys=(BETA_APIS_KEY,), extra_bytes: dict | None = None) -> dict:
    """Turn the given experiment keys on (Byte 1) and mark the world as using experiments.

    `extra_bytes` sets other top-level Byte fields (e.g. {"cheatsEnabled": 1}).
    Returns the resulting experiments compound as plain values.
    """
    version, root = nbt.read_level_dat(level_dat)
    exp = root.get("experiments")
    if not isinstance(exp, nbt.Compound):
        exp = nbt.Compound()
        root["experiments"] = exp
    for k in keys:
        exp[k] = nbt.Byte(1)
    exp["experiments_ever_used"] = nbt.Byte(1)
    exp["saved_with_toggled_experiments"] = nbt.Byte(1)
    for k, v in (extra_bytes or {}).items():
        old = root.get(k)
        root[k] = type(old)(v) if isinstance(old, (nbt.Byte, nbt.Int)) else nbt.Byte(v)
    nbt.write_level_dat(level_dat, root, version)
    return nbt.to_py(exp)


def read_experiments(level_dat: Path) -> dict:
    _, root = nbt.read_level_dat(level_dat)
    exp = root.get("experiments")
    return nbt.to_py(exp) if isinstance(exp, nbt.Compound) else {}


def read_field(level_dat: Path, key: str):
    _, root = nbt.read_level_dat(level_dat)
    v = root.get(key)
    return None if v is None else nbt.to_py(v)
