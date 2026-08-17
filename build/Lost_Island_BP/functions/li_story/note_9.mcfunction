tag @s add li_n9
playsound random.pop @s ~ ~ ~ 0.5 1.3
tellraw @s {"rawtext":[{"text":"§8[§7triage board§8]"}]}
tellraw @s {"rawtext":[{"text":"§7§oTRIAGE: green - send home. Amber - observation. Red - transfer NORTH. Nobody transferred north has returned. Stop marking red."}]}
titleraw @s actionbar {"rawtext":[{"text":"§7You found a §ftriage board§7."}]}
