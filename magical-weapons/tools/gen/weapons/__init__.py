"""Weapon registry. Each module exposes build() -> Model and SPEC (dict)."""
import importlib

ORDER = ['flamebrand', 'frostbite', 'storm_staff', 'arcane_wand', 'shadow_dagger', 'earth_hammer', 'soul_scythe']


def load():
    return [importlib.import_module('.' + n, __name__) for n in ORDER]
