# Shown once, on first join.
titleraw @s times 10 70 20
titleraw @s title {"rawtext":[{"text":"§eLOST ISLAND: ABANDONED"}]}
titleraw @s subtitle {"rawtext":[{"text":"§7Survive. Discover what happened. Find a way home."}]}
playsound ambient.weather.thunder @s ~ ~ ~ 0.7 0.8
tellraw @s {"rawtext":[{"text":"§8§m                                        "}]}
tellraw @s {"rawtext":[{"text":"§eLOST ISLAND: ABANDONED"}]}
tellraw @s {"rawtext":[{"text":"§7The island was inhabited once. Almost everyone disappeared."}]}
tellraw @s {"rawtext":[{"text":"§7Run §f/function li_help§7 for commands."}]}
tellraw @s {"rawtext":[{"text":"§8§m                                        "}]}
execute if score #built li_sys matches ..0 run function li_core/offer_kit
execute if score #built li_sys matches 1.. run function li_story/chapter_1
