# =====================================================
#  HAUNTED HOUSE - master build function
#  Run in-game with:  /function haunted_house/build
#  The mansion is built AROUND you, so stand in an open,
#  flat area (Creative mode recommended) before running.
# =====================================================

say §5§l>> Summoning the Haunted House... hold still <<

function haunted_house/structure
function haunted_house/windows
function haunted_house/interior
function haunted_house/exterior

tellraw @a {"rawtext":[{"text":"§5§lThe §8Haunted House §5§lhas risen!§r\n§7Optional: §f/function haunted_house/haunt §7for spooky residents.\n§7Cleanup: §f/function haunted_house/clear §7to remove everything."}]}
