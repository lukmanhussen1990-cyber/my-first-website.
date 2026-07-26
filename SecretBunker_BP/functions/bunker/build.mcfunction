# =====================================================
#  SECRET UNDERGROUND BUNKER - main builder
#  Run with:  /function bunker/build
#
#  Everything is built RELATIVE to where you stand.
#  The bunker goes SOUTH (+Z) and DOWN from you.
#  Stand on flat open ground, then run the command.
# =====================================================

tellraw @s {"rawtext":[{"text":"§8[§aBUNKER§8] §7Excavating... hold still."}]}

# Order matters - each step carves into the previous one.
function bunker/parts/01_shell
function bunker/parts/02_rooms
function bunker/parts/03_trim
function bunker/parts/04_entrance
function bunker/parts/05_lighting
function bunker/parts/06_furnish
function bunker/parts/07_farm
function bunker/parts/08_vault
function bunker/parts/09_escape

tellraw @s {"rawtext":[{"text":"§8[§aBUNKER§8] §aDone!"}]}
tellraw @s {"rawtext":[{"text":"§7Entrance: the §fmossy boulder§7 2 blocks south of you. Climb on top, drop into the hole."}]}
tellraw @s {"rawtext":[{"text":"§7Type §f/function bunker/help §7for the full map and secrets."}]}
