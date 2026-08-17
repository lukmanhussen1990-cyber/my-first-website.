# First join, island not built yet: hand over the Start Kit.
give @s li:setup_tool 1
tellraw @s {"rawtext":[{"text":"§8[§eLost Island§8] §fYou have been given the §eStart Kit§f."}]}
tellraw @s {"rawtext":[{"text":"§7Hold-tap it to build Lost Island. Use a §fnew world§7 - it rewrites terrain around 0,0."}]}
playsound random.orb @s ~ ~ ~ 0.7 1.4
