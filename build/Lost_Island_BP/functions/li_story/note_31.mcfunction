tag @s add li_n31
playsound random.pop @s ~ ~ ~ 0.5 1.3
tellraw @s {"rawtext":[{"text":"§8[§7camp order§8]"}]}
tellraw @s {"rawtext":[{"text":"§7§oContainment has failed at the facility. Fall back to the camp. Do not attempt to re-enter the lower levels."}]}
titleraw @s actionbar {"rawtext":[{"text":"§7You found a §fcamp order§7."}]}
