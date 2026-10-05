#!/usr/bin/env python3
"""Self-check of the test suite: every deliberately broken copy of main.js must make
tools/test_script.mjs (or the API verification it embeds) fail.

    python3 tools/typecheck/mutation_check.py [--out results/mutation_check.txt]

A "SURVIVED" line means the suite cannot see that class of bug and must be strengthened.
Mutants are written to a temp directory; main.js itself is never modified.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ADDON = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ADDON, "SCP096_BP", "scripts", "main.js")
TEST = os.path.join(ADDON, "tools", "test_script.mjs")
base = open(SRC, encoding="utf-8").read()


def sub(old, new, count=1):
    assert old in base, "pattern not found: " + old[:60]
    return base.replace(old, new, count)


MUTANTS = {
    "M01 obsidian allowed and no longer denied": lambda: sub(
        '"bedrock", "invisible_bedrock", "obsidian", "crying_obsidian",',
        '"bedrock", "invisible_bedrock", "crying_obsidian",',
    ).replace('"_obsidian"', '"_obsidianX"').replace("const MISC = [", 'const MISC = [\n  "obsidian",'),
    "M02 probe height 4": lambda: sub("height: 3,", "height: 4,"),
    "M03 mobGriefing ignored": lambda: sub("return rules.mobGriefing !== false;", "return true;"),
    "M04 digs the floor (starts one block low)": lambda: sub(
        "for (let dy = 0; dy < PROBE.height; dy++) {\n        cells.push({ x: cx, y: baseY + dy,",
        "for (let dy = -1; dy < PROBE.height - 1; dy++) {\n        cells.push({ x: cx, y: baseY + dy,",
    ),
    "M05 no per-entity / per-pass cap": lambda: sub("maxBreaksPerEntity: 12,", "maxBreaksPerEntity: 1000,").replace(
        "maxBreaksPerPass: 36,", "maxBreaksPerPass: 100000,"
    ),
    "M06 console.warn on every failure": lambda: sub(
        "  if (warnedKinds.has(kind)) return;\n  warnedKinds.add(kind);\n", ""
    ),
    "M07 reads Entity.target (not in 1.11.0)": lambda: sub(
        "    if (!entity.isValid()) return false;", "    if (!entity.isValid()) return false;\n    void entity.target;"
    ),
    "M08 setblock mode replace instead of destroy": lambda: sub("${cell.z} air destroy`", "${cell.z} air replace`"),
    "M09 clears the lane BEHIND the entity": lambda: sub(
        "if (!(forward > PROBE.minForward && forward <= PROBE.maxForward)) continue;",
        "if (!(-forward > PROBE.minForward && -forward <= PROBE.maxForward)) continue;",
    ),
    "M10 the_end not processed": lambda: sub('["overworld", "nether", "the_end"]', '["overworld", "nether"]'),
    "M11 any variant >= 2 counts as rage": lambda: sub("variant.value === RAGE_RUN_VARIANT", "variant.value >= 2"),
    "M12 box 5 wide": lambda: sub("halfWidth: 1.5,", "halfWidth: 2.5,"),
    "M13 box 4 deep": lambda: sub("maxForward: 2.5,", "maxForward: 4,"),
    "M14 unloaded-chunk errors are logged": lambda: sub(
        'if (!isBenignWorldError(err)) warnOnce("get-block", err);', 'warnOnce("get-block", err);'
    ),
    "M15 no try/catch around the pass": lambda: sub(
        '  } catch (err) {\n    warnOnce("pass", err);\n  }\n}', "  } finally {\n    passCounter += 0;\n  }\n}"
    ),
    "M16 stone added to the allow-list": lambda: sub("const MISC = [", 'const MISC = [\n  "stone",'),
    "M17 chest allowed AND deny check removed": lambda: sub(
        "  if (isDeniedBlockId(typeId)) return false;\n", ""
    ).replace("const MISC = [", 'const MISC = [\n  "chest",'),
    "M18 command text starts with a slash": lambda: sub("`setblock ${cell.x}", "`/setblock ${cell.x}"),
    "M19 interval of 1 tick": lambda: sub("PASS_INTERVAL_TICKS = 3;", "PASS_INTERVAL_TICKS = 1;"),
    "M20 calls Entity.clearVelocity (exists, unreviewed)": lambda: sub(
        "    if (!entity.isValid()) return false;", "    if (!entity.isValid()) return false;\n    entity.clearVelocity();"
    ),
    "M21 allow-list typo (oak_door is not a 1.21.0 id)": lambda: sub('"wooden_door"', '"oak_door"'),
    "M22 shulker-box deny suffix removed": lambda: sub('"_command_block", "_shulker_box",', '"_command_block",'),
    "M23 entity state read without guards": lambda: sub(
        '  try {\n    if (!entity.isValid()) return false;\n    const variant = /** @type {EntityVariantComponent | undefined} */ (\n      entity.getComponent(VARIANT_COMPONENT_ID)\n    );\n    return variant !== undefined && variant.value === RAGE_RUN_VARIANT;\n  } catch (err) {\n    if (isEntityStillValid(entity)) warnOnce("entity-state", err);\n    return false;\n  }',
        "  const variant = entity.getComponent(VARIANT_COMPONENT_ID);\n  return variant !== undefined && variant.value === RAGE_RUN_VARIANT;",
    ),
    "M24 feet epsilon removed (float noise digs the floor)": lambda: sub("feetEpsilon: 0.01,", "feetEpsilon: 0,"),
    "M25 rotation window removed (entities beyond the cap starve)": lambda: sub(
        "const start = total > 0 ? passCounter % total : 0;", "const start = 0;"
    ),
    "M26 absent gameRules (Beta-only on preview 26) fails CLOSED": lambda: sub(
        "if (rules === undefined || rules === null) return true;", "if (rules === undefined || rules === null) return false;"
    ),
    "M27 unreadable gameRules fails CLOSED": lambda: sub(
        "  } catch (ignored) {\n    return true;\n  }\n}\n\n/**\n * @param {string} dimensionId",
        "  } catch (ignored) {\n    return false;\n  }\n}\n\n/**\n * @param {string} dimensionId",
    ),
    "M28 no getItemStack fallback (typeId only)": lambda: sub(
        "    if (block.isAir || block.isLiquid) return undefined;\n    const stack = block.getItemStack(1, false);\n    return stack === undefined ? undefined : stack.typeId;",
        "    return undefined;",
    ),
}


def main():
    out_path = None
    if "--out" in sys.argv:
        out_path = sys.argv[sys.argv.index("--out") + 1]
    lines = []
    survivors = 0
    tmp = tempfile.mkdtemp(prefix="scp096_mut_")
    for name, make in MUTANTS.items():
        try:
            text = make()
        except AssertionError as e:
            lines.append(f"ERROR     {name}: {e}")
            survivors += 1
            continue
        if text == base:
            lines.append(f"NO-OP     {name}")
            survivors += 1
            continue
        path = os.path.join(tmp, "main_mutant.js")
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        r = subprocess.run(
            ["node", TEST], env={**os.environ, "SCP096_MAIN": path}, capture_output=True, text=True
        )
        failed = [l for l in r.stdout.splitlines() if l.startswith("FAIL")]
        status = "KILLED" if r.returncode != 0 else "SURVIVED"
        if status == "SURVIVED":
            survivors += 1
        lines.append(f"{status:9} {name}  [{len(failed)} scenarios failed, exit {r.returncode}]")
    lines.append(f"mutants: {len(MUTANTS)}, survivors/errors: {survivors}")
    text = "\n".join(lines)
    print(text)
    if out_path:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    return 1 if survivors else 0


if __name__ == "__main__":
    sys.exit(main())
